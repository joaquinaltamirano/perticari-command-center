import { policies } from './db.mjs';
import { oauthConnection, oauthConfig, decryptValue, refreshOAuth } from './oauth.mjs';
import { Problem } from './security.mjs';
export async function ml(env,db,path,{method='GET',data,allowWrite=false,context}={}){
 if(!/^\/(?:users|items|questions|answers|categories|orders|sites)\//.test(path) && !['/items','/items/validate','/answers'].includes(path))throw new Problem('Recurso no permitido');
 if(path.includes('..')||path.includes('://')||path.includes('#'))throw new Problem('Ruta inválida');
 if(method!=='GET'&&path!=='/items/validate'&&(!allowWrite||env.PCC_ENABLE_ML_WRITES!=='true'))throw new Problem('La ejecución en Mercado Libre está deshabilitada. El lote queda preparado.',409);
 if(method!=='GET'&&path!=='/items/validate'&&(await policies(db)).read_only)throw new Problem('Modo solo lectura: escritura suspendida',409);
 const {tokens}=context||await accessContext(env,db);
 let response;
 try{response=await fetch('https://api.mercadolibre.com'+path,{method,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{authorization:'Bearer '+tokens.access_token,accept:'application/json',...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});}
 catch{const e=new Problem(method==='GET'?'Mercado Libre no respondió; se puede reintentar.':'Resultado incierto: reconciliar antes de volver a enviar.',503);e.uncertain=method!=='GET';throw e;}
 if(!response.ok){const e=new Problem(response.status===429?'Límite de consultas de Mercado Libre. Se reintentará.':`Mercado Libre rechazó la solicitud (${response.status}). Revisar permisos y datos.`,response.status===429?429:502);e.remote_status=response.status;e.uncertain=method!=='GET'&&response.status>=500;throw e;}
 try{return await response.json();}catch{const e=new Problem('Respuesta de Mercado Libre no interpretable',502);e.uncertain=method!=='GET';throw e;}
}
export async function sellerId(db){const row=await oauthConnection(db);if(!row)throw new Problem('Cuenta no conectada',409);return row.seller_id;}
export function mapItem(item){
 if(!/^MLA\d+$/.test(item.id))throw new Problem('Identificador remoto inválido',502);
 const attr=(item.attributes||[]).find(a=>a.id==='SELLER_SKU');
 const sku=item.seller_custom_field || attr?.value_name || null;
 return {id:item.id,sku,title:item.title||item.family_name||'',status:item.status,price_cents:item.price==null?null:Math.round(item.price*100),currency:item.currency_id,
 category_id:item.category_id,listing_type_id:item.listing_type_id,source:'mercadolibre',source_at:Date.now(),
 payload:{seller_id:String(item.seller_id),user_product_id:item.user_product_id||null,variations:(item.variations||[]).map(v=>({id:v.id,sku:v.seller_custom_field||(v.attributes||[]).find(a=>a.id==='SELLER_SKU')?.value_name||null,attributes:v.attribute_combinations||[]})),pictures:(item.pictures||[]).map(p=>({id:p.id,source:p.secure_url||p.url})),attributes:item.attributes||[],shipping:item.shipping||{},available_quantity:item.available_quantity,permalink:item.permalink||null}};
}
export async function ownItem(env,db,id){
 if(!/^MLA\d+$/.test(id))throw new Problem('Publicación inválida');
 const item=await ml(env,db,'/items/'+id),seller=await sellerId(db);
 if(String(item.seller_id)!==seller)throw new Problem('La publicación no pertenece a la cuenta conectada',403);
 return item;
}

async function accessContext(env,db){
 let connection=await oauthConnection(db);const c=oauthConfig(env);
 if(!connection||connection.application_id!==c.application)throw new Problem('Conectá Mercado Libre desde Conexión',409);
 if(connection.expires<Date.now()+120000){
   const status=await refreshOAuth(env);
   if(!['still_valid','refreshed'].includes(status))throw new Problem('Renová la conexión desde /connect',409);
   connection=await oauthConnection(db);
 }
 const tokens=await decryptValue(connection.tokens,c);
 if(connection.expires<=Date.now())throw new Problem('La autorización venció; volvé a conectar',409);
 return {tokens,seller_id:connection.seller_id};
}
export async function readClient(env,db){const context=await accessContext(env,db);return {seller:context.seller_id,get:path=>ml(env,db,path,{context})};}
