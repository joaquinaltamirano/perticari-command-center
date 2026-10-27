import {simulatePrice} from './money.mjs';

export const defaultAutomationPolicy={enabled:false,max_change_bps:500,max_daily_bps:1000,source_max_age_hours:8,run_every_minutes:15,targets:[],activated_at:null};
export function evaluateAutomaticPrice({product,listing,config,policy,run,movements=[],now=Date.now()}){
 const reasons=[],target=policy.targets?.find(t=>t.id===listing.id),payload=typeof listing.payload==='string'?JSON.parse(listing.payload||'{}'):listing.payload||{};
 if(!target)reasons.push('Publicación no incluida en la regla aprobada');
 if(listing.source!=='mercadolibre'||listing.status!=='active')reasons.push('Falta publicación activa sincronizada desde Mercado Libre');
 if(!product||listing.sku!==product.sku||product.sku!==target?.sku)reasons.push('Vinculación de producto pendiente');
 if(payload.user_product_id||payload.variations?.length)reasons.push('Modelo User Products o variantes pendiente de contrato específico');
 if(payload.original_price||payload.sale_price||payload.promotion_active||payload.prices?.length||payload.tags?.some(t=>/promotion|deal|discount/i.test(t)))reasons.push('Promoción o precio efectivo requiere revisión');
 if(product){
  if(product.unit!==target?.unit||product.currency!==target?.currency||product.length!==target?.length)reasons.push('Cambió la presentación aprobada');
  if(product.source!=='memosoft'||!run||run.status!=='complete'||now-run.finished>policy.source_max_age_hours*3600000||product.source_at!==run.finished)reasons.push('Precio sin lectura completa y vigente de MEMOSOFT');
  if(product.technical?.conflicto_origen)reasons.push('Producto de origen ambiguo');
 }
 const simulation=product?simulatePrice({...product,price_confirmed:true},config,now):null;
 if(!simulation?.executable)reasons.push(...(simulation?.reasons||['Falta precio de origen']));
 if(!Number.isSafeInteger(listing.price_cents)||listing.price_cents<=0)reasons.push('Falta precio remoto comparable');
 const proposed=simulation?.proposed_cents,delta=proposed&&listing.price_cents>0?Math.ceil(Math.abs(proposed-listing.price_cents)*10000/listing.price_cents):null;
 const cumulative=movements.filter(m=>m.created>now-86400000&&m.status!=='failed').reduce((s,m)=>s+m.change_bps,0);
 if(delta!=null&&delta>policy.max_change_bps)reasons.push('Variación mayor al límite por cambio');
 if(delta!=null&&cumulative+delta>policy.max_daily_bps)reasons.push('Variación acumulada mayor al límite de 24 horas');
 return {eligible:!reasons.length,unchanged:proposed===listing.price_cents,proposed_cents:proposed??null,change_bps:delta,cumulative_bps:cumulative,reasons:[...new Set(reasons)]};
}

export function validateAutomationPolicy(input,old=defaultAutomationPolicy){
 const next={...old};
 for(const k of ['max_change_bps','max_daily_bps'])if(input[k]!=null){if(!Number.isInteger(input[k])||input[k]<1||input[k]> (k==='max_change_bps'?500:1000))throw Object.assign(new Error('Límite automático fuera del máximo aprobado'),{status:400});next[k]=input[k];}
 if(input.source_max_age_hours!=null){if(!Number.isInteger(input.source_max_age_hours)||input.source_max_age_hours<1||input.source_max_age_hours>8)throw Object.assign(new Error('Vigencia de fuente inválida'),{status:400});next.source_max_age_hours=input.source_max_age_hours;}
 if(input.enabled!=null){if(typeof input.enabled!=='boolean')throw Object.assign(new Error('Estado de automatización inválido'),{status:400});next.enabled=input.enabled;}
 return next;
}
