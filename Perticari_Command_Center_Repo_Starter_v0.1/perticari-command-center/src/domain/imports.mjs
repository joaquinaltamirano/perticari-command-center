import { cents } from './money.mjs';
import { familyOf, presentationOf, normalize } from './catalog.mjs';
export function normalizeRows(rows, mapping = {}, sourceAt = null) {
  if(!Array.isArray(rows)||rows.length>10000)throw new Error('El archivo debe tener hasta 10.000 filas');
  const problems=[], products=[], seen=new Set();
  const names={sku:['Código','SKU','d6prod'],name:['Producto','Descripción','d6desc'],price:['Precio Original','precio_base','Precio']};
  const read=(row,key)=>{const header=mapping[key]||names[key].find(h=>Object.hasOwn(row,h));return header ? row[header] : undefined;};
  rows.forEach((row,index)=>{
    const sku=String(read(row,'sku')??'').trim(),name=String(read(row,'name')??'').trim();
    if(!sku||sku.length>100||!name||name.length>600){problems.push({row:index+2,sku,reason:'Código o descripción ausente o inválido'});return;}
    if(seen.has(sku)){problems.push({row:index+2,sku,reason:'Código duplicado: requiere revisión'});return;}
    seen.add(sku);let base=null;
    try{base=cents(read(row,'price'));if(base===0)base=null;}catch{problems.push({row:index+2,sku,reason:'Precio inválido; se importará sin precio'});}
    const family=familyOf(name,sku),presentation=presentationOf(name,family);
    products.push({sku,name,family,unit:presentation.unit,length:presentation.length,base_cents:base,currency:'ARS',
      price_confirmed:false,source_at:sourceAt,source:'import',technical:{}});
  });
  return {products,problems,blocking:problems.some(p=>/duplicado|descripción/.test(p.reason))};
}
export function normalizeSnapshot(data) {
  if(!Array.isArray(data.products)||data.products.length>10000)throw new Error('Snapshot inválido');
  const seen=new Set();
  for(const p of data.products){
    if(typeof p.sku!=='string'||!p.sku||p.sku.length>100||seen.has(p.sku)||typeof p.name!=='string'||p.name.length>600)throw new Error('Productos duplicados o inválidos');
    seen.add(p.sku);
    if(p.base_cents!=null&&(!Number.isSafeInteger(p.base_cents)||p.base_cents<=0))throw new Error('Precio inválido');
    if(JSON.stringify(p.technical||{}).length>16000)throw new Error('Información técnica demasiado extensa');
    if(p.source_at!=null&&(!Number.isSafeInteger(p.source_at)||p.source_at<0||p.source_at>Date.now()))throw new Error('Fecha de origen inválida');
    p.price_confirmed=false; p.currency=p.currency==='ARS'?'ARS':null;
    p.family=familyOf(p.name,p.sku);const presentation=presentationOf(p.name,p.family);p.unit=presentation.unit;p.length=presentation.length;
  }
  const listings=Array.isArray(data.listings)?data.listings:[];
  if(listings.length+data.products.length>10000||listings.some(l=>!/^MLA\d+$/.test(l.id)))throw new Error('Publicaciones inválidas');
  return {products:data.products,listings,problems:[],blocking:false};
}
