import { v2State,v2Route } from './v2.mjs';
import { attentionSummary,opportunities } from '../domain/intelligence.mjs';
import { suggest } from './intelligence.mjs';
import { identity,json,body,Problem,handleMfa } from './security.mjs';
import { settings,audit,productRow,listingRow,policies } from './db.mjs';
import { oauthConnection } from './oauth.mjs';
import { previewImport,applyImport } from './imports.mjs';
import { quality,draftFrom,draftIssues } from '../domain/catalog.mjs';
import { simulatePrice } from '../domain/money.mjs';
import { freightQuote } from '../domain/logistics.mjs';
import { enqueue,runJobs,requestSync } from './jobs.mjs';
import { answerSuggestion,approveOperation,executeOperation,itemPayload,reconcileOperation } from './operations.mjs';
import { ml } from './mercadolibre.mjs';
export async function api(request,env,ctx){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/pcc/session'||path.startsWith('/api/pcc/mfa/'))return handleMfa(request,env,path);
 const {db}=await identity(request,env);
 if(request.method==='GET'){
  if(path==='/api/pcc/live'){
   const [questions,jobs,sources,operations,orders,policy]=await Promise.all([
    db.prepare("SELECT q.*,s.created_at,s.first_seen,s.checked_at,s.answered_at,s.availability FROM pcc_questions q LEFT JOIN pcc_question_state s ON s.id=q.id ORDER BY CASE q.status WHEN 'UNANSWERED' THEN 0 ELSE 1 END,COALESCE(s.created_at,s.first_seen,q.source_at) DESC LIMIT 1000").all(),
    db.prepare('SELECT id,kind,status,attempts,due,error,updated FROM pcc_jobs ORDER BY updated DESC LIMIT 100').all(),db.prepare('SELECT * FROM pcc_sources').all(),
    db.prepare('SELECT id,kind,target,status,result,created,updated FROM pcc_operations ORDER BY created DESC LIMIT 200').all(),db.prepare('SELECT * FROM pcc_orders ORDER BY source_at DESC LIMIT 200').all(),policies(db)]);
   return json({server_time:Date.now(),questions:questions.results,jobs:jobs.results,sources:sources.results,operations:operations.results,live_orders:orders.results.map(o=>({...o,items:JSON.parse(o.items)})),policy,attention:attentionSummary(questions.results,policy.response_target_minutes),writes:env.PCC_ENABLE_ML_WRITES==='true'&&env.PCC_ML_CONTRACT_VERIFIED==='true'&&!policy.read_only});
  }
  if(path==='/api/pcc/bootstrap'){
   const [products,listings,drafts,questions,operations,jobs,sources,events,imports,config,connection,metrics]=await Promise.all([
    db.prepare('SELECT * FROM pcc_products ORDER BY family,name LIMIT 10000').all(),db.prepare('SELECT * FROM pcc_listings ORDER BY title LIMIT 10000').all(),
    db.prepare('SELECT * FROM pcc_drafts ORDER BY updated DESC LIMIT 1000').all(),db.prepare("SELECT q.*,s.created_at,s.first_seen,s.checked_at,s.answered_at,s.availability FROM pcc_questions q LEFT JOIN pcc_question_state s ON s.id=q.id ORDER BY CASE q.status WHEN 'UNANSWERED' THEN 0 ELSE 1 END,COALESCE(s.created_at,s.first_seen,q.source_at) DESC LIMIT 1000").all(),
    db.prepare('SELECT id,kind,target,status,result,created,updated FROM pcc_operations ORDER BY created DESC LIMIT 200').all(),db.prepare('SELECT id,kind,status,attempts,due,error,updated FROM pcc_jobs ORDER BY updated DESC LIMIT 100').all(),
    db.prepare('SELECT * FROM pcc_sources').all(),db.prepare('SELECT id,action,target,result,created FROM pcc_audit ORDER BY created DESC LIMIT 100').all(),
    db.prepare('SELECT id,filename,status,summary,created,applied FROM pcc_imports ORDER BY created DESC LIMIT 20').all(),settings(db),oauthConnection(db),db.prepare('SELECT day,kind,value,source_at FROM pcc_metrics ORDER BY day DESC LIMIT 1000').all()]);
   const v2=await v2State(db);
   return json({version:'2.0.0',server_time:Date.now(),...v2,attention:attentionSummary(questions.results,v2.policy.response_target_minutes),opportunities:opportunities(products.results.map(productRow),listings.results.map(listingRow),drafts.results,questions.results),products:products.results.map(p=>{const product=productRow(p);return {...product,issues:quality(product),pricing:simulatePrice(product,config)};}),
    listings:listings.results.map(listingRow),drafts:drafts.results.map(d=>({...d,payload:JSON.parse(d.payload),issues:draftIssues(JSON.parse(d.payload))})),
    questions:questions.results,operations:operations.results,jobs:jobs.results,sources:sources.results,audit:events.results,imports:imports.results.map(i=>({...i,summary:JSON.parse(i.summary)})),settings:config,
    metrics:metrics.results.map(m=>({...m,value:JSON.parse(m.value)})),connection:connection?{seller_id:connection.seller_id,expires:connection.expires,refresh_status:connection.refresh_status}:null,
    capabilities:{writes:env.PCC_ENABLE_ML_WRITES==='true'&&env.PCC_ML_CONTRACT_VERIFIED==='true'&&!v2.policy.read_only,ai:env.OPENAI_API_KEY?'Proveedor configurado; sujeto a política y presupuesto':'Reglas y conocimiento validado; IA opcional sin configurar',memosoft:'conexión en validación; importación disponible'}});
  }
  if(path==='/api/pcc/v2/price-history'){
   const sku=url.searchParams.get('sku');if(!sku||sku.length>100)throw new Problem('SKU inválido');return json({rows:(await db.prepare('SELECT previous_cents,public_cents,currency,source,source_at,observed_at FROM pcc_price_history WHERE sku=? ORDER BY observed_at DESC LIMIT 30').bind(sku).all()).results});
  }
  if(path==='/api/pcc/category'){
   const id=url.searchParams.get('id');if(!/^MLA\d+$/.test(id))throw new Problem('Categoría inválida');
   const [category,attributes]=await Promise.all([ml(env,db,'/categories/'+id),ml(env,db,'/categories/'+id+'/attributes')]);return json({category,attributes});
  }
  if(path==='/api/pcc/export'){
   const config=await settings(db),rows=(await db.prepare('SELECT * FROM pcc_products ORDER BY sku').all()).results;
   const safe=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
   const csv='SKU;Producto;Base ARS;Propuesto ARS;Estado;Motivos\r\n'+rows.map(p=>{const sim=simulatePrice(productRow(p),config);return [p.sku,p.name,p.base_cents==null?'':(p.base_cents/100).toFixed(2),sim.proposed_cents==null?'':(sim.proposed_cents/100).toFixed(2),sim.executable?'Revisable':'Pendiente',sim.reasons.join(' | ')].map(safe).join(';');}).join('\r\n');
   return new Response('\ufeff'+csv,{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="Perticari_propuestas_precios.csv"','cache-control':'no-store'}});
  }
  throw new Problem('Recurso no encontrado',404);
 }
 if(!['POST','PUT'].includes(request.method))throw new Problem('Método no permitido',405);
 const input=await body(request);
 if(path.startsWith('/api/pcc/v2/'))return v2Route(path,input,db,env,ctx);
 if(path==='/api/pcc/import/preview')return json(await previewImport(db,input));
 if(path==='/api/pcc/import/apply')return json(await applyImport(db,input.id));
 if(path==='/api/pcc/sync'){
  const kinds=input.source==='all'?['questions','orders_recent','items']:[input.source];
  if(kinds.some(k=>!['items','questions','orders','orders_recent','memosoft'].includes(k)))throw new Problem('Fuente inválida');
  const jobs=[];for(const kind of kinds)jobs.push(await requestSync(db,kind));
  ctx.waitUntil(runJobs(env,db,1));return json({jobs});
 }
 if(path==='/api/pcc/jobs/run'){await runJobs(env,db,1);return json({ok:true});}
 if(path==='/api/pcc/jobs/retry'){
  const job=await db.prepare("SELECT id FROM pcc_jobs WHERE id=? AND status='failed'").bind(input.id).first();if(!job)throw new Problem('Tarea no encontrada',404);
  await db.prepare("UPDATE pcc_jobs SET status='pending',attempts=0,due=?,error=NULL WHERE id=?").bind(Date.now(),job.id).run();return json({ok:true});
 }
 if(path==='/api/pcc/products/update'){
  const p=await db.prepare('SELECT * FROM pcc_products WHERE sku=?').bind(input.sku).first();if(!p)throw new Problem('Producto no encontrado',404);
  if(!['barra','hoja','unidad','kg','metro'].includes(input.unit)||typeof input.family!=='string'||!input.family.trim()||input.family.length>100)throw new Problem('Familia o presentación inválida');
  if(input.price_confirmed===true&&p.base_cents==null)throw new Problem('No se puede confirmar un precio ausente');
  const sourceAt=input.price_confirmed?Date.now():p.source_at;
  await db.prepare('UPDATE pcc_products SET family=?,unit=?,price_confirmed=?,source_at=?,updated=? WHERE sku=?').bind(input.family,input.unit,input.price_confirmed?1:0,sourceAt,Date.now(),p.sku).run();
  await audit(db,'product_review',p.sku,{unit:input.unit,price_confirmed:!!input.price_confirmed});return json({ok:true});
 }
 if(path==='/api/pcc/drafts/create'){
  if(!Array.isArray(input.skus)||!input.skus.length||input.skus.length>30||input.skus.some(s=>typeof s!=='string'||!s||s.length>100))throw new Problem('Elegí de 1 a 30 productos por lote');
  const config=await settings(db),created=[];
  const products=(await db.prepare('SELECT * FROM pcc_products WHERE sku IN (SELECT value FROM json_each(?))').bind(JSON.stringify(input.skus)).all()).results;
  const existingDrafts=(await db.prepare("SELECT id,sku FROM pcc_drafts WHERE status!='published' AND sku IN (SELECT value FROM json_each(?))").bind(JSON.stringify(input.skus)).all()).results;
  for(const sku of [...new Set(input.skus)]){
   const product=products.find(p=>p.sku===sku);if(!product)continue;
   const existing=existingDrafts.find(d=>d.sku===sku);if(existing){created.push(existing.id);continue;}
   const payload=draftFrom(productRow(product),config),simulation=simulatePrice(productRow(product),config);payload.price_cents=simulation.proposed_cents;
   const id=crypto.randomUUID();await db.prepare('INSERT INTO pcc_drafts VALUES (?,?,1,?,?,NULL,?)').bind(id,sku,'draft',JSON.stringify(payload),Date.now()).run();created.push(id);
  }
  await audit(db,'drafts_created','batch',{count:created.length});return json({created});
 }
 if(path==='/api/pcc/drafts/save'){
  const record=await db.prepare('SELECT * FROM pcc_drafts WHERE id=?').bind(input.id).first();if(!record)throw new Problem('Propuesta no encontrada',404);
  if(record.status==='published')throw new Problem('La propuesta ya fue publicada',409);
  const d=input.payload;
  if(!d||d.sku!==record.sku||typeof d.title!=='string'||d.title.length>200||typeof d.description!=='string'||d.description.length>10000||!Array.isArray(d.pictures)||d.pictures.length>12||!Array.isArray(d.attributes)||d.attributes.length>100)throw new Problem('Propuesta inválida');
  const payload={sku:record.sku,title:d.title.trim(),category_id:String(d.category_id||''),price_cents:d.price_cents,currency_id:'ARS',quantity:Number(d.quantity),
   listing_type_id:['gold_special','gold_pro'].includes(d.listing_type_id)?d.listing_type_id:'gold_special',condition:'new',buying_mode:'buy_it_now',
   description:d.description,pictures:d.pictures.map(p=>({source:String(p.source||'').slice(0,2048)})),attributes:d.attributes.map(a=>({id:String(a.id||'').slice(0,100),...(a.value_id?{value_id:String(a.value_id).slice(0,100)}:{value_name:String(a.value_name||'').slice(0,200)})})),
   presentation_confirmed:d.presentation_confirmed===true,media_pending:d.media_pending!==false,video_pending:d.video_pending!==false};
  const changed=await db.prepare("UPDATE pcc_drafts SET payload=?,version=version+1,status='draft',validation=NULL,updated=? WHERE id=? AND version=?").bind(JSON.stringify(payload),Date.now(),input.id,input.version).run();
  if(!changed.meta.changes)throw new Problem('La propuesta cambió en otra pestaña; recargá',409);
  await audit(db,'draft_saved',input.id,{version:input.version+1});return json({ok:true});
 }
 if(path==='/api/pcc/drafts/validate'){
  const draft=await db.prepare('SELECT * FROM pcc_drafts WHERE id=?').bind(input.id).first();if(!draft)throw new Problem('Propuesta no encontrada',404);
  const d=JSON.parse(draft.payload),issues=draftIssues(d);if(issues.length)throw new Problem(issues.join(' · '),409);
  if(env.PCC_ML_CONTRACT_VERIFIED!=='true')throw new Problem('Propuesta preparada. La validación remota se habilita al comprobar el contrato de la API para esta cuenta.',409);
  await ml(env,db,'/items/validate',{method:'POST',data:itemPayload(d)});
  await db.prepare("UPDATE pcc_drafts SET validation=?,status='validated' WHERE id=? AND version=?").bind(JSON.stringify({version:draft.version,at:Date.now()}),input.id,draft.version).run();return json({validated:true});
 }
 if(path==='/api/pcc/questions/suggest')return json(await suggest(db,env,input));
 if(path==='/api/pcc/questions/save'){
  const text=String(input.text||'').trim();if(text.length>2000)throw new Problem('Respuesta demasiado larga');
  const changed=await db.prepare("UPDATE pcc_questions SET draft=? WHERE id=? AND status='UNANSWERED'").bind(text,input.id).run();if(!changed.meta.changes)throw new Problem('La pregunta ya no está pendiente',409);return json({ok:true});
 }
 if(path==='/api/pcc/operations/approve')return json(await approveOperation(db,env,input));
 if(path==='/api/pcc/operations/reconcile')return json(await reconcileOperation(db,env,input.id));
 if(path==='/api/pcc/operations/execute')return json(await executeOperation(db,env,input.id));
 if(path==='/api/pcc/freight/quote'){
  const result=freightQuote(input,await settings(db));
  const id=crypto.randomUUID();const safe={distance_km:input.distance_km??null,weight_kg:input.weight_kg??null,mode:input.mode||'local',coverage_checked:input.coverage_checked===true};
  await db.prepare('INSERT INTO pcc_quotes VALUES (?,?,?,?)').bind(id,JSON.stringify(safe),JSON.stringify(result),Date.now()).run();return json({id,...result});
 }
 if(path==='/api/pcc/settings'){
  const old=await settings(db);
  if(input.version!==old.version)throw new Problem('La configuración cambió; recargá',409);
  const value={...old};delete value.version;
  if(input.default_quantity!=null){if(!Number.isInteger(input.default_quantity)||input.default_quantity<1||input.default_quantity>100000)throw new Problem('Cantidad comercial inválida');value.default_quantity=input.default_quantity;}
  if(input.fx_cents!=null){if(!Number.isSafeInteger(input.fx_cents)||input.fx_cents<=0||input.fx_cents>10000000||!String(input.fx_source||'').trim())throw new Problem('Cotización o fuente inválida');value.fx_cents=input.fx_cents;value.fx_source=String(input.fx_source).slice(0,120);value.fx_at=Date.now();}
  if(input.fee_bands){
   if(!Array.isArray(input.fee_bands)||input.fee_bands.length!==4)throw new Problem('Se requieren cuatro franjas');
   let start=0;for(let i=0;i<4;i++){const b=input.fee_bands[i];if(b.from!==start||!Number.isSafeInteger(b.fixed)||b.fixed<0||(i===3?b.to!==null:!Number.isSafeInteger(b.to)||b.to<=b.from))throw new Problem('Franjas inválidas o superpuestas');start=b.to;}
   value.fee_bands=input.fee_bands;value.fees_confirmed_at=input.fees_confirmed===true?Date.now():null;
  }
  if(input.coverage_confirmed!=null){value.coverage_confirmed_at=input.coverage_confirmed===true?Date.now():null;}
  if(input.freight_zones){if(!Array.isArray(input.freight_zones)||input.freight_zones.length!==3)throw new Problem('Se requieren tres zonas');let min=0;for(let i=0;i<3;i++){const z=input.freight_zones[i];if(z.id!==i+1||![2000,3950,7900].includes(z.usd_cents)||z.usd_cents!==[2000,3950,7900][i]||!Number.isFinite(z.max_km)||z.max_km<=min||z.max_km>500)throw new Problem('Zonas inválidas');min=z.max_km;}value.freight_zones=input.freight_zones;value.coverage_confirmed_at=null;}
  const changed=await db.prepare('UPDATE pcc_settings SET value=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(value),old.version).run();if(!changed.meta.changes)throw new Problem('La configuración cambió',409);
  await audit(db,'settings_updated','settings',{version:old.version+1});return json({ok:true});
 }
 throw new Problem('Recurso no encontrado',404);
}
