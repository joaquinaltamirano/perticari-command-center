import {Problem} from './security.mjs';
import {settings,policies,productRow,listingRow,audit} from './db.mjs';
import {digest,encryptValue,decryptValue,oauthConfig} from './oauth.mjs';
import {approveOperation,executeOperation} from './operations.mjs';
import {ownItem} from './mercadolibre.mjs';
import {defaultAutomationPolicy,validateAutomationPolicy,evaluateAutomaticPrice} from '../domain/automation.mjs';
import {validatePushSubscription,createVapidKeys,encryptedPushRequest} from '../domain/webpush.mjs';

const PREFIX='/api/pcc/v3/automation/',ready=new WeakSet();
export async function ensureAutomationSchema(db){
 if(ready.has(db))return;
 await db.batch([
  'CREATE TABLE IF NOT EXISTS pcc_v3_automation (id TEXT PRIMARY KEY,value TEXT NOT NULL,version INTEGER NOT NULL,updated INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pcc_v3_notices (id TEXT PRIMARY KEY,kind TEXT NOT NULL,severity TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,target TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,occurrences INTEGER NOT NULL DEFAULT 1,pushed INTEGER)',
  'CREATE TABLE IF NOT EXISTS pcc_v3_price_ledger (id TEXT PRIMARY KEY,listing_id TEXT NOT NULL,operation_id TEXT,status TEXT NOT NULL,previous_cents INTEGER NOT NULL,proposed_cents INTEGER NOT NULL,change_bps INTEGER NOT NULL,policy_version INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS pcc_v3_price_window ON pcc_v3_price_ledger(listing_id,created)',
  'CREATE TABLE IF NOT EXISTS pcc_v3_push_subscriptions (id TEXT PRIMARY KEY,value TEXT NOT NULL,created INTEGER NOT NULL,last_success INTEGER,error TEXT)',
  'CREATE TABLE IF NOT EXISTS pcc_v3_notice_ingested (id TEXT PRIMARY KEY,created INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pcc_v3_push_deliveries (notice_id TEXT NOT NULL,subscription_id TEXT NOT NULL,status TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(notice_id,subscription_id))'
 ].map(sql=>db.prepare(sql)));
 await db.prepare("INSERT OR IGNORE INTO pcc_v3_automation VALUES ('policy',?,1,?)").bind(JSON.stringify(defaultAutomationPolicy),Date.now()).run();ready.add(db);
}
async function getPolicy(db){const row=await db.prepare("SELECT * FROM pcc_v3_automation WHERE id='policy'").first();return {...defaultAutomationPolicy,...JSON.parse(row.value),version:row.version};}
export async function emitNotice(db,notice){
 await ensureAutomationSchema(db);const id=await digest('v3-notice:'+String(notice.key||notice.kind+':'+notice.target+':'+notice.title)),now=Date.now();
 const kind=String(notice.kind||'system').slice(0,60),severity=['info','warning','critical'].includes(notice.severity)?notice.severity:'info';
 const title=String(notice.title||'Revisión pendiente').slice(0,160),detail=String(notice.detail||'').slice(0,1500),target=String(notice.target||'').slice(0,120);
 await db.prepare(`INSERT INTO pcc_v3_notices VALUES (?,?,?,?,?,?,'open',?,?,1,NULL) ON CONFLICT(id) DO UPDATE SET detail=excluded.detail,updated=excluded.updated,occurrences=occurrences+1,status=CASE WHEN status='resolved' THEN 'open' ELSE status END,pushed=CASE WHEN status='resolved' THEN NULL ELSE pushed END`).bind(id,kind,severity,title,detail,target,now,now).run();return {id};
}
async function state(db,env){
 const [policy,notices,ledger,subs]=await Promise.all([getPolicy(db),db.prepare('SELECT * FROM pcc_v3_notices ORDER BY CASE status WHEN \'open\' THEN 0 ELSE 1 END,updated DESC LIMIT 200').all(),db.prepare('SELECT * FROM pcc_v3_price_ledger ORDER BY created DESC LIMIT 100').all(),db.prepare('SELECT id,created,last_success,error FROM pcc_v3_push_subscriptions').all()]);
 return {policy,notices:notices.results,ledger:ledger.results,subscriptions:subs.results,push:{supported:true,subscribed:subs.results.length>0},writes_enabled:env.PCC_ENABLE_ML_WRITES==='true'&&env.PCC_ML_CONTRACT_VERIFIED==='true'};
}
async function vapid(db,env){
 const c=oauthConfig(env),old=await db.prepare("SELECT value FROM pcc_v3_automation WHERE id='vapid'").first();if(old)return decryptValue(old.value,c);
 const keys=await createVapidKeys();await db.prepare("INSERT OR IGNORE INTO pcc_v3_automation VALUES ('vapid',?,1,?)").bind(await encryptValue(keys,c),Date.now()).run();return decryptValue((await db.prepare("SELECT value FROM pcc_v3_automation WHERE id='vapid'").first()).value,c);
}
async function sendPush(db,env,notice){
 const keys=await vapid(db,env),subs=(await db.prepare('SELECT * FROM pcc_v3_push_subscriptions ORDER BY created DESC LIMIT 10').all()).results;
 let delivered=0;
 for(const sub of subs){
  const now=Date.now(),claim=await db.prepare("INSERT INTO pcc_v3_push_deliveries VALUES (?,?,'sending',?) ON CONFLICT(notice_id,subscription_id) DO UPDATE SET status='sending',updated=excluded.updated WHERE status='failed' AND updated<?").bind(notice.id,sub.id,now,now-3600000).run();
  if(!claim.meta.changes)continue;
  try{
   const subscription=await decryptValue(sub.value,oauthConfig(env)),request=await encryptedPushRequest(subscription,{title:'Perticari Command Center',body:notice.title,tag:notice.id,url:'/app#automation'},keys,oauthConfig(env).origin);
   const response=await fetch(request.url,{...request.init,signal:AbortSignal.timeout(15000)});
   if([404,410].includes(response.status)){await db.prepare('DELETE FROM pcc_v3_push_subscriptions WHERE id=?').bind(sub.id).run();throw new Error('La suscripción dejó de estar activa');}
   if(!response.ok)throw new Error('El proveedor push rechazó el envío ('+response.status+')');
   await db.prepare('UPDATE pcc_v3_push_subscriptions SET last_success=?,error=NULL WHERE id=?').bind(now,sub.id).run();await db.prepare("UPDATE pcc_v3_push_deliveries SET status='sent',updated=? WHERE notice_id=? AND subscription_id=?").bind(now,notice.id,sub.id).run();delivered++;
  }catch{await db.prepare("UPDATE pcc_v3_push_deliveries SET status='failed',updated=? WHERE notice_id=? AND subscription_id=?").bind(now,notice.id,sub.id).run();await db.prepare('UPDATE pcc_v3_push_subscriptions SET error=? WHERE id=?').bind('No se pudo confirmar entrega al proveedor push; revisar suscripción',sub.id).run();}
 }
 if(delivered)await db.prepare('UPDATE pcc_v3_notices SET pushed=? WHERE id=?').bind(Date.now(),notice.id).run();return {delivered,subscriptions:subs.length};
}

