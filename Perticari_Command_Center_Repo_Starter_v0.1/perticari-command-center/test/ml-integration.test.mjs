import {before,after,beforeEach,test} from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {createHmac} from 'node:crypto';import {Miniflare,createFetchMock} from 'miniflare';
const origin='https://integration.test',password='SYNTHETIC_INTEGRATION_ADMIN_123456789',mock=createFetchMock();mock.disableNetConnect();let mf,db,cookie='';
const extract=r=>(r.headers.get('set-cookie')||'').split(';')[0];
async function req(path,data){return mf.dispatchFetch(origin+path,{method:data===undefined?'GET':'POST',redirect:'manual',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});}
async function ok(path,data){const r=await req('/api/pcc/'+path,data);const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
function otp(secret){const abc='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,a=[];for(const c of secret){value=(value<<5)|abc.indexOf(c);bits+=5;if(bits>=8){a.push((value>>>(bits-8))&255);bits-=8;}}const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',Buffer.from(a)).update(b).digest();return String((h.readUInt32BE(h.at(-1)&15)&0x7fffffff)%1000000).padStart(6,'0');}
function remote(method,path,data,status=200){mock.get('https://api.mercadolibre.com').intercept({method,path}).reply(status,JSON.stringify(data),{headers:{'content-type':'application/json'}});}
async function queue(kind,payload={}){const id=crypto.randomUUID();await db.prepare("INSERT INTO pcc_jobs VALUES (?,?,?,'pending',0,0,NULL,NULL,0)").bind(id,kind,JSON.stringify(payload)).run();await ok('jobs/run',{});return db.prepare('SELECT * FROM pcc_jobs WHERE id=?').bind(id).first();}
before(async()=>{
 mf=new Miniflare({modules:true,scriptPath:resolve('dist/worker.js'),compatibilityDate:'2026-07-30',d1Databases:{NOTIFICATIONS_DB:'integration-test'},fetchMock:mock,bindings:{PCC_ORIGIN:origin,ML_APPLICATION_ID:'2',ML_CLIENT_SECRET:'SYNTHETIC_INTEGRATION_CLIENT_SECRET',PCC_ADMIN_KEY:password,OPENAI_API_KEY:'SYNTHETIC_AI_KEY_NOT_REAL',PCC_ENABLE_ML_WRITES:'true',PCC_ML_CONTRACT_VERIFIED:'true'}});
 const login=await mf.dispatchFetch(origin+'/connect',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password}).toString()});cookie=extract(login);db=await mf.getD1Database('NOTIFICATIONS_DB');
 const setup=await ok('mfa/setup',{}),verify=await req('/api/pcc/mfa/verify',{code:otp(setup.secret)});assert.equal(verify.status,200);cookie+='; '+extract(verify);
 const start=await req('/connect/start',{}),auth=new URL(start.headers.get('location'));remote('POST','/oauth/token',{access_token:'SYNTHETIC_ACCESS_TOKEN',refresh_token:'SYNTHETIC_REFRESH_TOKEN',token_type:'Bearer',user_id:123,expires_in:21600});
 const callback=await mf.dispatchFetch(origin+'/api/integrations/mercadolibre/oauth/callback?code=SYNTHETIC_CODE&state='+auth.searchParams.get('state'),{redirect:'manual',headers:{cookie:extract(start)}});assert.equal(callback.headers.get('location'),'/connect?result=connected');
});
beforeEach(async()=>{for(const name of ['pcc_jobs','pcc_listings','pcc_questions','pcc_operations','pcc_products','pcc_drafts','pcc_metrics'])await db.prepare('DELETE FROM '+name).run();});
after(async()=>{await mf.dispose();await mock.close();});
test('paginación de publicaciones valida vendedor y persiste múltiples variantes sin inventar SKU',async()=>{
 remote('GET','/users/123/items/search?limit=10&offset=0',{results:['MLA900']});
 remote('GET','/items/MLA900',{id:'MLA900',seller_id:123,title:'Producto sintético',status:'active',price:1000,currency_id:'ARS',category_id:'MLA1234',variations:[{id:50,seller_custom_field:'SKU_A'},{id:51,seller_custom_field:'SKU_B'}]});
 const job=await queue('items');assert.equal(job.status,'done');const s=await ok('bootstrap');assert.equal(s.listings.length,1);assert.equal(s.listings[0].sku,null);assert.deepEqual(s.listings[0].payload.variations.map(v=>v.sku),['SKU_A','SKU_B']);assert.equal(s.jobs.filter(j=>j.status==='pending').length,0);
});
test('un ítem de otro vendedor se rechaza sin incorporarlo',async()=>{remote('GET','/users/123/items/search?limit=10&offset=0',{results:['MLA900']});remote('GET','/items/MLA900',{id:'MLA900',seller_id:999});const job=await queue('items');assert.equal(job.status,'failed');assert.equal((await ok('bootstrap')).listings.length,0);});
test('429 de lectura se difiere con backoff y queda visible',async()=>{remote('GET','/questions/search?seller_id=123&status=UNANSWERED&api_version=4&limit=20&offset=0',{},429);const job=await queue('questions');assert.equal(job.status,'pending');assert.equal(job.attempts,1);assert.ok(job.due>Date.now());assert.match(job.error,/Límite/);});
test('ventas conservan totales y unidades pero descartan datos del comprador',async()=>{remote('GET','/orders/search?seller=123&sort=date_desc&limit=20&offset=0',{results:[{id:800,seller:{id:123},status:'paid',date_created:'2026-10-16T12:00:00-03:00',currency_id:'ARS',total_amount:10000,order_items:[{quantity:3}],buyer:{first_name:'SYNTHETIC_PRIVATE_NAME',address:'SYNTHETIC_PRIVATE_ADDRESS'}}]});assert.equal((await queue('orders')).status,'done');const metrics=JSON.stringify((await ok('bootstrap')).metrics);assert.ok(!metrics.includes('SYNTHETIC_PRIVATE'));assert.match(metrics,/1000000/);assert.match(metrics,/"units":3/);});
async function question(){await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('999','MLA900','Pregunta sintética','UNANSWERED',null,null,Date.now()).run();return ok('operations/approve',{kind:'answer',target:'999',text:'Respuesta sintética aprobada.',confirm:true});}
test('respuesta aprobada verifica estado remoto y doble ejecución no repite envío',async()=>{const operation=await question();remote('GET','/questions/999',{id:999,item_id:'MLA900',seller_id:123,status:'UNANSWERED'});remote('POST','/answers',{id:999});remote('GET','/questions/999',{id:999,item_id:'MLA900',seller_id:123,status:'ANSWERED',answer:{text:'Respuesta sintética aprobada.'}});const first=await ok('operations/execute',{id:operation.id});assert.equal(first.status,'confirmed');const again=await ok('operations/execute',{id:operation.id});assert.equal(again.repeated,true);});
test('pregunta ya respondida bloquea la escritura',async()=>{const operation=await question();remote('GET','/questions/999',{id:999,item_id:'MLA900',seller_id:123,status:'ANSWERED'});const r=await req('/api/pcc/operations/execute',{id:operation.id});assert.equal(r.status,409);assert.equal((await db.prepare('SELECT status FROM pcc_operations WHERE id=?').bind(operation.id).first()).status,'failed');});
test('fallo tras enviar queda en reconciliación, sin reenvío automático',async()=>{const operation=await question();remote('GET','/questions/999',{id:999,item_id:'MLA900',seller_id:123,status:'UNANSWERED'});remote('POST','/answers',{},500);assert.equal((await req('/api/pcc/operations/execute',{id:operation.id})).status,502);assert.equal((await db.prepare('SELECT status FROM pcc_operations WHERE id=?').bind(operation.id).first()).status,'reconciliation');assert.equal((await req('/api/pcc/operations/execute',{id:operation.id})).status,409);});
test('un SKU en variaciones ya publicadas no se aprueba como nueva publicación duplicada',async()=>{
 await db.prepare('INSERT INTO pcc_products VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind('SKU_A','Producto sintético','Perfiles','barra',6,1000000,'ARS',0,null,'synthetic','{}',Date.now()).run();
 await db.prepare('INSERT INTO pcc_listings VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind('MLA900',null,'Variantes','active',10000,'ARS','MLA1234','gold_special','mercadolibre',Date.now(),JSON.stringify({variations:[{id:1,sku:'SKU_A'}]})).run();
 const {created}=await ok('drafts/create',{skus:['SKU_A']});let draft=(await ok('bootstrap')).drafts[0];const payload={...draft.payload,category_id:'MLA1234',price_cents:1283000,presentation_confirmed:true,pictures:[{source:'https://images.example.test/synthetic.jpg'}]};await ok('drafts/save',{id:created[0],version:draft.version,payload});remote('POST','/items/validate',{});await ok('drafts/validate',{id:created[0]});draft=(await ok('bootstrap')).drafts[0];const response=await req('/api/pcc/operations/approve',{kind:'publish',target:draft.id,version:draft.version,confirm:true});assert.equal(response.status,409);assert.match((await response.json()).error,/ya tiene publicaciones/);
});
test('V2 reconcilia una pregunta vieja respondida fuera del panel, aunque no aparezca en search',async()=>{
 await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('111','MLA900','Pregunta anterior','UNANSWERED',null,'Borrador conservado',Date.now()-86400000).run();
 remote('GET','/questions/search?seller_id=123&status=UNANSWERED&api_version=4&limit=20&offset=0',{questions:[]});assert.equal((await queue('questions')).status,'done');
 assert.equal((await db.prepare("SELECT status FROM pcc_questions WHERE id='111'").first()).status,'UNANSWERED');
 remote('GET','/questions/111',{id:111,item_id:'MLA900',seller_id:123,text:'Pregunta anterior',status:'ANSWERED',date_created:'2026-10-01T12:00:00-03:00',answer:{text:'Respondida desde ML',date_created:'2026-10-01T12:05:00-03:00'}});
 await ok('jobs/run',{});const s=await ok('bootstrap');assert.equal(s.questions[0].status,'ANSWERED');assert.equal(s.questions[0].draft,'Borrador conservado');assert.equal(s.attention.pending,0);assert.equal(s.attention.median_minutes,5);assert.equal(s.sources.find(s=>s.id==='question_reconcile').status,'ready');
});
test('V2 un fallo 403 de reconciliación no inventa respuesta ni borra la pregunta',async()=>{
 await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('112','MLA900','Pregunta con permiso pendiente','UNANSWERED',null,null,1).run();
 remote('GET','/questions/112',{},403);const j=await queue('question_reconcile',{cycle:Date.now(),cursor:''});assert.equal(j.status,'failed');assert.equal((await db.prepare("SELECT status FROM pcc_questions WHERE id='112'").first()).status,'UNANSWERED');
});
test('V2 pregunta remota 404 se marca no disponible, nunca respondida',async()=>{
 await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('113','MLA900','Pregunta eliminada','UNANSWERED',null,null,1).run();remote('GET','/questions/113',{},404);
 assert.equal((await queue('question_reconcile',{cycle:Date.now(),cursor:''})).status,'done');assert.equal((await db.prepare("SELECT status FROM pcc_questions WHERE id='113'").first()).status,'UNAVAILABLE');
});
test('V2 búsqueda incorpora fecha real y no sobreescribe un estado más nuevo con un ciclo anterior',async()=>{
 const now=Date.now();await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('114','MLA900','Original','ANSWERED','Respuesta remota',null,now+10000).run();
 remote('GET','/questions/search?seller_id=123&status=UNANSWERED&api_version=4&limit=20&offset=0',{questions:[{id:114,item_id:'MLA900',seller_id:123,status:'UNANSWERED',text:'Viejo',date_created:'2026-10-01T12:00:00-03:00'}]});await queue('questions',{cycle:now});const q=await db.prepare("SELECT * FROM pcc_questions WHERE id='114'").first();assert.equal(q.status,'ANSWERED');assert.equal(q.answer,'Respuesta remota');
});
test('V2 sincronizaciones manuales repetidas reutilizan trabajo pendiente',async()=>{
 await db.prepare("INSERT INTO pcc_jobs VALUES ('existing','questions','{}','pending',0,?,NULL,NULL,?)").bind(Date.now()+100000,Date.now()).run();const first=await ok('sync',{source:'questions'}),second=await ok('sync',{source:'questions'});assert.equal(first.jobs[0].id,'existing');assert.equal(second.jobs[0].repeated,true);
});
test('V2 seguimiento de pedido exige disponibilidad confirmada y sobrevive a resincronización',async()=>{
 const order={id:900,seller:{id:123},status:'paid',date_created:'2026-10-20T12:00:00-03:00',currency_id:'ARS',total_amount:100,order_items:[{quantity:2,item:{id:'MLA900',seller_sku:'SYN01',title:'Barra sintética'}}]};
 remote('GET','/orders/search?seller=123&sort=date_desc&limit=20&offset=0',{results:[order]});await queue('orders');let s=await ok('bootstrap'),o=s.orders.find(o=>o.id==='900');assert.ok(o);
 assert.equal((await req('/api/pcc/v2/orders/update',{id:o.id,version:o.version,availability:'pending',stage:'preparing',note:''})).status,409);
 await ok('v2/orders/update',{id:o.id,version:o.version,availability:'confirmed',stage:'preparing',note:'Disponibilidad revisada'});
 remote('GET','/orders/search?seller=123&sort=date_desc&limit=20&offset=0',{results:[order]});await queue('orders');o=(await ok('bootstrap')).orders.find(o=>o.id==='900');assert.equal(o.availability,'confirmed');assert.equal(o.stage,'preparing');assert.equal(o.version,2);
});
test('V2 kill switch en backend impide cualquier escritura aunque flags de piloto estén activos',async()=>{
 const operation=await question(),s=await ok('bootstrap');await ok('v2/policy',{version:s.policy.version,read_only:true});assert.equal((await req('/api/pcc/operations/execute',{id:operation.id})).status,409);assert.equal((await db.prepare('SELECT status FROM pcc_operations WHERE id=?').bind(operation.id).first()).status,'approved');const latest=await ok('bootstrap');await ok('v2/policy',{version:latest.policy.version,read_only:false});
});
test('V2 aprobación de pausa confirma estado remoto sin cancelar órdenes',async()=>{
 await db.prepare('INSERT INTO pcc_listings VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind('MLA900','SYN01','Barra sintética','active',10000,'ARS','MLA1234','gold_special','mercadolibre',Date.now(),'{}').run();const operation=await ok('operations/approve',{kind:'pause',target:'MLA900',reason:'Faltante confirmado por operador',confirm:true});
 remote('GET','/items/MLA900',{id:'MLA900',seller_id:123,status:'active'});remote('PUT','/items/MLA900',{id:'MLA900',status:'paused'});remote('GET','/items/MLA900',{id:'MLA900',seller_id:123,status:'paused'});assert.equal((await ok('operations/execute',{id:operation.id})).status,'confirmed');assert.equal((await db.prepare("SELECT status FROM pcc_listings WHERE id='MLA900'").first()).status,'paused');
});
test('V2 proveedor IA valida estructura, citas y contabiliza presupuesto sin enviar mensajes',async()=>{
 await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('997','MLA900','Hay disponibilidad?','UNANSWERED',null,null,Date.now()).run();let s=await ok('bootstrap');
 await ok('v2/policy',{version:s.policy.version,ai_enabled:true,ai_model:'synthetic-structured',ai_daily_limit_microusd:100000,ai_input_microusd_per_million:1000000,ai_output_microusd_per_million:2000000});
 mock.get('https://api.openai.com').intercept({method:'POST',path:'/v1/chat/completions'}).reply(200,JSON.stringify({choices:[{message:{content:JSON.stringify({text:'¿Qué cantidad necesitás para confirmar disponibilidad?',source_ids:['policy:availability'],needs_review:true,missing:['Cantidad requerida']})}}],usage:{prompt_tokens:100,completion_tokens:30}}),{headers:{'content-type':'application/json'}});
 const r=await ok('v2/suggest',{id:'997',engine:'ai'});assert.equal(r.engine,'openai');assert.equal(r.model,'synthetic-structured');s=await ok('bootstrap');assert.ok(s.usage[0].budget_used_microusd>=160);assert.equal(s.questions.find(q=>q.id==='997').status,'UNANSWERED');
 await ok('v2/policy',{version:s.policy.version,ai_daily_limit_microusd:1});assert.equal((await req('/api/pcc/v2/suggest',{id:'997',engine:'ai'})).status,409);
});
test('V2 IA con citas inventadas se rechaza y conserva reserva ante fallo',async()=>{
 await db.prepare('INSERT INTO pcc_questions VALUES (?,?,?,?,?,?,?)').bind('996','MLA900','Consulta sintética','UNANSWERED',null,null,Date.now()).run();let s=await ok('bootstrap');await ok('v2/policy',{version:s.policy.version,ai_daily_limit_microusd:1000000});
 mock.get('https://api.openai.com').intercept({method:'POST',path:'/v1/chat/completions'}).reply(200,JSON.stringify({choices:[{message:{content:JSON.stringify({text:'Tenemos 200 unidades.',source_ids:['invented-stock'],needs_review:false,missing:[]})}}]}));assert.equal((await req('/api/pcc/v2/suggest',{id:'996',engine:'ai'})).status,502);assert.equal((await db.prepare("SELECT draft FROM pcc_questions WHERE id='996'").first()).draft,null);assert.equal((await db.prepare("SELECT COUNT(*) c FROM pcc_ai_usage WHERE status='failed'").first()).c,1);
});
test('V2 ingreso invitado observado conserva cookie, lee precio público y no aplica recargos viejos',async()=>{
 const mem=mock.get('https://www.memosoft.net.ar');mem.intercept({method:'GET',path:'/_pedidos/2513/0/index.php'}).reply(200,'<a id="usuario-invitado" href="invitado.php">Ingresar como invitado</a>',{headers:{'set-cookie':'session=fixture; Secure; HttpOnly'}});
 mem.intercept({method:'GET',path:'/_pedidos/2513/0/invitado.php',headers:{cookie:'session=fixture'}}).reply(302,'',{headers:{location:'carrito/catalogo.php?pagina=1'}});
 mem.intercept({method:'GET',path:'/_pedidos/2513/0/carrito/catalogo.php?pagina=1'}).reply(200,'<table class="catalogo"><tr class="catalogo"><td>SYNMEM</td><td>PERFIL ANGULO X 6 MTS</td><td>barra</td><td>$ 10.000,00</td></tr></table>').times(2);
 const j=await queue('memosoft');assert.equal(j.status,'done');assert.equal(await db.prepare("SELECT * FROM pcc_products WHERE sku='SYNMEM'").first(),null);const next=await db.prepare("SELECT * FROM pcc_jobs WHERE kind='memosoft' AND status='pending'").first();assert.ok(next);assert.ok(!next.payload.includes('session=fixture'));
 mem.intercept({method:'GET',path:'/_pedidos/2513/0/carrito/catalogo.php?pagina=2'}).reply(200,'<table class="catalogo"></table>');await ok('jobs/run',{});const p=await db.prepare("SELECT * FROM pcc_products WHERE sku='SYNMEM'").first();assert.equal(p.base_cents,1000000);assert.equal(p.source,'memosoft');assert.equal(p.unit,'barra');assert.equal((await db.prepare("SELECT status FROM pcc_memosoft_runs WHERE id=?").bind(j.id).first()).status,'complete');
});
test('V2 no sigue enlace invitado hacia otro dominio',async()=>{
 mock.get('https://www.memosoft.net.ar').intercept({method:'GET',path:'/_pedidos/2513/0/index.php'}).reply(200,'<a id="usuario-invitado" href="https://evil.test/invitado.php">Invitado</a>');const j=await queue('memosoft');assert.equal(j.status,'failed');assert.match(j.error,/fuera/);
});
test('V2 formulario invitado POST usa solo campos observados y rechaza sesión vencida sin borrar precios',async()=>{
 let observed='';const mem=mock.get('https://www.memosoft.net.ar');mem.intercept({method:'GET',path:'/_pedidos/2513/0/index.php'}).reply(200,'<form method="POST" action="index.php"><input type="hidden" name="csrf" value="fixture"><input type="password" name="password"><button id="usuario-invitado" name="guest" value="1">Invitado</button></form>');
 mem.intercept({method:'POST',path:'/_pedidos/2513/0/index.php'}).reply(({body})=>{observed=new Response(body).text();return {statusCode:200,data:'Invitado'};});mem.intercept({method:'GET',path:'/_pedidos/2513/0/carrito/catalogo.php?pagina=1'}).reply(200,'<button id="usuario-invitado">Ingresar</button>');const j=await queue('memosoft');assert.equal(await observed,'csrf=fixture&guest=1');assert.equal(j.status,'failed',j.error);assert.match(j.error,/sesión invitado/);
});
test('V2 reconciliación de envío incierto confirma solo por lectura, sin volver a enviar',async()=>{
 const op=await question();await db.prepare("UPDATE pcc_operations SET status='reconciliation' WHERE id=?").bind(op.id).run();remote('GET','/questions/999',{id:999,item_id:'MLA900',seller_id:123,status:'ANSWERED',answer:{text:'Respuesta sintética aprobada.'}});assert.equal((await ok('operations/reconcile',{id:op.id})).status,'confirmed');
});
test('V2 cron procesa atención y ventas sin dejar el catálogo permanentemente bloqueado',async()=>{
 await db.prepare("DELETE FROM pcc_runtime WHERE id='scheduler'").run();await db.prepare("DELETE FROM pcc_sources WHERE id='questions'").run();
 remote('GET','/questions/search?seller_id=123&status=UNANSWERED&api_version=4&limit=20&offset=0',{questions:[]});remote('GET','/orders/search?seller=123&sort=date_desc&limit=20&offset=0',{results:[]});
 const worker=await mf.getWorker();await worker.scheduled({cron:'* * * * *',scheduledTime:Date.now()});
 assert.equal((await db.prepare("SELECT status FROM pcc_jobs WHERE kind='orders_recent'").first()).status,'done');
 await db.prepare("UPDATE pcc_runtime SET updated=0 WHERE id='scheduler'").run();remote('GET','/orders/search?seller=123&sort=date_desc&limit=20&offset=0',{results:[]});remote('GET','/users/123/items/search?limit=10&offset=0',{results:[]});await worker.scheduled({cron:'* * * * *',scheduledTime:Date.now()});
 assert.equal((await db.prepare("SELECT status FROM pcc_jobs WHERE kind='items'").first()).status,'done');assert.equal((await db.prepare("SELECT status FROM pcc_jobs WHERE kind='orders'").first()).status,'done');
});

test('V3 una pregunta recién listada también se verifica por ID y adopta la respuesta remota',async()=>{
 remote('GET','/questions/search?seller_id=123&status=UNANSWERED&api_version=4&limit=20&offset=0',{questions:[{id:777,item_id:'MLA900',seller_id:123,text:'Pregunta sintética',status:'UNANSWERED'}]});
 assert.equal((await queue('questions')).status,'done');remote('GET','/questions/777',{id:777,item_id:'MLA900',seller_id:123,status:'ANSWERED',answer:{text:'Contestada desde ML'}});await ok('jobs/run',{});
 assert.equal((await db.prepare("SELECT status FROM pcc_questions WHERE id='777'").first()).status,'ANSWERED');const meta=await db.prepare("SELECT individual_at FROM pcc_question_verifications WHERE id='777'").first();assert.ok(meta.individual_at);
});
test('V3 historial importa respuestas sin afirmar cobertura de60 días ni generar reglas aprobadas',async()=>{
 remote('GET','/questions/search?seller_id=123&status=ANSWERED&api_version=4&limit=20&offset=0',{questions:[{id:778,item_id:'MLA900',seller_id:123,text:'Pregunta histórica',status:'ANSWERED',answer:{text:'Respuesta de ejemplo'}}]});assert.equal((await queue('questions_history')).status,'done');assert.equal((await db.prepare("SELECT answer FROM pcc_questions WHERE id='778'").first()).answer,'Respuesta de ejemplo');
});
test('V3 enlace eventual y paginación real promueven solo al finalizar',async()=>{
 const mem=mock.get('https://www.memosoft.net.ar');mem.intercept({method:'GET',path:'/_pedidos/2513/0/index.php'}).reply(200,'<a id="usuario-invitado" href="dist/php/login.php?eventual">Invitado</a>');mem.intercept({method:'GET',path:'/_pedidos/2513/0/dist/php/login.php?eventual'}).reply(200,'Catálogo');mem.intercept({method:'GET',path:'/_pedidos/2513/0/carrito/catalogo.php?pagina=1'}).reply(200,'<table><tr><th>Código</th><th>Producto</th><th>Precio</th><th>Cantidad</th></tr><tr class="catalogo"><td>SYNFINAL</td><td>PERFIL ANGULO X 6 MTS</td><td>$ 13,747.97</td><td>100</td></tr></table><a href="?pagina=1">1</a>');
 const job=await queue('memosoft');assert.equal(job.status,'done',job.error);const p=await db.prepare("SELECT * FROM pcc_products WHERE sku='SYNFINAL'").first();assert.equal(p.base_cents,1374797);
});
