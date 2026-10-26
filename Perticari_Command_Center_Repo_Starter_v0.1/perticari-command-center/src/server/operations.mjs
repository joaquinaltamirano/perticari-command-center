import { draftIssues } from '../domain/catalog.mjs';
import { simulatePrice } from '../domain/money.mjs';
import { ml,ownItem,sellerId,mapItem } from './mercadolibre.mjs';
import { digest } from './oauth.mjs';
import { audit,productRow,settings,listingStatement,policies } from './db.mjs';
import { Problem } from './security.mjs';
export function answerSuggestion(question,product){
 const text=question.text.toLowerCase();let suggested='Hola. ¿Qué cantidad y presentación necesitás? Podemos revisar la opción correspondiente.';const evidence=[];
 if(/env[ií]o|entrega|flete|provincia/.test(text)) {suggested='Hola. ¿En qué localidad necesitás recibir el pedido? Tenemos reparto local y podemos entregar sin cargo en agencias de La Boca/Barracas para coordinar el transporte a tu región.';evidence.push('Política de entregas confirmada por el administrador');}
 else if(/stock|disponib|cantidad/.test(text)){suggested='Hola. Indicanos la cantidad y medida que necesitás para confirmar disponibilidad y coordinar la entrega.';evidence.push('Disponibilidad física requiere confirmación');}
 else if(product?.unit==='barra'&&product.length&&/largo|longitud|metros|medida/.test(text)){suggested=`Hola. La presentación indicada para este producto es una barra de ${product.length} metros. ¿Qué cantidad necesitás?`;evidence.push('Presentación identificada en el título: '+product.name);}
 else if(product?.unit==='hoja'&&/hoja|unidad|presenta/.test(text)){suggested='Hola. Este producto se comercializa por hoja. ¿Qué cantidad necesitás?';evidence.push('Regla de presentación por familia aprobada');}
 return {suggested,evidence,warnings:['Revisar antes de enviar. No confirma stock físico, precio ni fecha de entrega.'],engine:'reglas_con_fuentes'};
}
export async function approveOperation(db,env,input){
 if(!['publish','price','answer','pause'].includes(input.kind)||typeof input.target!=='string'||input.target.length>100)throw new Problem('Acción inválida');
 if(input.confirm!==true)throw new Problem('Confirmá la aprobación de la acción');
 let payload;
 if(input.kind==='publish'){
  const draft=await db.prepare('SELECT * FROM pcc_drafts WHERE id=?').bind(input.target).first();
  if(!draft||draft.version!==input.version)throw new Problem('La propuesta cambió; volvé a revisarla',409);
  payload=JSON.parse(draft.payload);const issues=draftIssues(payload);if(issues.length)throw new Problem(issues.join(' · '),409);
  if(!draft.validation||JSON.parse(draft.validation).version!==draft.version)throw new Problem('Validar la propuesta contra Mercado Libre antes de aprobar',409);
  if((await db.prepare("SELECT id FROM pcc_listings WHERE sku=? OR EXISTS (SELECT 1 FROM json_each(pcc_listings.payload,'$.variations') WHERE json_extract(value,'$.sku')=?)").bind(draft.sku,draft.sku).first()))throw new Problem('El SKU ya tiene publicaciones. Revisar presentación antes de crear otra.',409);
  await checkPublishPrice(db,payload);
  payload={...payload,draft_version:draft.version};
 }else if(input.kind==='price'){
  if(input.presentation_confirmed!==true)throw new Problem('Confirmar que la publicación vende la presentación del precio base',409);
  const listing=await db.prepare('SELECT * FROM pcc_listings WHERE id=?').bind(input.target).first();
  const raw=listing?.sku&&await db.prepare('SELECT * FROM pcc_products WHERE sku=?').bind(listing.sku).first();
  if(!raw)throw new Problem('Falta producto conciliado');
  const simulation=simulatePrice(productRow(raw),await settings(db));
  if(!simulation.executable)throw new Problem(simulation.reasons.join(' · '),409);
  if(input.price_cents!==simulation.proposed_cents)throw new Problem('El precio calculado cambió; revisalo de nuevo',409);
  if(listing.source!=='mercadolibre')throw new Problem('Sincronizar la publicación real antes de modificarla',409);
  payload={price_cents:simulation.proposed_cents,expected_cents:listing.price_cents,sku:listing.sku,product_updated:raw.updated};
 }else if(input.kind==='pause'){
  const listing=await db.prepare('SELECT * FROM pcc_listings WHERE id=?').bind(input.target).first();
  if(!listing||listing.source!=='mercadolibre'||typeof input.reason!=='string'||input.reason.trim().length<5||input.reason.length>500)throw new Problem('Sincronizá la publicación e indicá el motivo de pausa');
  payload={reason:input.reason.trim(),expected_status:listing.status};
 }else{
  const question=await db.prepare('SELECT * FROM pcc_questions WHERE id=?').bind(input.target).first();
  if(!question||question.status!=='UNANSWERED')throw new Problem('La pregunta ya no está pendiente',409);
  const text=String(input.text||'').trim();if(!text||text.length>2000)throw new Problem('La respuesta debe tener entre 1 y 2000 caracteres');
  payload={text,item_id:question.item_id};
 }
 const id=await digest(input.kind+':'+input.target+':'+JSON.stringify(payload));
 const prior=await db.prepare('SELECT * FROM pcc_operations WHERE id=?').bind(id).first();
 if(prior){
  if(prior.status==='failed'||prior.status==='approved'&&Date.now()-prior.created>86400000){const r=await db.prepare("UPDATE pcc_operations SET status='approved',result=NULL,created=?,updated=? WHERE id=? AND updated=? AND status=?").bind(Date.now(),Date.now(),id,prior.updated,prior.status).run();if(!r.meta.changes)throw new Problem('La acción cambió; recargá',409);await audit(db,'operation_reapproved',id,{kind:input.kind});return {id,status:'approved'};}
  return {id,status:prior.status,repeated:true};
 }
 const now=Date.now();await db.prepare('INSERT INTO pcc_operations VALUES (?,?,?,?,?,?,?,?)').bind(id,input.kind,input.target,'approved',JSON.stringify(payload),null,now,now).run();
 await audit(db,'operation_approved',id,{kind:input.kind,target:input.target});
 return {id,status:'approved',enabled:env.PCC_ENABLE_ML_WRITES==='true'&&env.PCC_ML_CONTRACT_VERIFIED==='true'};
}
export async function executeOperation(db,env,id){
 if((await policies(db)).read_only)throw new Problem('Modo solo lectura: las escrituras están suspendidas',409);
 if(env.PCC_ENABLE_ML_WRITES!=='true'||env.PCC_ML_CONTRACT_VERIFIED!=='true')throw new Problem('La acción está aprobada. Falta habilitar el piloto y validar el contrato de la API en el despliegue.',409);
 const operation=await db.prepare('SELECT * FROM pcc_operations WHERE id=?').bind(id).first();
 if(!operation)throw new Problem('Acción no encontrada',404);
 if(operation.status==='approved'&&Date.now()-operation.created>86400000)throw new Problem('La aprobación venció; revisar y aprobar una nueva intención',409);
 if(operation.status==='confirmed')return {status:'confirmed',repeated:true};
 const claimed=await db.prepare("UPDATE pcc_operations SET status='running',updated=? WHERE id=? AND status='approved'").bind(Date.now(),id).run();
 if(!claimed.meta.changes)throw new Problem('Acción en curso o pendiente de reconciliación; no se reenviará',409);
 const payload=JSON.parse(operation.payload);let result={},sent=false;
 try{
  if(operation.kind==='answer'){
   const q=await ml(env,db,'/questions/'+operation.target);
   if(String(q.seller_id)!==await sellerId(db)||q.item_id!==payload.item_id||q.status!=='UNANSWERED')throw new Problem('La pregunta cambió o ya fue respondida',409);
   sent=true;await ml(env,db,'/answers',{method:'POST',data:{question_id:Number(operation.target),text:payload.text},allowWrite:true});
   const check=await ml(env,db,'/questions/'+operation.target);
   if(check.status!=='ANSWERED'||check.answer?.text!==payload.text)throw new Problem('El envío necesita verificación',409);
   await db.prepare("UPDATE pcc_questions SET status='ANSWERED',answer=?,source_at=? WHERE id=?").bind(payload.text,Date.now(),operation.target).run();
  }else if(operation.kind==='price'){
   const product=await db.prepare('SELECT * FROM pcc_products WHERE sku=?').bind(payload.sku).first();
   const simulation=product&&simulatePrice(productRow(product),await settings(db));
   if(!simulation?.executable||product.updated!==payload.product_updated||simulation.proposed_cents!==payload.price_cents)throw new Problem('Cambió la fuente del precio; preparar otra propuesta',409);
   const item=await ownItem(env,db,operation.target);
   if(item.user_product_id||item.variations?.length)throw new Problem('Esta publicación requiere validar su modelo de variantes/User Products antes de cambiar el precio',409);
   if(mapItem(item).sku!==payload.sku||item.currency_id!=='ARS'||Math.round(item.price*100)!==payload.expected_cents)throw new Problem('El precio remoto cambió; sincronizar y revisar',409);
   sent=true;await ml(env,db,'/items/'+operation.target,{method:'PUT',data:{price:payload.price_cents/100},allowWrite:true});
   const check=await ownItem(env,db,operation.target);if(Math.round(check.price*100)!==payload.price_cents)throw new Problem('El precio requiere verificación',409);
   await listingStatement(db,mapItem(check)).run();
  }else if(operation.kind==='pause'){
   const item=await ownItem(env,db,operation.target);if(!['active','paused'].includes(item.status))throw new Problem('La publicación no admite esta pausa',409);
   if(item.status!=='paused'){sent=true;await ml(env,db,'/items/'+operation.target,{method:'PUT',data:{status:'paused'},allowWrite:true});}
   const check=await ownItem(env,db,operation.target);if(check.status!=='paused')throw new Problem('La pausa necesita reconciliación',409);await listingStatement(db,mapItem(check)).run();
  }else{
   const draft=await db.prepare('SELECT * FROM pcc_drafts WHERE id=?').bind(operation.target).first();
   if(!draft||draft.version!==payload.draft_version)throw new Problem('La propuesta cambió; aprobar de nuevo',409);
   await checkPublishPrice(db,payload);
   if(!draft.validation||Date.now()-JSON.parse(draft.validation).at>86400000)throw new Problem('La validación remota venció; validar nuevamente',409);
   sent=true;const created=await ml(env,db,'/items',{method:'POST',allowWrite:true,data:itemPayload(payload)});
   if(!/^MLA\d+$/.test(created.id))throw new Problem('La creación necesita reconciliación',409);
   result={remote_id:created.id};
   await db.prepare('UPDATE pcc_operations SET result=? WHERE id=?').bind(JSON.stringify(result),id).run();
   const check=await ownItem(env,db,created.id);if(check.seller_custom_field!==payload.sku && !(check.attributes||[]).some(a=>a.id==='SELLER_SKU'&&a.value_name===payload.sku))throw new Problem('Verificar el SKU de la nueva publicación',409);
   await listingStatement(db,mapItem(check)).run();
   if(payload.description){await ml(env,db,'/items/'+created.id+'/description',{method:'POST',allowWrite:true,data:{plain_text:payload.description}});const description=await ml(env,db,'/items/'+created.id+'/description');if(description.plain_text!==payload.description)throw new Problem('La descripción requiere reconciliación',409);}
   await db.prepare("UPDATE pcc_drafts SET status='published' WHERE id=?").bind(operation.target).run();
  }
  await db.prepare("UPDATE pcc_operations SET status='confirmed',result=?,updated=? WHERE id=?").bind(JSON.stringify(result),Date.now(),id).run();
  await audit(db,'operation_confirmed',id,result);return {status:'confirmed',...result};
 }catch(error){
  const status=sent?'reconciliation':'failed';
  await db.prepare('UPDATE pcc_operations SET status=?,result=?,updated=? WHERE id=?').bind(status,JSON.stringify({...result,message:error.message}),Date.now(),id).run();
  await audit(db,'operation_'+status,id,{message:error.message});throw error;
 }
}
export function itemPayload(d){return {title:d.title,category_id:d.category_id,price:d.price_cents/100,currency_id:d.currency_id,
 available_quantity:d.quantity,buying_mode:d.buying_mode,listing_type_id:d.listing_type_id,condition:d.condition,
 seller_custom_field:d.sku,pictures:d.pictures,attributes:d.attributes};}

