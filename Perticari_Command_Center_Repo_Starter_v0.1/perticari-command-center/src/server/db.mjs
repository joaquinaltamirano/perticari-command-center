import schema from '../../migrations/0002_command_center.sql';
import v2Schema from '../../migrations/0003_v2.sql';
import notificationsSchema from '../../migrations/0001_notifications.sql';
import { oauthStorage } from './oauth.mjs';
import { referenceBands } from '../domain/money.mjs';
import { zones } from '../domain/logistics.mjs';
let ready;
export async function database(env){
 const db=await oauthStorage(env);
 if(ready!==db){
   const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pcc_settings'").first();
   if(exists && await db.prepare('SELECT id FROM pcc_settings WHERE id=1').first()){await migrateV2(db);ready=db;return db;}
   await db.batch((notificationsSchema+';'+schema).split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
   await db.prepare('INSERT OR IGNORE INTO pcc_mfa (id) VALUES (1)').run();
   await db.prepare('INSERT OR IGNORE INTO pcc_settings (id,value,version) VALUES (1,?,1)').bind(JSON.stringify(defaultSettings)).run();await migrateV2(db);ready=db;
 }
 return db;
}
export const defaultSettings={markup_bps:1500,default_quantity:100,fee_bands:referenceBands,fees_confirmed_at:null,
 fx_cents:null,fx_at:null,fx_source:'',freight_zones:zones,coverage_confirmed_at:null};
export async function settings(db){const row=await db.prepare('SELECT value,version FROM pcc_settings WHERE id=1').first();return {...defaultSettings,...JSON.parse(row.value),version:row.version};}
export async function audit(db,action,target,result){await db.prepare('INSERT INTO pcc_audit VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),action,String(target),JSON.stringify(result),Date.now()).run();}
export async function batch(db,statements){for(let i=0;i<statements.length;i+=40)await db.batch(statements.slice(i,i+40));}
export const productRow=p=>({...p,price_confirmed:Boolean(p.price_confirmed),technical:JSON.parse(p.technical||'{}')});
export const listingRow=l=>({...l,payload:JSON.parse(l.payload||'{}')});
export function productStatement(db,p){return db.prepare(`INSERT INTO pcc_products (sku,name,family,unit,length,base_cents,currency,price_confirmed,source_at,source,technical,updated)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,family=excluded.family,
 unit=COALESCE(pcc_products.unit,excluded.unit),length=COALESCE(pcc_products.length,excluded.length),base_cents=excluded.base_cents,currency=excluded.currency,
 price_confirmed=0,source_at=excluded.source_at,source=excluded.source,technical=excluded.technical,updated=excluded.updated`).bind(
 p.sku,p.name,p.family||'Por clasificar',p.unit||null,p.length||null,p.base_cents??null,p.currency||null,0,p.source_at||null,p.source||'import',JSON.stringify(p.technical||{}),Date.now());}
export function listingStatement(db,l){return db.prepare(`INSERT INTO pcc_listings VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,title=excluded.title,status=excluded.status,
 price_cents=excluded.price_cents,currency=excluded.currency,category_id=excluded.category_id,listing_type_id=excluded.listing_type_id,source=excluded.source,source_at=excluded.source_at,payload=excluded.payload`).bind(
 l.id,l.sku||null,l.title||'',l.status||'importado',l.price_cents??null,l.currency||'ARS',l.category_id||null,l.listing_type_id||null,l.source||'import',l.source_at||null,JSON.stringify(l.payload||{}));}

async function migrateV2(db){
 const table=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pcc_schema'").first();
 if(table&&await db.prepare('SELECT version FROM pcc_schema WHERE version=3').first())return;
 await db.batch(v2Schema.split(';').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
 await db.prepare('INSERT OR IGNORE INTO pcc_policy VALUES (1,?,1)').bind(JSON.stringify(defaultPolicy)).run();
 await db.prepare('INSERT OR IGNORE INTO pcc_schema VALUES (3,?)').bind(Date.now()).run();
}
export const defaultPolicy={read_only:false,pause_jobs:false,ai_enabled:false,ai_model:'',ai_daily_limit_microusd:0,ai_input_microusd_per_million:0,ai_output_microusd_per_million:0,ai_max_input_chars:12000,ai_max_output_tokens:600,response_target_minutes:30,auto_questions:true,auto_memosoft:false};
export async function policies(db){const r=await db.prepare('SELECT * FROM pcc_policy WHERE id=1').first();return {...defaultPolicy,...JSON.parse(r.value),version:r.version};}