export async function handleAutomation(env,db,path,method,input={}){
 if(!path.startsWith(PREFIX))return null;await ensureAutomationSchema(db);const action=path.slice(PREFIX.length);
 if(method==='GET'&&action==='state')return state(db,env);
 if(method==='GET'&&action==='push/public-key')return {public_key:(await vapid(db,env)).public_key};
 if(method!=='POST')throw new Problem('Método no permitido',405);
 if(action==='policy'){
  const old=await getPolicy(db);if(input.version!==old.version)throw new Problem('La política cambió; recargá antes de guardar',409);
  let next;try{next=validateAutomationPolicy(input,old);}catch(e){throw new Problem(e.message,e.status||400);}
  if(input.listing_ids!=null){
   if(!Array.isArray(input.listing_ids)||input.listing_ids.length>1000||input.listing_ids.some(id=>!/^MLA\d+$/.test(id)))throw new Problem('Elegí hasta 1.000 publicaciones válidas');
   const targets=[],ids=[...new Set(input.listing_ids)],rows=(await db.prepare("SELECT l.id,p.sku,p.unit,p.length,p.currency,p.price_confirmed FROM pcc_listings l LEFT JOIN pcc_products p ON p.sku=l.sku WHERE l.id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(ids)).all()).results,byId=new Map(rows.map(r=>[r.id,r]));
   for(const id of ids){
    const p=byId.get(id);
    if(!p?.price_confirmed||!p.unit||p.currency!=='ARS')throw new Problem('Confirmá presentación y precio base antes de incluir '+id,409);
    targets.push({id,sku:p.sku,unit:p.unit,length:p.length,currency:p.currency});
   }
   next.targets=targets;
  }
  if(next.enabled){
   if(input.confirm!==true||!next.targets.length)throw new Problem('Confirmá la regla y seleccioná las publicaciones que puede mantener',409);
   const global=await policies(db);if(global.read_only||global.pause_jobs||env.PCC_ENABLE_ML_WRITES!=='true'||env.PCC_ML_CONTRACT_VERIFIED!=='true')throw new Problem('Falta habilitar el piloto verificado y las escrituras antes de activar automatización',409);
   next.activated_at=Date.now();
  }
  const {version,...value}=next;const changed=await db.prepare("UPDATE pcc_v3_automation SET value=?,version=version+1,updated=? WHERE id='policy' AND version=?").bind(JSON.stringify(value),Date.now(),old.version).run();
  if(!changed.meta.changes)throw new Problem('La política cambió; recargá',409);await audit(db,'v3_price_policy','policy',{enabled:value.enabled,targets:value.targets.length,version:old.version+1});return {policy:await getPolicy(db)};
 }
 if(action==='run')return automationTick(env,db,{force:true});
 if(action==='notifications/action'){
  const status={acknowledge:'acknowledged',resolve:'resolved',reopen:'open'}[input.action];if(!status)throw new Problem('Acción de aviso inválida');
  const result=await db.prepare('UPDATE pcc_v3_notices SET status=?,updated=? WHERE id=?').bind(status,Date.now(),String(input.id||'')).run();if(!result.meta.changes)throw new Problem('Aviso no encontrado',404);return {ok:true};
 }
 if(action==='push/subscribe'){
  let subscription;try{subscription=validatePushSubscription(input.subscription);}catch(e){throw new Problem(e.message);}
  const id=await digest(subscription.endpoint),existing=await db.prepare('SELECT id FROM pcc_v3_push_subscriptions WHERE id=?').bind(id).first();
  if(!existing&&(await db.prepare('SELECT COUNT(*) AS count FROM pcc_v3_push_subscriptions').first()).count>=10)throw new Problem('Hay diez dispositivos suscriptos; quitá uno antes de agregar otro',409);
  await db.prepare('INSERT INTO pcc_v3_push_subscriptions VALUES (?,?,?,NULL,NULL) ON CONFLICT(id) DO UPDATE SET value=excluded.value,error=NULL').bind(id,await encryptValue(subscription,oauthConfig(env)),Date.now()).run();return {id,subscribed:true};
 }
 if(action==='push/unsubscribe'){await db.prepare('DELETE FROM pcc_v3_push_subscriptions WHERE id=?').bind(String(input.id||'')).run();return {ok:true};}
 if(action==='push/test'){
  const n=await emitNotice(db,{key:'push-test:'+crypto.randomUUID(),kind:'test',severity:'info',title:'Notificaciones de Perticari activadas'});return sendPush(db,env,{id:n.id,title:'Notificaciones de Perticari activadas'});
 }
 throw new Problem('Recurso no encontrado',404);
}

async function bridgeNotices(db){
 const has=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pcc_sources'").first();if(!has)return;
 const sources=(await db.prepare("SELECT * FROM pcc_sources WHERE status IN ('error','stale') LIMIT 20").all()).results;
 await db.prepare("UPDATE pcc_v3_notices SET status='resolved',updated=? WHERE kind='source' AND status!='resolved' AND target IN (SELECT id FROM pcc_sources WHERE status='ready')").bind(Date.now()).run();
 for(const s of sources)await emitNotice(db,{key:'source:'+s.id,kind:'source',severity:s.id==='memosoft'?'critical':'warning',title:'Revisar fuente: '+s.id,detail:s.detail,target:s.id});
 const uncertain=(await db.prepare("SELECT id,kind,target FROM pcc_operations WHERE status='reconciliation' LIMIT 20").all()).results;
 for(const op of uncertain)await emitNotice(db,{key:'operation:'+op.id,kind:'operation',severity:'critical',title:'Una operación necesita comprobación',detail:'No se repetirá el envío hasta verificar el resultado remoto.',target:op.id});
 await db.prepare("UPDATE pcc_v3_notices SET status='resolved',updated=? WHERE kind='operation' AND status!='resolved' AND target IN (SELECT id FROM pcc_operations WHERE status='confirmed')").bind(Date.now()).run();
 const sourceNotices=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pcc_source_notices'").first();
 if(sourceNotices){const rows=(await db.prepare("SELECT n.* FROM pcc_source_notices n WHERE NOT EXISTS (SELECT 1 FROM pcc_v3_notice_ingested i WHERE i.id='source-notice:'||n.id) ORDER BY n.created DESC LIMIT 10").all()).results;for(const n of rows){await emitNotice(db,{key:'source-notice:'+n.id,kind:n.kind,severity:'info',title:n.title,detail:'Hay cambios de catálogo para revisar.',target:n.id});await db.prepare('INSERT OR IGNORE INTO pcc_v3_notice_ingested VALUES (?,?)').bind('source-notice:'+n.id,Date.now()).run();}}
}

export async function automationTick(env,db,{force=false}={}){
 await ensureAutomationSchema(db);const now=Date.now(),claim=await db.prepare("INSERT INTO pcc_v3_automation VALUES ('tick','{}',1,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated<?").bind(now,now-300000).run();
 if(!claim.meta.changes)return {skipped:true};await bridgeNotices(db);
 const policy=await getPolicy(db),global=await policies(db);let executed=0,blocked=0;
 if(policy.enabled&&!global.pause_jobs&&!global.read_only&&env.PCC_ENABLE_ML_WRITES==='true'&&env.PCC_ML_CONTRACT_VERIFIED==='true'){
  const last=await db.prepare("SELECT updated FROM pcc_v3_automation WHERE id='price_run'").first();
  if(force||!last||now-last.updated>=policy.run_every_minutes*60000){
   await db.prepare("INSERT INTO pcc_v3_automation VALUES ('price_run','{}',1,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated").bind(now).run();
   const has=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pcc_memosoft_runs'").first(),run=has?await db.prepare("SELECT * FROM pcc_memosoft_runs WHERE status='complete' ORDER BY finished DESC LIMIT 1").first():null,config=await settings(db);
   const cursor=(await db.prepare("SELECT value FROM pcc_v3_automation WHERE id='price_cursor'").first())?.value||'0';let index=Number(cursor)||0;
   let attempted=0;
   for(let count=0;count<Math.min(5,policy.targets.length);count++){
    if(attempted>=2)break;
    const target=policy.targets[index%policy.targets.length];index++;
    const rawListing=await db.prepare('SELECT * FROM pcc_listings WHERE id=?').bind(target.id).first();if(!rawListing){blocked++;continue;}
    const raw=rawListing.sku&&await db.prepare('SELECT * FROM pcc_products WHERE sku=?').bind(rawListing.sku).first(),listing=listingRow(rawListing),product=raw&&productRow(raw),movements=(await db.prepare('SELECT status,created,change_bps,operation_id FROM pcc_v3_price_ledger WHERE listing_id=? AND created>?').bind(target.id,now-86400000).all()).results;
    const manual=(await db.prepare("SELECT id,status,payload,created FROM pcc_operations WHERE target=? AND kind='price' AND created>? AND status IN ('running','reconciliation','confirmed')").bind(target.id,now-86400000).all()).results;
    for(const op of manual){if(movements.some(m=>m.operation_id===op.id))continue;const p=JSON.parse(op.payload);if(p.expected_cents>0&&p.price_cents>0)movements.push({status:op.status,created:op.created,change_bps:Math.ceil(Math.abs(p.price_cents-p.expected_cents)*10000/p.expected_cents)});}
    const evaluation=evaluateAutomaticPrice({product,listing,config,policy,run,movements,now});
    const pending=await db.prepare("SELECT id FROM pcc_operations WHERE kind='price' AND target=? AND status IN ('running','reconciliation') LIMIT 1").bind(target.id).first();if(pending)evaluation.reasons.push('Precio con operación pendiente de verificación');
    if(evaluation.unchanged&&!evaluation.reasons.length)continue;
    if(evaluation.reasons.length){blocked++;await emitNotice(db,{key:'price-exception:'+target.id,kind:'price',severity:'warning',title:'Precio fuera de la regla automática',detail:evaluation.reasons.join(' · '),target:target.id});continue;}
    const ledgerId=await digest('auto-price:'+target.id+':'+evaluation.proposed_cents+':'+product.updated+':'+policy.version);
    const prior=await db.prepare('SELECT id,status FROM pcc_v3_price_ledger WHERE id=?').bind(ledgerId).first();if(prior)continue;
    const reservation=await db.prepare('INSERT OR IGNORE INTO pcc_v3_price_ledger VALUES (?,?,NULL,?,?,?,?,?,?,?)').bind(ledgerId,target.id,'reserved',listing.price_cents,evaluation.proposed_cents,evaluation.change_bps,policy.version,now,now).run();if(!reservation.meta.changes)continue;
    attempted++;
    try{
     const remote=await ownItem(env,db,target.id);
     if(remote.user_product_id||remote.variations?.length||remote.original_price||remote.sale_price||remote.tags?.some(t=>/promotion|deal|discount/i.test(t)))throw new Problem('La publicación remota tiene una promoción o modelo de precio que requiere revisión',409);
     // This confirmation follows an explicit presentation snapshot in the activated policy.
     // It never changes SKU/unit/currency or fabricates an origin timestamp.
     await db.prepare('UPDATE pcc_products SET price_confirmed=1 WHERE sku=? AND updated=? AND unit=? AND currency=? AND source_at=?').bind(product.sku,product.updated,target.unit,target.currency,run.finished).run();
     const approved=await approveOperation(db,env,{kind:'price',target:target.id,price_cents:evaluation.proposed_cents,presentation_confirmed:true,confirm:true});
     await db.prepare('UPDATE pcc_v3_price_ledger SET operation_id=? WHERE id=?').bind(approved.id,ledgerId).run();
     const result=await executeOperation(db,env,approved.id);
     await db.prepare('UPDATE pcc_v3_price_ledger SET status=?,updated=? WHERE id=?').bind(result.status,Date.now(),ledgerId).run();executed++;
     await emitNotice(db,{key:'price-run:'+Math.floor(now/86400000),kind:'price',severity:'info',title:'Mantenimiento de precios ejecutado',detail:'Los resultados individuales están en el historial de operaciones.'});
    }catch(e){
     const op=await db.prepare('SELECT operation_id FROM pcc_v3_price_ledger WHERE id=?').bind(ledgerId).first(),status=op?.operation_id?(await db.prepare('SELECT status FROM pcc_operations WHERE id=?').bind(op.operation_id).first())?.status:'failed';
     await db.prepare('UPDATE pcc_v3_price_ledger SET status=?,updated=? WHERE id=?').bind(status||'failed',Date.now(),ledgerId).run();blocked++;await emitNotice(db,{key:'price-operation:'+ledgerId,kind:'price',severity:status==='reconciliation'?'critical':'warning',title:'Revisar actualización automática de precio',detail:e instanceof Problem?e.message:'No se pudo comprobar la operación',target:target.id});
    }
   }
   await db.prepare("INSERT INTO pcc_v3_automation VALUES ('price_cursor',?,1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated").bind(String(index%Math.max(1,policy.targets.length)),now).run();
  }
 }
 const critical=(await db.prepare("SELECT id,title FROM pcc_v3_notices WHERE status='open' AND severity='critical' AND pushed IS NULL ORDER BY created LIMIT 3").all()).results;
 if(!global.pause_jobs&&(await db.prepare('SELECT COUNT(*) AS count FROM pcc_v3_push_subscriptions').first()).count)for(const n of critical)await sendPush(db,env,n);
 // Release only our five-minute lease after all work completes. The separate
 // price_run timestamp preserves the configured cadence; force bypasses only cadence.
 await db.prepare("UPDATE pcc_v3_automation SET updated=? WHERE id='tick' AND updated=?").bind(Date.now()-300000,now).run();
 return {executed,blocked,enabled:policy.enabled};
}
