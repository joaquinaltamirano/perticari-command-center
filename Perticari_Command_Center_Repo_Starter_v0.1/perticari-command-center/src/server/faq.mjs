import {Problem} from './security.mjs';
import {policies,audit} from './db.mjs';
import {approveOperation,executeOperation} from './operations.mjs';
import {normalize} from '../domain/catalog.mjs';
import {exactFaqMatch} from '../domain/faq.mjs';
const ready=new WeakSet();
export async function ensureFaq(db){if(ready.has(db))return;await db.prepare('CREATE TABLE IF NOT EXISTS pcc_faq_rules (id TEXT PRIMARY KEY,question TEXT NOT NULL,knowledge_id TEXT NOT NULL,knowledge_version INTEGER NOT NULL,enabled INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL)').run();ready.add(db);}

export async function faqRoutes(env,db,path,method,input){if(!path.startsWith('/api/pcc/v3/faq/'))return null;await ensureFaq(db);const action=path.split('/').at(-1);
 if(method==='GET'&&action==='state')return {rules:(await db.prepare('SELECT * FROM pcc_faq_rules ORDER BY created DESC').all()).results};
 if(method!=='POST')throw new Problem('Método no permitido',405);
 if(action==='save'){
  const question=String(input.question||'').trim();if(question.length<5||question.length>500)throw new Problem('Ingresá la pregunta exacta, entre5 y500 caracteres');const knowledge=await db.prepare('SELECT * FROM pcc_knowledge WHERE id=?').bind(input.knowledge_id).first();if(!knowledge||knowledge.status!=='validated'||!['general','delivery'].includes(knowledge.intent)||knowledge.family||knowledge.expires&&knowledge.expires<=Date.now())throw new Problem('Elegí una referencia general o de entrega validada, vigente y sin alcance de familia. Los otros casos requieren revisión.',409);
  if(input.enabled===true){const global=await policies(db);if(input.confirm!==true||global.read_only||env.PCC_ENABLE_ML_WRITES!=='true'||env.PCC_ML_CONTRACT_VERIFIED!=='true')throw new Problem('Revisá la regla exacta y habilitá el piloto verificado antes de activarla',409);}
  const id=String(input.id||crypto.randomUUID()),now=Date.now();await db.prepare('INSERT INTO pcc_faq_rules VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,knowledge_id=excluded.knowledge_id,knowledge_version=excluded.knowledge_version,enabled=excluded.enabled,created=excluded.created,updated=excluded.updated').bind(id,question,knowledge.id,knowledge.version,input.enabled===true?1:0,now,now).run();await audit(db,'faq_rule_reviewed',id,{enabled:input.enabled===true,knowledge_id:knowledge.id,version:knowledge.version});return {id};
 }
 if(action==='disable'){await db.prepare('UPDATE pcc_faq_rules SET enabled=0,updated=? WHERE id=?').bind(Date.now(),input.id).run();return {ok:true};}
 throw new Problem('Recurso no encontrado',404);
}
export async function faqTick(env,db){await ensureFaq(db);const global=await policies(db);if(global.pause_jobs||global.read_only||env.PCC_ENABLE_ML_WRITES!=='true'||env.PCC_ML_CONTRACT_VERIFIED!=='true')return {sent:0};
 const rules=(await db.prepare('SELECT * FROM pcc_faq_rules WHERE enabled=1 LIMIT 100').all()).results;if(!rules.length)return {sent:0};const rows=(await db.prepare("SELECT q.*,s.created_at FROM pcc_questions q JOIN pcc_question_state s ON s.id=q.id WHERE q.status='UNANSWERED' ORDER BY s.created_at DESC LIMIT 30").all()).results;let sent=0;
 for(const q of rows){if(sent>=2)break;const candidates=rules.filter(r=>normalize(r.question)===normalize(q.text));if(candidates.length!==1)continue;const rule=candidates[0],k=await db.prepare('SELECT * FROM pcc_knowledge WHERE id=?').bind(rule.knowledge_id).first();if(!exactFaqMatch(rule,q,k)||!k.content.trim()||k.content.length>2000)continue;
  if(await db.prepare("SELECT id FROM pcc_operations WHERE kind='answer' AND target=? AND status IN ('approved','running','confirmed','reconciliation') LIMIT 1").bind(q.id).first())continue;
  const operation=await approveOperation(db,env,{kind:'answer',target:q.id,text:k.content,confirm:true});await audit(db,'faq_answer_approved',operation.id,{rule_id:rule.id,knowledge_id:k.id,knowledge_version:k.version});try{await executeOperation(db,env,operation.id);sent++;}catch{/* Existing operations retain failure/uncertainty; never auto-resend. */}
 }return {sent};
}