export async function reconcileOperation(db,env,id){
 const op=await db.prepare('SELECT * FROM pcc_operations WHERE id=?').bind(id).first();if(!op)throw new Problem('Acción no encontrada',404);
 if(op.status==='confirmed')return {status:'confirmed',repeated:true};
 if(op.status!=='reconciliation')throw new Problem('La acción no está pendiente de reconciliación',409);
 const p=JSON.parse(op.payload),r=op.result?JSON.parse(op.result):{};
 if(op.kind==='answer'){
  const q=await ml(env,db,'/questions/'+op.target);if(String(q.seller_id)!==await sellerId(db)||q.item_id!==p.item_id)throw new Problem('No se pudo verificar la pertenencia',403);
  if(q.status!=='ANSWERED'||q.answer?.text!==p.text)throw new Problem('La lectura no confirma el resultado esperado. Revisá Mercado Libre; no se reenviará.',409);
  await db.prepare("UPDATE pcc_questions SET status='ANSWERED',answer=?,source_at=? WHERE id=?").bind(p.text,Date.now(),op.target).run();
 }else{
  const remoteId=op.kind==='publish'?r.remote_id:op.target;if(!remoteId)throw new Problem('La creación no devolvió ID. Revisá el catálogo de Mercado Libre antes de resolver manualmente; no se creará otra publicación.',409);
  const item=await ownItem(env,db,remoteId),mapped=mapItem(item);
  if(op.kind==='price'&&mapped.price_cents!==p.price_cents||op.kind==='pause'&&item.status!=='paused'||op.kind==='publish'&&mapped.sku!==p.sku)throw new Problem('El estado remoto no confirma la acción; requiere revisión humana',409);
  if(op.kind==='publish'&&p.description)throw new Problem('La publicación existe; revisar además su descripción y completar la intervención manualmente. No se repetirá la creación.',409);
  await listingStatement(db,mapped).run();if(op.kind==='publish')await db.prepare("UPDATE pcc_drafts SET status='published' WHERE id=?").bind(op.target).run();
 }
 await db.prepare("UPDATE pcc_operations SET status='confirmed',updated=? WHERE id=? AND status='reconciliation'").bind(Date.now(),id).run();await audit(db,'operation_reconciled',id,{kind:op.kind});return {status:'confirmed'};
}

async function checkPublishPrice(db,payload){
 const raw=await db.prepare('SELECT * FROM pcc_products WHERE sku=?').bind(payload.sku).first(),sim=raw&&simulatePrice(productRow(raw),await settings(db));
 if(!sim?.executable)throw new Problem('Confirmar fuente, presentación y cargos vigentes antes de publicar: '+(sim?.reasons.join(' · ')||'Falta producto de origen'),409);
 if(sim.proposed_cents!==payload.price_cents)throw new Problem('El precio del borrador difiere de la fórmula vigente; actualizar y validar nuevamente',409);
}
