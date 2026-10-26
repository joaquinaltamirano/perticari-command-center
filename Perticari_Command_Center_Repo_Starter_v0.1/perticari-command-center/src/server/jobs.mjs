import { ml,sellerId,mapItem,ownItem,readClient } from './mercadolibre.mjs';
import { listingStatement,productStatement,policies } from './db.mjs';
import { groupStatement,priceHistoryStatement } from './imports.mjs';
import { guestPage } from './memosoft.mjs';
import { encryptValue,decryptValue,oauthConfig,digest } from './oauth.mjs';
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
 if((await policies(db)).pause_jobs)return {paused:true};
 await db.prepare("UPDATE pcc_jobs SET status='pending',lease=NULL WHERE status='running' AND lease<?").bind(Date.now()-120000).run();
 let processed=0;
 for(let i=0;i<Math.min(max,3);i++){
  const job=await db.prepare("SELECT * FROM pcc_jobs WHERE status='pending' AND due<=? ORDER BY CASE kind WHEN 'event' THEN 0 WHEN 'questions' THEN 1 WHEN 'question_reconcile' THEN 2 WHEN 'orders_recent' THEN 3 WHEN 'orders' THEN 4 ELSE 5 END,due,id LIMIT 1").bind(Date.now()).first();if(!job)break;
  const now=Date.now(),claim=await db.prepare("UPDATE pcc_jobs SET status='running',lease=?,attempts=attempts+1 WHERE id=? AND status='pending'").bind(now,job.id).run();if(!claim.meta.changes)continue;
  try{await perform(env,db,job);await db.prepare("UPDATE pcc_jobs SET status='done',error=NULL,lease=NULL,updated=? WHERE id=? AND status='running' AND lease=?").bind(Date.now(),job.id,now).run();processed++;}
  catch(e){const transient=e.remote_status?(e.remote_status===429||e.remote_status>=500):(e.status===429||e.status===503||e.status===502);const retry=transient&&job.attempts<4;
   await db.prepare("UPDATE pcc_jobs SET status=?,due=?,error=?,lease=NULL,updated=? WHERE id=? AND status='running' AND lease=?").bind(retry?'pending':'failed',Date.now()+Math.min(3600000,30000*2**job.attempts),String(e.message).slice(0,300),Date.now(),job.id,now).run();
   await source(db,job.kind,'error',e.message);
  }
 }
 return {processed};
}
export async function storeQuestion(db,q,checked=Date.now()){return storeQuestions(db,[q],checked);}
async function storeQuestions(db,questions,checked){
 const data=questions.map(q=>{
  if(!/^\d+$/.test(String(q.id))||!/^MLA\d+$/.test(q.item_id)||typeof q.status!=='string')throw new Error('Pregunta incompatible con el contrato esperado');
  const created=Date.parse(q.date_created),answered=Date.parse(q.answer?.date_created);
  return {id:String(q.id),item_id:q.item_id,text:String(q.text||'').slice(0,4000),status:q.status,answer:q.answer?.text||null,created_at:Number.isFinite(created)?created:null,answered_at:Number.isFinite(answered)?answered:null};
 });
 if(!data.length)return;const payload=JSON.stringify(data);
 await db.batch([
 db.prepare(`INSERT INTO pcc_questions SELECT json_extract(value,'$.id'),json_extract(value,'$.item_id'),json_extract(value,'$.text'),json_extract(value,'$.status'),json_extract(value,'$.answer'),NULL,? FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET text=CASE WHEN excluded.text='' THEN pcc_questions.text ELSE excluded.text END,status=excluded.status,answer=excluded.answer,source_at=excluded.source_at WHERE excluded.source_at>=pcc_questions.source_at`).bind(checked,payload),
 db.prepare(`INSERT INTO pcc_question_state SELECT json_extract(value,'$.id'),json_extract(value,'$.created_at'),?,?,json_extract(value,'$.answered_at'),'verified' FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET created_at=COALESCE(excluded.created_at,created_at),checked_at=MAX(checked_at,excluded.checked_at),answered_at=COALESCE(excluded.answered_at,answered_at),availability=CASE WHEN excluded.checked_at>=checked_at THEN excluded.availability ELSE availability END`).bind(checked,checked,payload)]);
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
  const rows=(await db.prepare("SELECT q.id,q.item_id FROM pcc_questions q LEFT JOIN pcc_question_state s ON s.id=q.id WHERE q.status='UNANSWERED' AND q.id>? AND COALESCE(s.checked_at,0)<? ORDER BY q.id LIMIT 3").bind(p.cursor||'',p.cycle).all()).results;
  for(const row of rows){
   try{const q=await client.get('/questions/'+row.id);if(String(q.seller_id)!==seller||String(q.id)!==row.id||q.item_id!==row.item_id)throw new Error('Pregunta sin pertenencia verificable');await storeQuestion(db,q);}
   catch(e){if(![404,410].includes(e.remote_status))throw e;
    await db.batch([db.prepare("UPDATE pcc_questions SET status='UNAVAILABLE',source_at=? WHERE id=?").bind(Date.now(),row.id),db.prepare("INSERT INTO pcc_question_state VALUES (?,NULL,?,?,NULL,'unavailable') ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at,availability='unavailable'").bind(row.id,Date.now(),Date.now())]);
   }
  }
  if(rows.length===3)await enqueue(db,'question_reconcile',{cycle:p.cycle,cursor:rows.at(-1).id},job.id+':next');
  else await source(db,'question_reconcile','ready','Pendientes locales contrastados por ID; la ausencia en búsquedas no se interpreta como respuesta',true);
 }else if(job.kind==='memosoft'){
  const {products,sessionCookie}=await guestPage(p.page||1,p.session?await decryptValue(p.session,oauthConfig(env)):null);
  const fingerprint=await digest(JSON.stringify(products.map(p=>[p.sku,p.base_cents])));if(products.length&&fingerprint===p.previous_page)throw new Error('MEMOSOFT repitió la misma página. Se detuvo la lectura para no declarar una sincronización completa.');
  if(products.length){const data=JSON.stringify(products);await db.batch([priceHistoryStatement(db,data),groupStatement(db,'product',data)]);}
  if(products.length)await enqueue(db,'memosoft',{page:(p.page||1)+1,previous_page:fingerprint,session:await encryptValue(sessionCookie,oauthConfig(env))},job.id+':next');
  else await source(db,'memosoft','ready','Catálogo leído desde el acceso invitado',true);
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
 if(policy.auto_memosoft)await enqueue(db,'memosoft',{},'memosoft:'+new Date().toISOString().slice(0,10));
 await db.prepare(`INSERT OR IGNORE INTO pcc_jobs SELECT 'event:'||id,'event',json_object('id',id),'pending',0,?,NULL,NULL,? FROM pcc_notifications WHERE status='pending' ORDER BY id LIMIT 10`).bind(now,now).run();
 return runJobs(env,db,3);
}
