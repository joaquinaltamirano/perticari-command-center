import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,createFetchMock} from 'miniflare';
import {parseBnaBillete,polygonContains,validatePolygon,convertFreight,validateAdsReport,classifyAdsRows} from '../src/domain/integrations.mjs';

test('BNA selecciona billete vendedor y fecha sin confundir divisa ni compra',()=>{
 const html='<div id="billetes"><table><tr><td>Dolar U.S.A</td><td>1.400,00</td><td>1.450,50</td></tr></table>Fecha 26/10/2026</div><div id="divisas"><table><tr><td>Dolar U.S.A</td><td>1.000,00</td><td>1.001,00</td></tr></table></div>';
 const rate=parseBnaBillete(html,Date.parse('2026-10-26T16:00:00Z'));assert.equal(rate.rate_cents,145050);assert.equal(rate.quote_date,'2026-10-26');
 assert.throws(()=>parseBnaBillete(html.replace('id="billetes"','id="divisas"')),/billete/);
 assert.throws(()=>parseBnaBillete(html.replace('26/10/2026','sin fecha')),/fecha/);
});
test('zonas detectan borde y no convierten radios propuestos en cobertura',()=>{
 const polygon=validatePolygon([[-59,-35],[-58,-35],[-58,-34],[-59,-34]]);
 assert.deepEqual(polygonContains(polygon,-58.5,-34.5),{inside:true,boundary:false});
 assert.deepEqual(polygonContains(polygon,-59,-34.5),{inside:true,boundary:true});
 assert.deepEqual(polygonContains(polygon,-57,-34.5),{inside:false,boundary:false});
 assert.throws(()=>validatePolygon([[1,1],[2,2],[3,3]]),/delimitan/);
});
test('acarreo USD39,50 convierte con precisión decimal y redondea centavos',()=>{
 assert.equal(convertFreight(3950,145050),5729475);
 assert.equal(convertFreight(2000,145050),2901000);
 assert.throws(()=>convertFreight(2000,null),/cotización/);
});
test('informe de publicidad conserva desconocidos y no presume rentabilidad',()=>{
 const report=validateAdsReport({source:'ML exportación',period_start:'2026-10-01',period_end:'2026-10-25',rows:[{item_id:'MLA1',visits:10,orders:0},{item_id:'MLA2',visits:20,orders:2,spend_cents:10000,attributed_sales_cents:20000}]},Date.parse('2026-10-26'));
 assert.equal(report.rows[0].spend_cents,null);
 const result=classifyAdsRows(report.rows,[{id:'MLA1',status:'active'},{id:'MLA2',status:'active'}]);
 assert.equal(result[0].portfolio,'review');assert.match(result[0].reason,/sin ventas/);assert.equal(result[1].portfolio,'winners');assert.equal(result[1].roas,2);
 assert.throws(()=>validateAdsReport({...report,rows:[{item_id:'MLA1',visits:-2}]}),/inválida/);
});

let mf,db;const mock=createFetchMock();mock.disableNetConnect();
before(async()=>{
 const source=`import {handleIntegrations} from './src/server/v3-integrations.mjs';export default {async fetch(request,env){const db=env.DB;await db.batch([db.prepare('CREATE TABLE IF NOT EXISTS pcc_settings (id INTEGER PRIMARY KEY,value TEXT,version INTEGER)'),db.prepare('CREATE TABLE IF NOT EXISTS pcc_listings (id TEXT PRIMARY KEY,title TEXT,status TEXT)'),db.prepare('CREATE TABLE IF NOT EXISTS pcc_audit (id TEXT,action TEXT,target TEXT,result TEXT,created INTEGER)')]);await db.prepare("INSERT OR IGNORE INTO pcc_settings VALUES (1,'{}',1)").run();try {const input=request.method==='POST'?await request.json():{};const out=await handleIntegrations(env,db,new URL(request.url).pathname,request.method,input);return Response.json(out);}catch(e){return Response.json({error:e.message},{status:e.status||500});}}}`;
 const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'v3-integration-test-entry.mjs'},bundle:true,write:false,format:'esm',platform:'browser',loader:{'.sql':'text'}});
 mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-30',d1Databases:{DB:'v3-integrations-test'},fetchMock:mock});db=await mf.getD1Database('DB');
});
after(async()=>{await mf?.dispose();await mock.close();});
const req=(path,data)=>mf.dispatchFetch('https://synthetic.test/api/pcc/v3/integrations/'+path,{method:data?'POST':'GET',headers:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined});
const ok=async(path,data)=>{const r=await req(path,data),out=await r.json();assert.equal(r.status,200,JSON.stringify(out));return out;};
test('cotización exige zona aprobada y congela el importe aceptado ante nuevo dólar',async()=>{
 const state=await ok('state');assert.equal(state.zones.length,3);assert.ok(state.zones.every(z=>!z.approved));
 await ok('fx/manual',{rate_cents:145050,quoted_at:Date.now(),source_note:'Fuente sintética BNA billete vendedor'});
 const polygon=[[-59,-35],[-58,-35],[-58,-34],[-59,-34]];
 await ok('zones/save',{id:'1',polygon,approved:false});
 const input={zone_id:'1',lat:-34.5,lon:-58.5,approximate:false,delivery_checked:true,fx_confirmed:true};
 const pending=await ok('quotes/create',input);assert.equal(pending.executable,false);assert.equal((await req('quotes/accept',{id:pending.id})).status,409);
 await ok('zones/save',{id:'1',polygon,approved:true});const q=await ok('quotes/create',input);assert.equal(q.executable,true);assert.equal(q.ars_cents,2901000);
 await ok('quotes/accept',{id:q.id});await ok('fx/manual',{rate_cents:160000,quoted_at:Date.now(),source_note:'Fuente sintética BNA billete vendedor'});
 const accepted=(await ok('state')).quotes.find(x=>x.id===q.id);assert.equal(accepted.status,'accepted');assert.equal(accepted.ars_cents,2901000);
 assert.equal((await req('quotes/create',{...input,lon:-57})).status,409);
});
test('fallo del banco conserva el último cambio y expone error sin marcar éxito',async()=>{
 mock.get('https://www.bna.com.ar').intercept({method:'GET',path:'/Personas'}).reply(403,'Access denied');
 const {fx}=await ok('fx/refresh',{});assert.equal(fx.status,'error');assert.equal(fx.rate_cents,160000);assert.equal(fx.error.remote_status,403);assert.match(fx.error.resource,/billete vendedor/);
});
test('importar métricas clasifica datos reales y no habilita gasto ni inventa API',async()=>{
 await db.prepare('INSERT INTO pcc_listings VALUES (?,?,?)').bind('MLA123','Producto sintético','active').run();
 const out=await ok('ads/import',{report:{source:'Informe sintético de exportación ML',period_start:'2026-10-01',period_end:'2026-10-25',rows:[{item_id:'MLA123',visits:100,orders:0}]}});assert.equal(out.candidates[0].portfolio,'review');
 const state=await ok('state');assert.equal(state.ads.status,'file_imported');assert.equal(state.capabilities.ads_read,false);assert.equal(state.ads.spending_enabled,false);assert.equal((await req('ads/refresh',{})).status,409);
});
