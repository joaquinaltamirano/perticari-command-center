import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';

let mf,db;const mock=createFetchMock();mock.disableNetConnect();
before(async()=>{
 const contents=`import {database} from './src/server/db.mjs';import {handleWorkflow,publicWorkflowAsset,registerBatch} from './src/server/publication-workflow.mjs';import {oauthConfig,encryptValue} from './src/server/oauth.mjs';export default {async fetch(request,env){let db=await database(env);const path=new URL(request.url).pathname;try{if(path.startsWith('/media/pcc/'))return await publicWorkflowAsset(env,path)||new Response('not found',{status:404});const input=request.method==='POST'?await request.json():{};if(path==='/synthetic/connect'){const config=oauthConfig(env),expires=Date.now()+3600000;await db.prepare("INSERT OR REPLACE INTO pcc_oauth_connection VALUES (1,'2','123',?,?,1,'idle',?)").bind(await encryptValue({access_token:'SYNTHETIC_ACCESS_TOKEN',refresh_token:'SYNTHETIC_REFRESH_TOKEN'},config),expires,Date.now()).run();return Response.json({ok:true});}if(path==='/synthetic/batch')return Response.json({id:await registerBatch(db,input.ids,input.name)});if(path==='/synthetic/template-race'){const underlying=db;db={batch:s=>underlying.batch(s),prepare(sql){const statement=underlying.prepare(sql);if(!sql.startsWith('WITH updates AS MATERIALIZED'))return statement;return {bind(...args){const bound=statement.bind(...args);return {async run(){await underlying.prepare("UPDATE pcc_drafts SET version=version+1 WHERE id='D2'").run();return bound.run();}}}};}};return Response.json(await handleWorkflow(env,db,'/api/pcc/v3/workflow/templates/apply','POST',input));}return Response.json(await handleWorkflow(env,db,path,request.method,input));}catch(e){return Response.json({error:e.message},{status:e.status||500});}}}`;
 const built=await build({stdin:{contents,resolveDir:process.cwd(),sourcefile:'synthetic-workflow-harness.mjs'},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.sql':'text'}});
 mf=new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-07-30',d1Databases:{NOTIFICATIONS_DB:'workflow-test'},fetchMock:mock,bindings:{PCC_ORIGIN:'https://synthetic.test',ML_APPLICATION_ID:'2',ML_CLIENT_SECRET:'SYNTHETIC_CLIENT_SECRET_123456789',PCC_ADMIN_KEY:'SYNTHETIC_ADMIN_KEY_123456789012345',PCC_ENABLE_ML_WRITES:'true',PCC_ML_CONTRACT_VERIFIED:'true'}});db=await mf.getD1Database('NOTIFICATIONS_DB');await ok('state');
 for(const [sku,name,family] of [['A','PERFIL ANGULO X 6 MTS','Perfiles'],['B','PERFIL ANGULO X 6 MTS','Perfiles'],['C','CHAPA GALVANIZADA 1 X 2','Chapas']])await db.prepare('INSERT INTO pcc_products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(sku,name,family,'barra',6,10000,'ARS',1,Date.now(),'fixture_sintetico','{}',100).run();
 for(const [id,sku] of [['D1','A'],['D2','B'],['DC','C'],['FREE','A'],['HISTORY','A']])await db.prepare('INSERT INTO pcc_drafts VALUES (?,?,1,?,?,NULL,?)').bind(id,sku,'draft',JSON.stringify({sku,title:'Borrador sintético',description:'Texto anterior',pictures:[]}),Date.now()).run();
 await db.prepare("INSERT INTO pcc_operations VALUES ('CONFIRMED','publish','HISTORY','confirmed','{}','{}',?,?)").bind(Date.now(),Date.now()).run();
});
after(async()=>{await mf?.dispose();await mock.close();});
const req=(path,data)=>mf.dispatchFetch('https://synthetic.test'+(path.startsWith('/')?path:'/api/pcc/v3/workflow/'+path),{method:data?'POST':'GET',headers:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined});
const ok=async(path,data)=>{const r=await req(path,data),out=await r.json();assert.equal(r.status,200,JSON.stringify(out));return out;};
const remote=(method,path,result)=>mock.get('https://api.mercadolibre.com').intercept({method,path}).reply(200,JSON.stringify(result),{headers:{'content-type':'application/json'}});

test('archivar y restaurar propuestas mantiene historial; eliminación rechaza selección mixta antes de cambiar nada',async()=>{
 await ok('drafts/action',{ids:['D1'],action:'archive'});assert.equal((await ok('state')).drafts.find(d=>d.id==='D1').lifecycle,'archived');
 await ok('drafts/action',{ids:['D1'],action:'restore'});assert.equal((await ok('state')).drafts.find(d=>d.id==='D1').lifecycle,'active');
 assert.equal((await req('drafts/action',{ids:['FREE','HISTORY'],action:'delete'})).status,409);assert.ok(await db.prepare("SELECT id FROM pcc_drafts WHERE id='FREE'").first());
 await ok('drafts/action',{ids:['FREE'],action:'delete'});assert.equal(await db.prepare("SELECT id FROM pcc_drafts WHERE id='FREE'").first(),null);assert.ok(await db.prepare("SELECT id FROM pcc_operations WHERE id='CONFIRMED'").first());
 await ok('drafts/action',{ids:['HISTORY'],action:'archive'});assert.equal((await ok('state')).drafts.find(d=>d.id==='HISTORY').lifecycle,'archived');
});
test('lotes repetidos son idempotentes y borrar un agrupador conserva borradores y operaciones',async()=>{
 const a=await ok('/synthetic/batch',{ids:['D1','D2'],name:'Lote sintético'}),b=await ok('/synthetic/batch',{ids:['D2','D1'],name:'Doble clic'});assert.equal(a.id,b.id);
 await ok('batches/action',{ids:[a.id],action:'archive'});assert.equal((await ok('state')).batches.find(x=>x.id===a.id).lifecycle,'archived');
 await ok('batches/action',{ids:[a.id],action:'delete'});assert.ok(!(await ok('state')).batches.some(x=>x.id===a.id));assert.ok(await db.prepare("SELECT id FROM pcc_drafts WHERE id='D1'").first());assert.ok(await db.prepare("SELECT id FROM pcc_operations WHERE id='CONFIRMED'").first());
});
test('plantillas no cruzan familias y controlan cambios de versión de todo el lote atómicamente',async()=>{
 const t=await ok('templates/save',{value:{family_id:'angulos',description:'{NOMBRE}\n{PRESENTACION}',pictures:[]}});
 assert.equal((await req('templates/apply',{template_id:t.id,ids:['D1','DC']})).status,409);assert.equal((await db.prepare("SELECT version FROM pcc_drafts WHERE id='D1'").first()).version,1);
 assert.equal((await req('/synthetic/template-race',{template_id:t.id,ids:['D1','D2']})).status,409);assert.equal((await db.prepare("SELECT version FROM pcc_drafts WHERE id='D1'").first()).version,1);assert.equal((await db.prepare("SELECT payload FROM pcc_drafts WHERE id='D2'").first()).payload.includes('Texto anterior'),true);
 await ok('templates/apply',{template_id:t.id,ids:['D1','D2']});assert.equal((await db.prepare("SELECT version FROM pcc_drafts WHERE id='D1'").first()).version,2);assert.match((await db.prepare("SELECT payload FROM pcc_drafts WHERE id='D1'").first()).payload,/Barra de 6 m/);
});
test('biblioteca rechaza SVG/disfrazados y publica solo imágenes identificadas por hash',async()=>{
 const svg=Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');assert.equal((await req('media/import',{rights_confirmed:true,files:[{filename:'fake.png',base64:svg}]})).status,400);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6pAAAAABJRU5ErkJggg==';
 assert.equal((await req('media/import',{files:[{filename:'own.png',base64:png}]})).status,400);
 const imported=await ok('media/import',{rights_confirmed:true,files:[{filename:'own.png',base64:png}]});const asset=imported.assets[0];assert.match(asset.hash,/^[a-f0-9]{64}$/);
 const publicImage=await req('/media/pcc/'+asset.hash);assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('content-type'),'image/png');assert.equal(publicImage.headers.get('x-content-type-options'),'nosniff');assert.equal(Buffer.from(await publicImage.arrayBuffer()).toString('base64'),png);
 assert.equal((await req('/media/pcc/'+'0'.repeat(64))).status,404);
});
test('contenido verifica IDs de imagen, guarda incertidumbre y reconcilia solo por lectura',async()=>{
 await ok('/synthetic/connect',{});const now=Date.now(),beforePictures=[{id:'OLD',source:'https://images.synthetic/old.jpg'}];
 await db.prepare('INSERT INTO pcc_listings VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind('MLA123','A','Perfil sintético','active',11500,'ARS','MLA1','gold_special','mercadolibre',now,JSON.stringify({description:'Texto anterior',pictures:beforePictures})).run();
 const key=(await ok('state')).products.find(p=>p.sku==='A').classification.media_key;
 const preview=await ok('changes/preview',{ids:['MLA123'],description:'Texto nuevo {PRESENTACION}',pictures:[{source:'https://images.synthetic/new.jpg'}],media_key:key,approve_media:true});const id=preview.prepared[0];
 const item=pictures=>({id:'MLA123',seller_id:123,pictures,variations:[]});
 remote('GET','/items/MLA123',item([{id:'OLD',secure_url:'https://images.synthetic/old.jpg'}]));remote('GET','/items/MLA123/description',{plain_text:'Texto anterior'});
 remote('PUT','/items/MLA123',{pictures:[{id:'EXPECTED',secure_url:'https://images.synthetic/new.jpg'}]});remote('PUT','/items/MLA123/description',{});
 remote('GET','/items/MLA123',item([{id:'WRONG_SAME_COUNT',secure_url:'https://images.synthetic/wrong.jpg'}]));remote('GET','/items/MLA123/description',{plain_text:'Texto nuevo Barra de 6 m'});
 assert.equal((await req('changes/execute',{id,confirm:true})).status,409);let row=await db.prepare('SELECT * FROM pcc_content_changes WHERE id=?').bind(id).first();assert.equal(row.status,'reconciliation');assert.deepEqual(JSON.parse(row.result).expected_picture_ids,['EXPECTED']);
 assert.equal((await req('changes/execute',{id,confirm:true})).status,409);
 remote('GET','/items/MLA123',item([{id:'EXPECTED',secure_url:'https://images.synthetic/new.jpg'}]));remote('GET','/items/MLA123/description',{plain_text:'Texto nuevo Barra de 6 m'});
 assert.equal((await ok('changes/reconcile',{id})).status,'confirmed');assert.equal((await ok('changes/execute',{id,confirm:true})).repeated,true);
 row=await db.prepare('SELECT * FROM pcc_content_changes WHERE id=?').bind(id).first();assert.equal(row.status,'confirmed');
});
