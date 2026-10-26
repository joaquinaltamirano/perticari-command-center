export const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function intentOf(text){const t=normalize(text);if(/reclamo|devol|problema|rot[oau]|cancel|reembol/.test(t))return 'incident';if(/envio|entrega|flete|provincia|acarreo|localidad/.test(t))return 'delivery';if(/stock|disponib|cantidad/.test(t))return 'availability';if(/precio|cuanto|descuento|cotiz/.test(t))return 'price';if(/largo|medida|metro|espesor|diametro|hoja|presenta/.test(t))return 'technical';return 'general';}
export function retrieveKnowledge(entries,question,product,now=Date.now()){
 const intent=intentOf(question.text),tokens=new Set(normalize(question.text).split(/\W+/).filter(t=>t.length>3));
 return entries.filter(k=>k.status==='validated'&&k.validated_at&&(!k.expires||k.expires>now)&&(!k.family||k.family===product?.family)).map(k=>({...k,score:(k.intent===intent?10:0)+[...tokens].filter(t=>normalize(k.title+' '+k.content).includes(t)).length})).filter(k=>k.score>0).sort((a,b)=>b.score-a.score).slice(0,6);
}
export function opportunities(products,listings,drafts,questions){
 const links=new Map();for(const l of listings)for(const sku of [l.sku,...(l.payload?.variations||[]).map(v=>v.sku)].filter(Boolean)){if(!links.has(sku))links.set(sku,[]);links.get(sku).push(l);}
 const result=products.filter(p=>p.family!=='Revisar exclusión').map(p=>{
  const linked=links.get(p.sku)||[],reasons=[];if(!linked.length)reasons.push('Sin publicación vinculada');if(!p.unit)reasons.push('Presentación pendiente');if(!p.base_cents)reasons.push('Precio público ausente');if(!p.price_confirmed)reasons.push('Vigencia del precio pendiente');if(p.technical?.conflicto_origen)reasons.push('Conflicto en código de origen');
  const pending=questions.filter(q=>q.status==='UNANSWERED'&&linked.some(l=>l.id===q.item_id)).length;
  if(pending)reasons.push(pending+' consulta(s) pendiente(s)');
  const missingMedia=linked.some(l=>!l.payload?.pictures?.length);if(missingMedia)reasons.push('Imágenes por verificar');
  const blockers=reasons.filter(r=>/pendiente|ausente|Conflicto/.test(r));
  return {id:'product:'+p.sku,sku:p.sku,family:p.family,title:p.name,kind:linked.length?'quality':'expansion',score:Math.max(0,(!linked.length?50:10)+(p.unit?15:0)+(p.base_cents?10:0)+(p.price_confirmed?10:0)+Math.min(15,pending*5)-(p.technical?.conflicto_origen?40:0)),reasons,blockers,has_draft:drafts.some(d=>d.sku===p.sku&&d.status!=='published'),source_at:p.source_at||null,metric:linked.length?'Calidad y consultas atendidas':'Oferta adicional válida',hypothesis:linked.length?'Completar información y atención podría mejorar la experiencia de compra.':'Cubrir esta presentación podría captar demanda; aún no hay evidencia de ventas adicionales.',effort:blockers.length?'Revisión de datos':'Preparar propuesta',risk:'Requiere categoría, multimedia y validación de Mercado Libre'};
 }).filter(r=>r.reasons.length).sort((a,b)=>b.score-a.score||a.sku.localeCompare(b.sku));
 return result;
}
export function attentionSummary(questions,targetMinutes=30,now=Date.now()){
 const pending=questions.filter(q=>q.status==='UNANSWERED'),responseMinutes=questions.filter(q=>q.created_at&&q.answered_at&&q.answered_at>=q.created_at).map(q=>(q.answered_at-q.created_at)/60000).sort((a,b)=>a-b);
 const percentile=p=>responseMinutes.length?responseMinutes[Math.max(0,Math.ceil(responseMinutes.length*p)-1)]:null;
 return {pending:pending.length,stale:pending.filter(q=>now-q.source_at>180000).length,overdue:pending.filter(q=>q.created_at&&now-q.created_at>targetMinutes*60000).length,median_minutes:percentile(.5),p90_minutes:percentile(.9),sample:responseMinutes.length,target_minutes:targetMinutes};
}
