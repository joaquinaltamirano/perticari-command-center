import { normalizeRows,normalizeSnapshot } from '../domain/imports.mjs';
import { digest } from './oauth.mjs';
import { batch,productStatement,listingStatement,audit } from './db.mjs';
import { Problem } from './security.mjs';
export async function previewImport(db,input){
 if(typeof input.filename!=='string'||input.filename.length>180)throw new Problem('Nombre de archivo inválido');
 const serialized=JSON.stringify(input.data??input.rows),hash=await digest(serialized);
 const existing=await db.prepare('SELECT * FROM pcc_imports WHERE hash=?').bind(hash).first();
 if(existing)return {id:existing.id,status:existing.status,...JSON.parse(existing.summary),repeated:true};
 const normalized=input.data?normalizeSnapshot(input.data):normalizeRows(input.rows,input.mapping,input.source_at||null);
 const {products,listings=[],problems,blocking}=normalized;
 const existingProducts=(await db.prepare("SELECT sku,name,base_cents,currency FROM pcc_products WHERE sku IN (SELECT json_extract(value,'$.sku') FROM json_each(?))").bind(JSON.stringify(products.map(p=>({sku:p.sku})))).all()).results;
 const changes=products.map(p=>{const old=existingProducts.find(o=>o.sku===p.sku);return old&&old.base_cents!==p.base_cents?{sku:p.sku,previous_cents:old.base_cents,public_cents:p.base_cents,change_bps:old.base_cents&&p.base_cents?Math.round((p.base_cents-old.base_cents)*10000/old.base_cents):null}:null;}).filter(Boolean);
 const id=crypto.randomUUID(),summary={price_changes:changes.length,changes:changes.slice(0,30),products:products.length,listings:listings.length,missing_prices:products.filter(p=>p.base_cents==null).length,problems,blocking,
 source_at:input.source_at||null,sample:products.slice(0,8).map(p=>({sku:p.sku,name:p.name,base_cents:p.base_cents,unit:p.unit}))};
 const statements=[];
 for(const [kind,records] of [['product',products],['listing',listings]])for(let i=0;i<records.length;i+=500){
  const payload=JSON.stringify(records.slice(i,i+500));
  if(payload.length>700000)throw new Problem('Datos técnicos demasiado grandes para un bloque de importación');
  statements.push(db.prepare('INSERT INTO pcc_import_rows VALUES (?,?,?,?)').bind(id,kind,String(i),payload));
 }
 await db.prepare('INSERT INTO pcc_imports VALUES (?,?,?,?,?,?,NULL)').bind(id,hash,input.filename,'preview',JSON.stringify(summary),Date.now()).run();
 try{await batch(db,statements);}catch{await db.prepare('DELETE FROM pcc_import_rows WHERE batch=?').bind(id).run();await db.prepare('DELETE FROM pcc_imports WHERE id=?').bind(id).run();throw new Problem('No se pudo preparar el archivo; volvé a importarlo',503);}
 return {id,status:'preview',...summary};
}
export async function applyImport(db,id){
 const record=await db.prepare('SELECT * FROM pcc_imports WHERE id=?').bind(id).first();
 if(!record)throw new Problem('Importación no encontrada',404);
 if(record.status==='applied')return {applied:true,repeated:true};
 const summary=JSON.parse(record.summary);if(summary.blocking)throw new Problem('Resolver filas duplicadas o incompletas antes de confirmar',409);
 const claimed=await db.prepare("UPDATE pcc_imports SET status='applying' WHERE id=? AND status='preview'").bind(id).run();
 if(!claimed.meta.changes)throw new Problem('La importación se está aplicando',409);
 try{
  const rows=(await db.prepare('SELECT kind,payload FROM pcc_import_rows WHERE batch=?').bind(id).all()).results;
  await batch(db,rows.flatMap(row=>row.kind==='product'?[priceHistoryStatement(db,row.payload),groupStatement(db,row.kind,row.payload)]:[groupStatement(db,row.kind,row.payload)]));
  await db.prepare("UPDATE pcc_imports SET status='applied',applied=? WHERE id=?").bind(Date.now(),id).run();
  await db.prepare('INSERT INTO pcc_sources VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_attempt=excluded.last_attempt,last_success=excluded.last_success,detail=excluded.detail').bind('catalog','imported',Date.now(),summary.source_at,record.filename).run();
  await audit(db,'import_applied',id,{products:summary.products,listings:summary.listings});
  return {applied:true,...summary};
 }catch(e){await db.prepare("UPDATE pcc_imports SET status='preview' WHERE id=?").bind(id).run();throw e;}
}

