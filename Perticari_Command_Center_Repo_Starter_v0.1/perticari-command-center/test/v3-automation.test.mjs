import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,hkdfSync,createPublicKey,verify,createDecipheriv,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
import {defaultAutomationPolicy,evaluateAutomaticPrice,validateAutomationPolicy} from '../src/domain/automation.mjs';
import {createVapidKeys,encryptedPushRequest,validatePushSubscription} from '../src/domain/webpush.mjs';

const now=Date.now(),product={sku:'SYN',name:'Perfil sintético',unit:'barra',length:6,currency:'ARS',source:'memosoft',source_at:now-1000,base_cents:10000,price_confirmed:false,technical:{}},listing={id:'MLA123',sku:'SYN',status:'active',source:'mercadolibre',price_cents:11300,payload:{}},config={markup_bps:1500,fee_bands:[{from:0,to:null,fixed:0}],fees_confirmed_at:now},policy={...defaultAutomationPolicy,targets:[{id:'MLA123',sku:'SYN',unit:'barra',length:6,currency:'ARS'}]},run={status:'complete',finished:product.source_at};
const evaluate=extra=>evaluateAutomaticPrice({product,listing,config,policy,run,now,...extra});
test('regla de precio requiere fuente completa y presentación aprobada',()=>{
 assert.equal(evaluate().eligible,true);assert.equal(evaluate().proposed_cents,11500);
 assert.equal(evaluate({run:null}).eligible,false);
 assert.equal(evaluate({product:{...product,source:'import'}}).eligible,false);
 assert.equal(evaluate({product:{...product,unit:'hoja'}}).eligible,false);
 assert.equal(evaluate({run:{...run,finished:now-9*3600000},product:{...product,source_at:now-9*3600000}}).eligible,false);
 assert.equal(evaluate({config:{...config,fees_confirmed_at:null}}).eligible,false);
});
test('variaciones acumuladas absolutas no se eluden con subidas y bajadas pequeñas',()=>{
 const result=evaluate({movements:[{status:'confirmed',created:now-10000,change_bps:400},{status:'reconciliation',created:now-5000,change_bps:450}]});
 assert.equal(result.eligible,false);assert.match(result.reasons.join(),/acumulada/);
 assert.equal(evaluate({movements:[{status:'failed',created:now-1000,change_bps:9999}]}).eligible,true);
 assert.equal(evaluate({listing:{...listing,price_cents:10000}}).eligible,false);
});
test('política automática permanece desactivada y no amplía los máximos aprobados',()=>{
 assert.equal(defaultAutomationPolicy.enabled,false);
 assert.throws(()=>validateAutomationPolicy({max_change_bps:501}),/máximo/);
 assert.throws(()=>validateAutomationPolicy({max_daily_bps:1001}),/máximo/);
 assert.throws(()=>validateAutomationPolicy({source_max_age_hours:9}),/Vigencia/);
 assert.equal(evaluate({listing:{...listing,payload:{user_product_id:'UP123'}}}).eligible,false);
 assert.equal(evaluate({listing:{...listing,payload:{original_price:130}}}).eligible,false);
});
test('Web Push valida proveedor y cifra el contenido según aes128gcm con VAPID verificable',async()=>{
 const client=createECDH('prime256v1');client.generateKeys();const pub=client.getPublicKey(),auth=randomBytes(16),subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-endpoint',keys:{p256dh:pub.toString('base64url'),auth:auth.toString('base64url')}};
 const vapid=await createVapidKeys(),payload={title:'Aviso sintético',url:'/app#automation'},request=await encryptedPushRequest(subscription,payload,vapid,'https://app.synthetic',now);
 const bytes=Buffer.from(request.init.body),salt=bytes.subarray(0,16),keylen=bytes[20],server=bytes.subarray(21,21+keylen),cipher=bytes.subarray(21+keylen),shared=client.computeSecret(server);
 const ikm=Buffer.from(hkdfSync('sha256',shared,auth,Buffer.concat([Buffer.from('WebPush: info\0'),pub,server]),32)),cek=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16)),nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
 const decipher=createDecipheriv('aes-128-gcm',cek,nonce);decipher.setAuthTag(cipher.subarray(-16));const plaintext=Buffer.concat([decipher.update(cipher.subarray(0,-16)),decipher.final()]);
 assert.equal(plaintext.at(-1),2);assert.deepEqual(JSON.parse(plaintext.subarray(0,-1).toString()),payload);assert.equal(bytes.readUInt32BE(16),4096);
 assert.equal(request.init.headers['content-encoding'],'aes128gcm');
 const jwt=request.init.headers.Authorization.match(/t=([^,]+)/)[1],parts=jwt.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());assert.equal(claims.aud,'https://fcm.googleapis.com');assert.equal(claims.sub,'https://app.synthetic');
 assert.equal(verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),{key:createPublicKey({key:vapid.private_jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url')),true);
 assert.throws(()=>validatePushSubscription({...subscription,endpoint:'https://fcm.googleapis.com.evil.test/push'}),/no permitido/);
 assert.throws(()=>validatePushSubscription({...subscription,endpoint:'https://127.0.0.1/push'}),/no permitido/);
});

let mf,db;const mock=createFetchMock();mock.disableNetConnect();
before(async()=>{
 const contents=`import {database} from './src/server/db.mjs';import {handleAutomation,emitNotice,automationTick} from './src/server/v3-automation.mjs';export default {async fetch(request,env){const db=await database(env);try{const input=request.method==='POST'?await request.json():{};const path=new URL(request.url).pathname;let out;if(path==='/synthetic/notice')out=await emitNotice(db,input);else out=await handleAutomation(env,db,path,request.method,input);return Response.json(out);}catch(e){return Response.json({error:e.message},{status:e.status||500});}}}`;
 const built=await build({stdin:{contents,resolveDir:process.cwd(),sourcefile:'synthetic-automation-harness.mjs'},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.sql':'text'}});
 mf=new Miniflare({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-07-30',d1Databases:{NOTIFICATIONS_DB:'automation-test'},fetchMock:mock,bindings:{PCC_ORIGIN:'https://synthetic.test',ML_APPLICATION_ID:'2',ML_CLIENT_SECRET:'SYNTHETIC_CLIENT_SECRET_123456789',PCC_ADMIN_KEY:'SYNTHETIC_ADMIN_KEY_123456789012345'}});db=await mf.getD1Database('NOTIFICATIONS_DB');
});
after(async()=>{await mf?.dispose();await mock.close();});
const req=(path,data)=>mf.dispatchFetch('https://synthetic.test'+(path.startsWith('/synthetic/')?path:'/api/pcc/v3/automation/'+path),{method:data?'POST':'GET',headers:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined});
const ok=async(path,data)=>{const r=await req(path,data),out=await r.json();assert.equal(r.status,200,JSON.stringify(out));return out;};
test('política en D1 rechaza activación sin piloto y valida errores como400',async()=>{
 const initial=await ok('state');assert.equal(initial.policy.enabled,false);
 assert.equal((await req('policy',{version:1,max_change_bps:600})).status,400);
 assert.equal((await req('policy',{version:1,enabled:true,confirm:true})).status,409);
 const saved=await ok('policy',{version:1,enabled:false,max_change_bps:300});assert.equal(saved.policy.version,2);assert.equal(saved.policy.max_change_bps,300);
 assert.equal((await req('policy',{version:1,enabled:false})).status,409);
});
test('avisos distinguen sincronización en curso y se resuelven cuando la fuente recupera',async()=>{
 await db.prepare("INSERT INTO pcc_sources VALUES ('memosoft','syncing',?,?,?)").bind(Date.now(),Date.now(),'Página 1').run();
 await ok('run',{});assert.equal((await ok('state')).notices.length,0);
 await db.prepare("UPDATE pcc_sources SET status='error',detail='Error sintético de lectura' WHERE id='memosoft'").run();await ok('run',{});
 const notice=(await ok('state')).notices[0];assert.equal(notice.severity,'critical');
 await ok('notifications/action',{id:notice.id,action:'acknowledge'});await ok('run',{});assert.equal((await ok('state')).notices[0].status,'acknowledged');
 await db.prepare("UPDATE pcc_sources SET status='ready' WHERE id='memosoft'").run();await ok('run',{});assert.equal((await ok('state')).notices[0].status,'resolved');
});
test('aviso de cambio de catálogo resuelto no vuelve a abrirse cada tick',async()=>{
 await db.prepare('CREATE TABLE IF NOT EXISTS pcc_source_notices (id TEXT PRIMARY KEY,kind TEXT,title TEXT,payload TEXT,created INTEGER,acknowledged INTEGER)').run();
 await db.prepare("INSERT INTO pcc_source_notices VALUES ('synthetic-run','memosoft','Catálogo actualizado','{}',?,NULL)").bind(Date.now()).run();
 await ok('run',{});const notice=(await ok('state')).notices.find(n=>n.kind==='memosoft');assert.ok(notice);
 await ok('notifications/action',{id:notice.id,action:'resolve'});await ok('run',{});assert.equal((await ok('state')).notices.find(n=>n.id===notice.id).status,'resolved');
});
test('suscripción y VAPID se guardan cifrados y el panel no expone endpoints ni claves privadas',async()=>{
 const pub=await ok('push/public-key');assert.match(pub.public_key,/^[A-Za-z0-9_-]+$/);
 const client=createECDH('prime256v1');client.generateKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/SYNTHETIC_PRIVATE_ENDPOINT',keys:{p256dh:client.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 const saved=await ok('push/subscribe',{subscription}),row=await db.prepare('SELECT value FROM pcc_v3_push_subscriptions WHERE id=?').bind(saved.id).first();assert.ok(!row.value.includes('SYNTHETIC_PRIVATE_ENDPOINT'));
 const state=await ok('state');assert.equal(state.push.subscribed,true);assert.ok(!JSON.stringify(state).includes('SYNTHETIC_PRIVATE_ENDPOINT'));assert.ok(!JSON.stringify(state).includes('private_jwk'));
 assert.equal((await req('push/subscribe',{subscription:{...subscription,endpoint:'https://evil.test/push'}})).status,400);
 await ok('push/unsubscribe',{id:saved.id});assert.equal((await ok('state')).push.subscribed,false);
});
