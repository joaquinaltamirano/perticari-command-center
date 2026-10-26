import { channelCoverage } from '../domain/coverage.mjs';
import { json,Problem } from './security.mjs';
import { policies,audit } from './db.mjs';
import { saveKnowledge,saveFeedback,suggest } from './intelligence.mjs';
import { schedule } from './jobs.mjs';
export async function v2State(db){
 const [orders,knowledge,suggestions,feedback,experiments,usage,policy,runtime]=await Promise.all([
 db.prepare('SELECT * FROM pcc_orders ORDER BY created_at DESC LIMIT 1000').all(),db.prepare('SELECT * FROM pcc_knowledge ORDER BY updated DESC LIMIT 500').all(),db.prepare('SELECT * FROM pcc_suggestions ORDER BY created DESC LIMIT 100').all(),db.prepare('SELECT * FROM pcc_feedback ORDER BY created DESC LIMIT 100').all(),db.prepare('SELECT * FROM pcc_experiments ORDER BY updated DESC LIMIT 100').all(),db.prepare('SELECT day,COUNT(*) calls,SUM(input_tokens) input_tokens,SUM(output_tokens) output_tokens,SUM(MAX(reserved_microusd,COALESCE(actual_microusd,0))) budget_used_microusd,SUM(actual_microusd) actual_microusd FROM pcc_ai_usage GROUP BY day ORDER BY day DESC LIMIT 7').all(),policies(db),db.prepare("SELECT updated FROM pcc_runtime WHERE id='scheduler'").first()]);
 return {orders:orders.results.map(o=>({...o,items:JSON.parse(o.items)})),knowledge:knowledge.results,suggestions:suggestions.results.map(s=>({...s,evidence:JSON.parse(s.evidence),warnings:JSON.parse(s.warnings)})),feedback:feedback.results,experiments:experiments.results,usage:usage.results,policy,scheduler_at:runtime?.updated||null};
}
export async function v2Route(path,input,db,env,ctx){
 if(path==='/api/pcc/v2/pricing/coverage'){try{return json(channelCoverage(input));}catch(e){throw new Problem(e.message);}}
 if(path==='/api/pcc/v2/tick'){ctx.waitUntil(schedule(env,db));return json({requested:true});}
 if(path==='/api/pcc/v2/knowledge/save')return json(await saveKnowledge(db,input));
 if(path==='/api/pcc/v2/feedback')return json(await saveFeedback(db,input));
 if(path==='/api/pcc/v2/suggest')return json(await suggest(db,env,input));
 if(path==='/api/pcc/v2/policy'){
  const old=await policies(db);if(old.version!==input.version)throw new Problem('Las políticas cambiaron; recargá',409);
  const next={...old};delete next.version;
  for(const k of ['read_only','pause_jobs','ai_enabled','auto_questions','auto_memosoft'])if(input[k]!=null){if(typeof input[k]!=='boolean')throw new Problem('Política inválida');next[k]=input[k];}
  for(const k of ['ai_daily_limit_microusd','ai_input_microusd_per_million','ai_output_microusd_per_million'])if(input[k]!=null){if(!Number.isSafeInteger(input[k])||input[k]<0||input[k]>1000000000000)throw new Problem('Límite o tarifa inválida');next[k]=input[k];}
  if(input.ai_model!=null){if(typeof input.ai_model!=='string'||!/^[a-zA-Z0-9._:-]{0,100}$/.test(input.ai_model))throw new Problem('Modelo inválido');next.ai_model=input.ai_model;}
  if(input.response_target_minutes!=null){if(!Number.isInteger(input.response_target_minutes)||input.response_target_minutes<1||input.response_target_minutes>1440)throw new Problem('Objetivo de atención inválido');next.response_target_minutes=input.response_target_minutes;}
  if(next.ai_enabled&&(!env.OPENAI_API_KEY||!next.ai_model||next.ai_daily_limit_microusd<=0||next.ai_input_microusd_per_million<=0||next.ai_output_microusd_per_million<=0))throw new Problem('Para habilitar IA configurá el secreto OPENAI_API_KEY en Cloudflare, modelo, tarifas y presupuesto positivo.');
  const r=await db.prepare('UPDATE pcc_policy SET value=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(next),old.version).run();if(!r.meta.changes)throw new Problem('Las políticas cambiaron',409);
  await audit(db,'policy_updated','policy',{version:old.version+1,ai_enabled:next.ai_enabled,read_only:next.read_only,pause_jobs:next.pause_jobs});return json({ok:true});
 }
 if(path==='/api/pcc/v2/orders/update'){
  const order=await db.prepare('SELECT * FROM pcc_orders WHERE id=?').bind(input.id).first();if(!order)throw new Problem('Pedido no encontrado',404);
  if(!['pending','confirmed','unavailable'].includes(input.availability)||!['new','preparing','coordinating','delivered','incident'].includes(input.stage)||typeof input.note!=='string'||input.note.length>2000)throw new Problem('Estado de pedido inválido');
  if(['preparing','coordinating','delivered'].includes(input.stage)&&input.availability!=='confirmed')throw new Problem('Confirmá disponibilidad real antes de preparar o entregar',409);
  if(order.status==='cancelled'&&input.stage!=='incident')throw new Problem('El pedido está cancelado en Mercado Libre; revisar como incidente',409);
  const changed=await db.prepare('UPDATE pcc_orders SET availability=?,stage=?,note=?,version=version+1,confirmed_at=? WHERE id=? AND version=?').bind(input.availability,input.stage,input.note,input.availability==='confirmed'?order.confirmed_at||Date.now():null,order.id,input.version).run();if(!changed.meta.changes)throw new Problem('El pedido cambió; recargá',409);
  await audit(db,'order_review',order.id,{availability:input.availability,stage:input.stage});return json({ok:true});
 }
 if(path==='/api/pcc/v2/experiments/save'){
  const e=input.value;if(!e||['title','hypothesis','metric','baseline','plan','result'].some(k=>typeof e[k]!=='string'||e[k].length>(k==='title'?180:4000))||!e.title.trim()||!e.hypothesis.trim()||!e.metric.trim()||!['proposed','running','completed','cancelled'].includes(e.status))throw new Problem('Experimento incompleto o inválido');
  const id=input.id||crypto.randomUUID(),now=Date.now(),old=await db.prepare('SELECT * FROM pcc_experiments WHERE id=?').bind(id).first();
  if(old){const r=await db.prepare('UPDATE pcc_experiments SET title=?,hypothesis=?,metric=?,baseline=?,plan=?,result=?,status=?,version=version+1,updated=? WHERE id=? AND version=?').bind(e.title,e.hypothesis,e.metric,e.baseline,e.plan,e.result,e.status,now,id,input.version).run();if(!r.meta.changes)throw new Problem('El experimento cambió',409);}
  else await db.prepare('INSERT INTO pcc_experiments VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,e.title,e.hypothesis,e.metric,e.baseline,e.plan,e.result,e.status,1,now,now).run();
  await audit(db,'experiment_saved',id,{status:e.status});return json({id});
 }
 throw new Problem('Recurso no encontrado',404);
}