export function groupStatement(db,kind,payload){
 if(kind==='product')return db.prepare(`INSERT INTO pcc_products (sku,name,family,unit,length,base_cents,currency,price_confirmed,source_at,source,technical,updated)
 SELECT json_extract(value,'$.sku'),json_extract(value,'$.name'),COALESCE(json_extract(value,'$.family'),'Por clasificar'),json_extract(value,'$.unit'),json_extract(value,'$.length'),json_extract(value,'$.base_cents'),json_extract(value,'$.currency'),0,json_extract(value,'$.source_at'),COALESCE(json_extract(value,'$.source'),'import'),COALESCE(json_extract(value,'$.technical'),'{}'),?
 FROM json_each(?) WHERE 1 ON CONFLICT(sku) DO UPDATE SET name=excluded.name,family=CASE WHEN pcc_products.price_confirmed=1 THEN pcc_products.family ELSE excluded.family END,unit=COALESCE(pcc_products.unit,excluded.unit),length=COALESCE(pcc_products.length,excluded.length),base_cents=excluded.base_cents,currency=excluded.currency,price_confirmed=CASE WHEN pcc_products.base_cents=excluded.base_cents AND pcc_products.currency=excluded.currency THEN pcc_products.price_confirmed ELSE 0 END,source_at=excluded.source_at,source=excluded.source,technical=CASE WHEN excluded.technical='{}' THEN pcc_products.technical ELSE excluded.technical END,updated=excluded.updated`).bind(Date.now(),payload);
 return db.prepare(`INSERT INTO pcc_listings
 SELECT json_extract(value,'$.id'),json_extract(value,'$.sku'),COALESCE(json_extract(value,'$.title'),''),COALESCE(json_extract(value,'$.status'),'importado'),json_extract(value,'$.price_cents'),COALESCE(json_extract(value,'$.currency'),'ARS'),json_extract(value,'$.category_id'),json_extract(value,'$.listing_type_id'),COALESCE(json_extract(value,'$.source'),'import'),json_extract(value,'$.source_at'),COALESCE(json_extract(value,'$.payload'),'{}')
 FROM json_each(?) WHERE 1 ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,title=excluded.title,status=excluded.status,price_cents=excluded.price_cents,currency=excluded.currency,category_id=excluded.category_id,listing_type_id=excluded.listing_type_id,source=excluded.source,source_at=excluded.source_at,payload=excluded.payload WHERE pcc_listings.source!='mercadolibre' OR excluded.source='mercadolibre'`).bind(payload);
}

export function priceHistoryStatement(db,payload){const now=Date.now();return db.prepare(`INSERT OR IGNORE INTO pcc_price_history SELECT json_extract(j.value,'$.sku')||':'||?||':'||COALESCE(json_extract(j.value,'$.base_cents'),'none'),json_extract(j.value,'$.sku'),p.base_cents,json_extract(j.value,'$.base_cents'),json_extract(j.value,'$.currency'),COALESCE(json_extract(j.value,'$.source'),'import'),json_extract(j.value,'$.source_at'),? FROM json_each(?) j LEFT JOIN pcc_products p ON p.sku=json_extract(j.value,'$.sku') WHERE p.base_cents IS NOT json_extract(j.value,'$.base_cents') OR p.currency IS NOT json_extract(j.value,'$.currency')`).bind(now,now,payload);}
