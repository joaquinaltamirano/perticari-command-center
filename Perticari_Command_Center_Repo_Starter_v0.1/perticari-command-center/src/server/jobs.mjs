import { ml,sellerId,mapItem,ownItem,readClient } from './mercadolibre.mjs';
import { listingStatement,productStatement,policies } from './db.mjs';
import { groupStatement } from './imports.mjs';
import { guestPage } from './memosoft.mjs';
import { encryptValue,decryptValue,oauthConfig,digest } from './oauth.mjs';
const sourceReady=new WeakSet();
export async function ensureSources(db){
 if(sourceReady.has(db))return;
 await db.batch([
  "CREATE TABLE IF NOT EXISTS pcc_question_verifications (id TEXT PRIMARY KEY,search_at INTEGER,individual_at INTEGER,last_error TEXT,remote_status INTEGER)",
  "CREATE TABLE IF NOT EXISTS pcc_memosoft_runs (id TEXT PRIMARY KEY,status TEXT NOT NULL,started INTEGER NOT NULL,finished INTEGER,pages INTEGER NOT NULL DEFAULT 0,products INTEGER NOT NULL DEFAULT 0,rejected INTEGER NOT NULL DEFAULT 0,detail TEXT NOT NULL DEFAULT '')",
  "CREATE TABLE IF NOT EXISTS pcc_memosoft_stage (run_id TEXT NOT NULL,sku TEXT NOT NULL,payload TEXT NOT NULL,valid INTEGER NOT NULL,PRIMARY KEY(run_id,sku))",
  "CREATE TABLE IF NOT EXISTS pcc_memosoft_pages (run_id TEXT NOT NULL,page INTEGER NOT NULL,fingerprint TEXT NOT NULL,PRIMARY KEY(run_id,page),UNIQUE(run_id,fingerprint))",
  "CREATE TABLE IF NOT EXISTS pcc_source_notices (id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL,acknowledged INTEGER)"
 ].map(sql=>db.prepare(sql)));
 sourceReady.add(db);
}
export async function sourceState(db){
 await ensureSources(db);
 return {
  memosoft_runs:(await db.prepare('SELECT * FROM pcc_memosoft_runs ORDER BY started DESC LIMIT 10').all()).results,
  question_verifications:(await db.prepare('SELECT * FROM pcc_question_verifications ORDER BY COALESCE(individual_at,search_at,0) DESC LIMIT 1000').all()).results,
  source_notices:(await db.prepare('SELECT * FROM pcc_source_notices ORDER BY created DESC LIMIT 100').all()).results.map(r=>({...r,payload:JSON.parse(r.payload)}))
 };
}
export async function enqueue(db,kind,payload={},id=crypto.randomUUID()){
 const now=Date.now();await db.prepare("INSERT OR IGNORE INTO pcc_jobs VALUES (?,?,?,'pending',0,?,NULL,NULL,?)").bind(id,kind,JSON.stringify(payload),now,now).run();return {id};
}
export async function requestSync(db,kind){
 const active=await db.prepare("SELECT id FROM pcc_jobs WHERE kind=? AND status IN ('pending','running') LIMIT 1").bind(kind).first();
 if(active)return {...active,repeated:true};
 return enqueue(db,kind,{},'manual:'+kind+':'+Math.floor(Date.now()/10000));
}
async function source(db,id,status,detail,success=false){const now=Date.now();await db.prepare('INSERT INTO pcc_sources VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_attempt=excluded.last_attempt,last_success=COALESCE(excluded.last_success,pcc_sources.last_success),detail=excluded.detail').bind(id,status,now,success?now:null,detail).run();}
export async function runJobs(env,db,max=1){
 await ensureSources(db);
 if((await policies(db)).pause_jobs)return {paused:true};
 await db.prepare("UPDATE pcc_jobs SET status='pending',lease=NULL WHERE status='running' AND lease<?").bind(Date.now()-120000).run();
 let processed=0;
 for(let i=0;i<Math.min(max,3);i++){
  const job=await db.prepare("SELECT * FROM pcc_jobs WHERE status='pending' AND due<=? ORDER BY CASE kind WHEN 'event' THEN 0 WHEN 'questions' THEN 1 WHEN 'question_reconcile' THEN 2 WHEN 'orders_recent' THEN 3 WHEN 'orders' THEN 4 WHEN 'questions_history' THEN 5 ELSE 6 END,due,id LIMIT 1").bind(Date.now()).first();if(!job)break;
  const now=Date.now(),claim=await db.prepare("UPDATE pcc_jobs SET status='running',lease=?,attempts=attempts+1 WHERE id=? AND status='pending'").bind(now,job.id).run();if(!claim.meta.changes)continue;
  try{await perform(env,db,job);await db.prepare("UPDATE pcc_jobs SET status='done',error=NULL,lease=NULL,updated=? WHERE id=? AND status='running' AND lease=?").bind(Date.now(),job.id,now).run();processed++;}
  catch(e){const transient=e.remote_status?(e.remote_status===429||e.remote_status>=500):(e.status===429||e.status===503||e.status===502);const retry=transient&&job.attempts<4;
   await db.prepare("UPDATE pcc_jobs SET status=?,due=?,error=?,lease=NULL,updated=? WHERE id=? AND status='running' AND lease=?").bind(retry?'pending':'failed',Date.now()+Math.min(3600000,30000*2**job.attempts),String(e.message).slice(0,300),Date.now(),job.id,now).run();
   const resource=job.kind==='event'?'evento (recurso según notificación)':job.kind.startsWith('orders')?'/orders/search':job.kind.startsWith('question')?'/questions':'MEMOSOFT';
   await source(db,job.kind,'error',resource+': '+String(e.message).slice(0,250));
   if(job.kind==='memosoft'){const p=JSON.parse(job.payload);await db.prepare("UPDATE pcc_memosoft_runs SET status=?,detail=? WHERE id=? AND status!='complete'").bind(retry?'waiting_retry':'failed',String(e.message).slice(0,300),p.run_id||job.id).run();}
  }
 }
 return {processed};
}
export async function storeQuestion(db,q,checked=Date.now()){return storeQuestions(db,[q],checked,'individual');}
async function storeQuestions(db,questions,checked,mode='search'){
 await ensureSources(db);
 const data=questions.map(q=>{
  if(!/^\d+$/.test(String(q.id))||!/^MLA\d+$/.test(q.item_id)||typeof q.status!=='string')throw new Error('Pregunta incompatible con el contrato esperado');
  const created=Date.parse(q.date_created),answered=Date.parse(q.answer?.date_created);
  return {id:String(q.id),item_id:q.item_id,text:String(q.text||'').slice(0,4000),status:q.status,answer:q.answer?.text||null,created_at:Number.isFinite(created)?created:null,answered_at:Number.isFinite(answered)?answered:null};
 });
 if(!data.length)return;const payload=JSON.stringify(data);
 await db.batch([
 db.prepare(`INSERT INTO pcc_questions SELECT json_extract(value,'$.id'),json_extract(value,'$.item_id'),json_extract(value,'$.text'),json_extract(value,'$.status'),json_extract(value,'$.answer'),NULL,? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET text=CASE WHEN excluded.text='' THEN pcc_questions.text ELSE excluded.text END,status=excluded.status,answer=excluded.answer,source_at=excluded.source_at WHERE excluded.source_at>=pcc_questions.source_at AND NOT (?='search' AND pcc_questions.status='ANSWERED' AND excluded.status='UNANSWERED')`).bind(checked,payload,mode),
 db.prepare(`INSERT INTO pcc_question_state SELECT json_extract(value,'$.id'),json_extract(value,'$.created_at'),?,?,json_extract(value,'$.answered_at'),'verified' FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET created_at=COALESCE(excluded.created_at,created_at),checked_at=MAX(checked_at,excluded.checked_at),answered_at=COALESCE(excluded.answered_at,answered_at),availability=CASE WHEN excluded.checked_at>=checked_at THEN excluded.availability ELSE availability END`).bind(checked,checked,payload),
 db.prepare(`INSERT INTO pcc_question_verifications (id,search_at,individual_at) SELECT json_extract(value,'$.id'),?,? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET search_at=CASE WHEN excluded.search_at IS NOT NULL THEN MAX(COALESCE(search_at,0),excluded.search_at) ELSE search_at END,individual_at=CASE WHEN excluded.individual_at IS NOT NULL THEN MAX(COALESCE(individual_at,0),excluded.individual_at) ELSE individual_at END,last_error=CASE WHEN excluded.individual_at IS NOT NULL THEN NULL ELSE last_error END,remote_status=CASE WHEN excluded.individual_at IS NOT NULL THEN 200 ELSE remote_status END`).bind(mode==='search'?checked:null,mode==='individual'?checked:null,payload)]);
}
export async function storeOrder(db,order,seller){return storeOrders(db,[order],seller);}
async function storeOrders(db,orders,seller){
 const data=orders.map(order=>{
  if(String(order.seller?.id)!==seller||!/^\d+$/.test(String(order.id)))throw new Error('Venta sin vendedor verificable');
  const total=Math.round(Number(order.total_amount)*100);if(!Number.isSafeInteger(total)||total<0)throw new Error('Importe remoto de venta inválido');
  const items=(order.order_items||[]).map(r=>({id:String(r.item?.id||''),title:String(r.item?.title||'').slice(0,300),sku:r.item?.seller_sku||r.item?.seller_custom_field||null,quantity:Number(r.quantity||0)}));
  const value={id:String(order.id),status:order.status,currency:order.currency_id,total_cents:total,units:items.reduce((s,r)=>s+r.quantity,0)};
  return {...value,items,created_at:order.date_created||null,day:String(order.date_created||'').slice(0,10),metric:value};
 });
 if(!data.length)return;const payload=JSON.stringify(data),now=Date.now();
 await db.batch([
 db.prepare(`INSERT INTO pcc_orders(id,status,currency,total_cents,units,created_at,items,source_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.status'),json_extract(value,'$.currency'),json_extract(value,'$.total_cents'),json_extract(value,'$.units'),json_extract(value,'$.created_at'),json_extract(value,'$.items'),? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET status=excluded.status,currency=excluded.currency,total_cents=excluded.total_cents,units=excluded.units,created_at=excluded.created_at,items=excluded.items,source_at=excluded.source_at`).bind(now,payload),
 db.prepare(`INSERT INTO pcc_metrics SELECT 'order:'||json_extract(value,'$.id'),json_extract(value,'$.day'),'order',json_extract(value,'$.metric'),? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET value=excluded.value,source_at=excluded.source_at`).bind(now,payload)]);
}
async function perform(env,db,job){
 const p=JSON.parse(job.payload),client=job.kind==='memosoft'?null:await readClient(env,db),seller=client?.seller;
 if(job.kind==='items'){
  const offset=p.offset||0;
  if(offset>=1000)throw new Error('La sincronización superó 1.000 publicaciones; requiere ampliar la paginación antes de declarar el catálogo completo.');
  const page=await client.get(`/users/${seller}/items/search?limit=10&offset=${offset}`);
  if(!Array.isArray(page.results))throw new Error('Respuesta de publicaciones incompleta');
  const items=[];for(const id of page.results){if(!/^MLA\d+$/.test(id))throw new Error('Identificador remoto inválido');const item=await client.get('/items/'+id);if(String(item.seller_id)!==seller)throw new Error('Publicación ajena a la cuenta conectada');items.push(mapItem(item));}
  if(items.length)await groupStatement(db,'listing',JSON.stringify(items)).run();
  if(page.results.length===10)await enqueue(db,'items',{offset:offset+10},job.id+':next');else await source(db,'items','ready','Publicaciones consultadas por API',true);
 }else if(job.kind==='questions'){
  const cycle=p.cycle||Date.now();
  // Reconcile every previously pending question by ID, independently of search results.
  if(!p.offset&&!await db.prepare("SELECT id FROM pcc_jobs WHERE kind='question_reconcile' AND status IN ('pending','running') LIMIT 1").first())await enqueue(db,'question_reconcile',{cycle,cursor:''},job.id+':reconcile');
  const page=await client.get(`/questions/search?seller_id=${seller}&status=UNANSWERED&api_version=4&limit=20&offset=${p.offset||0}`);
  if(!Array.isArray(page.questions))throw new Error('Respuesta de preguntas incompleta');
  for(const q of page.questions)if(String(q.seller_id)!==seller)throw new Error('Pregunta sin vendedor verificable');await storeQuestions(db,page.questions,cycle);
  if(page.questions.length===20){if((p.offset||0)>=980)throw new Error('Más de 1.000 preguntas: cobertura incompleta');await enqueue(db,'questions',{offset:(p.offset||0)+20,cycle},job.id+':next');}
  else await source(db,'questions','ready','Búsqueda de pendientes completada; estados históricos se reconcilian por separado',true);
 }else if(job.kind==='question_reconcile'){
  const rows=(await db.prepare("SELECT q.id,q.item_id FROM pcc_questions q LEFT JOIN pcc_question_verifications v ON v.id=q.id WHERE q.status='UNANSWERED' AND q.id>? AND COALESCE(v.individual_at,0)<? ORDER BY q.id LIMIT 3").bind(p.cursor||'',p.cycle).all()).results;
  for(const row of rows){
   try{const q=await client.get('/questions/'+row.id);if(String(q.seller_id)!==seller||String(q.id)!==row.id||q.item_id!==row.item_id)throw new Error('Pregunta sin pertenencia verificable');await storeQuestion(db,q);}
   catch(e){await db.prepare('INSERT INTO pcc_question_verifications (id,last_error,remote_status) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET last_error=excluded.last_error,remote_status=excluded.remote_status').bind(row.id,String(e.message).slice(0,250),e.remote_status||null).run();if(![404,410].includes(e.remote_status))throw e;
    await db.batch([db.prepare("UPDATE pcc_questions SET status='UNAVAILABLE',source_at=? WHERE id=?").bind(Date.now(),row.id),db.prepare("INSERT INTO pcc_question_state VALUES (?,NULL,?,?,NULL,'unavailable') ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,availability='unavailable'").bind(row.id,Date.now(),Date.now())]);
   }
  }
  if(rows.length===3)await enqueue(db,'question_reconcile',{cycle:p.cycle,cursor:rows.at(-1).id},job.id+':next');
  else await source(db,'question_reconcile','ready','Ciclo de comprobación individual completado; fechas por pregunta disponibles. Ausencia en búsquedas no implica respuesta.',true);
 }else if(job.kind==='questions_history'){
  const offset=p.offset||0,cycle=p.cycle||Date.now();
  const page=await client.get(`/questions/search?seller_id=${seller}&status=ANSWERED&api_version=4&limit=20&offset=${offset}`);
  if(!Array.isArray(page.questions))throw new Error('Historial de preguntas incompleto');
  for(const q of page.questions)if(String(q.seller_id)!==seller||q.status!=='ANSWERED')throw new Error('Historial sin pertenencia o estado verificable');
  await storeQuestions(db,page.questions,cycle);
  if(page.questions.length===20&&offset<980)await enqueue(db,'questions_history',{offset:offset+20,cycle},job.id+':next');
  else await source(db,'questions_history',page.questions.length===20?'partial':'ready',`Historial importado: ${offset+page.questions.length} respuestas accesibles. Sin promesa de ventana de 60 días.`+(page.questions.length===20?' Límite de 1.000 alcanzado; cobertura parcial.':''),true);
 }else if(job.kind==='memosoft'){
  const run=p.run_id||job.id,page=p.page||1,now=Date.now();
  await db.prepare("INSERT INTO pcc_memosoft_runs(id,status,started) VALUES (?,'running',?) ON CONFLICT(id) DO UPDATE SET status=CASE WHEN status='complete' THEN status ELSE 'running' END").bind(run,now).run();
  if((await db.prepare('SELECT status FROM pcc_memosoft_runs WHERE id=?').bind(run).first()).status==='complete')return;
  const result=await guestPage(page,p.session?await decryptValue(p.session,oauthConfig(env)):null),{products,sessionCookie}=result;
  const fingerprint=await digest(JSON.stringify(products.map(p=>[p.sku,p.base_cents])));
  const repeated=await db.prepare('SELECT page FROM pcc_memosoft_pages WHERE run_id=? AND fingerprint=? AND page!=?').bind(run,fingerprint,page).first();
  if(products.length&&repeated)throw new Error('MEMOSOFT repitió una página. La versión vigente se conserva; lectura incompleta.');
  const pageData=JSON.stringify(products.map(product=>({...product,valid:Number.isSafeInteger(product.base_cents)&&product.base_cents>0?1:0})));
  const conflicting=await db.prepare(`SELECT s.sku FROM pcc_memosoft_stage s JOIN json_each(?) j ON s.sku=json_extract(j.value,'$.sku') WHERE s.run_id=? AND json_extract(s.payload,'$.base_cents') IS NOT json_extract(j.value,'$.base_cents') LIMIT 1`).bind(pageData,run).first();
  if(conflicting)throw new Error('Un código MEMOSOFT aparece con precios incompatibles en la misma lectura. Revisar antes de actualizar.');
  await db.batch([
   db.prepare(`INSERT INTO pcc_memosoft_stage SELECT ?,json_extract(value,'$.sku'),value,json_extract(value,'$.valid') FROM json_each(?) WHERE 1 ON CONFLICT(run_id,sku) DO UPDATE SET payload=excluded.payload,valid=excluded.valid`).bind(run,pageData),
   db.prepare('INSERT OR IGNORE INTO pcc_memosoft_pages VALUES (?,?,?)').bind(run,page,fingerprint),
   db.prepare("UPDATE pcc_memosoft_runs SET pages=MAX(pages,?),products=(SELECT COUNT(*) FROM pcc_memosoft_stage WHERE run_id=? AND valid=1),rejected=(SELECT COUNT(*) FROM pcc_memosoft_stage WHERE run_id=? AND valid=0),detail=? WHERE id=?").bind(page,run,run,'Página '+page+(result.totalPages?' de '+result.totalPages:'')+' guardada; precios vigentes conservados hasta completar.',run)
  ]);
  if(!result.finished){
   await enqueue(db,'memosoft',{page:result.nextPage,run_id:run,session:await encryptValue(sessionCookie,oauthConfig(env))},job.id+':next');
   await source(db,'memosoft','syncing','Lectura en curso: página '+page+(result.totalPages?' de '+result.totalPages:'')+'. La versión vigente sigue disponible.');
  }else{
   const finished=Date.now();
   await db.batch([
    db.prepare(`INSERT OR IGNORE INTO pcc_price_history SELECT ?||':'||s.sku,s.sku,p.base_cents,json_extract(s.payload,'$.base_cents'),json_extract(s.payload,'$.currency'),'memosoft',?,? FROM pcc_memosoft_stage s LEFT JOIN pcc_products p ON p.sku=s.sku WHERE s.run_id=? AND s.valid=1 AND (p.base_cents IS NOT json_extract(s.payload,'$.base_cents') OR p.currency IS NOT json_extract(s.payload,'$.currency'))`).bind(run,finished,finished,run),
    db.prepare(`INSERT INTO pcc_products(sku,name,family,unit,length,base_cents,currency,price_confirmed,source_at,source,technical,updated)
     SELECT s.sku,json_extract(s.payload,'$.name'),json_extract(s.payload,'$.family'),json_extract(s.payload,'$.unit'),json_extract(s.payload,'$.length'),json_extract(s.payload,'$.base_cents'),json_extract(s.payload,'$.currency'),0,?,'memosoft',json_patch(COALESCE(p.technical,'{}'),json_object('memosoft_run_id',?)),?
     FROM pcc_memosoft_stage s LEFT JOIN pcc_products p ON p.sku=s.sku WHERE s.run_id=? AND s.valid=1
     ON CONFLICT(sku) DO UPDATE SET name=excluded.name,family=CASE WHEN pcc_products.price_confirmed=1 THEN pcc_products.family ELSE excluded.family END,unit=COALESCE(pcc_products.unit,excluded.unit),length=COALESCE(pcc_products.length,excluded.length),base_cents=excluded.base_cents,currency=excluded.currency,price_confirmed=CASE WHEN pcc_products.base_cents=excluded.base_cents AND pcc_products.currency=excluded.currency THEN pcc_products.price_confirmed ELSE 0 END,source_at=excluded.source_at,source=excluded.source,technical=excluded.technical,updated=excluded.updated`).bind(finished,run,finished,run),
    db.prepare("UPDATE pcc_memosoft_runs SET status='complete',finished=?,detail='Lectura completa; solo precios válidos promovidos. Rechazados conservan su dato anterior.' WHERE id=?").bind(finished,run),
    db.prepare(`INSERT OR IGNORE INTO pcc_source_notices VALUES (?,'memosoft','Catálogo MEMOSOFT actualizado',json_object('run_id',?,'price_changes',(SELECT COUNT(*) FROM pcc_price_history WHERE id LIKE ? AND previous_cents IS NOT NULL),'new_prices',(SELECT COUNT(*) FROM pcc_price_history WHERE id LIKE ? AND previous_cents IS NULL),'rejected',(SELECT rejected FROM pcc_memosoft_runs WHERE id=?)),?,NULL)`).bind('memosoft:'+run,run,run+':%',run+':%',run,finished)
   ]);
   const summary=await db.prepare('SELECT products,rejected FROM pcc_memosoft_runs WHERE id=?').bind(run).first();
   await source(db,'memosoft','ready','Lectura completa: '+summary.products+' precios válidos; '+summary.rejected+' rechazados conservan sus datos anteriores.',true);
  }
 }else if(['orders','orders_recent'].includes(job.kind)){
  const page=await client.get(`/orders/search?seller=${seller}&sort=date_desc&limit=20&offset=${p.offset||0}`);
  if(!Array.isArray(page.results))throw new Error('Respuesta de ventas incompleta');
  await storeOrders(db,page.results,seller);
  if(job.kind==='orders'&&page.results.length===20&&(p.offset||0)<980)await enqueue(db,'orders',{offset:(p.offset||0)+20},job.id+':next');else await source(db,job.kind,'ready',job.kind==='orders_recent'?'Últimas 20 ventas consultadas; historial completo se revisa diariamente':'Historial consultado: hasta las últimas 1.000 operaciones',true);
 }else if(job.kind==='event'){
  const row=await db.prepare('SELECT * FROM pcc_notifications WHERE id=?').bind(p.id).first();if(!row)return;
  if(String(row.seller_id)!==seller||String(row.application_id)!==oauthConfig(env).application){await db.prepare("UPDATE pcc_notifications SET status='ignored' WHERE id=?").bind(row.id).run();return;}
  if(row.topic==='questions'&&/^\/questions\/\d+$/.test(row.resource)){
   const q=await client.get(row.resource);if(String(q.seller_id)!==seller)throw new Error('Pregunta ajena a la cuenta conectada');await storeQuestion(db,q);
  }else if(row.topic==='items'&&/^\/items\/MLA\d+$/.test(row.resource)){const item=await client.get(row.resource);if(String(item.seller_id)!==seller)throw new Error('Publicación ajena');await listingStatement(db,mapItem(item)).run();}
  else if(row.topic==='orders_v2'&&/^\/orders\/\d+$/.test(row.resource))await storeOrder(db,await client.get(row.resource),seller);
  else{await db.prepare("UPDATE pcc_notifications SET status='ignored' WHERE id=?").bind(row.id).run();return;}
  await db.prepare("UPDATE pcc_notifications SET status='processed',verification_status='api_verified' WHERE id=?").bind(row.id).run();
 }
}
export async function schedule(env,db,{force=false}={}){
 const policy=await policies(db);if(policy.pause_jobs)return {paused:true};
 await db.prepare("UPDATE pcc_operations SET status='reconciliation' WHERE status='running' AND updated<?").bind(Date.now()-600000).run();
 const now=Date.now(),period=Math.floor(now/60000);
 const lock=await db.prepare("INSERT INTO pcc_runtime VALUES ('scheduler','tick',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated<?").bind(now,now-(force?5000:55000)).run();
 if(!lock.meta.changes)return {throttled:true};
 const conn=await db.prepare('SELECT seller_id FROM pcc_oauth_connection WHERE id=1').first();
 if(conn){
  const cooling=await db.prepare("SELECT id FROM pcc_sources WHERE id='questions' AND status='error' AND last_attempt>?").bind(now-300000).first();
  if(policy.auto_questions&&!cooling){const active=await db.prepare("SELECT id FROM pcc_jobs WHERE kind='questions' AND status IN ('pending','running') LIMIT 1").first();if(!active)await enqueue(db,'questions',{},'questions:'+period);}
  const day=new Date().toISOString().slice(0,10);
  await enqueue(db,'items',{},'items:'+day);
  await enqueue(db,'orders',{},'orders:full:'+day);
  if(!await db.prepare("SELECT id FROM pcc_jobs WHERE kind='orders_recent' AND status IN ('pending','running') LIMIT 1").first())await enqueue(db,'orders_recent',{},'orders:recent:'+Math.floor(now/600000));
 }
 if(policy.auto_memosoft&&!await db.prepare("SELECT id FROM pcc_jobs WHERE kind='memosoft' AND status IN ('pending','running') LIMIT 1").first())await enqueue(db,'memosoft',{},'memosoft:'+Math.floor(now/14400000));
 await db.prepare(`INSERT OR IGNORE INTO pcc_jobs SELECT 'event:'||id,'event',json_object('id',id),'pending',0,?,NULL,NULL,? FROM pcc_notifications WHERE status='pending' ORDER BY id LIMIT 10`).bind(now,now).run();
 return runJobs(env,db,3);
}
