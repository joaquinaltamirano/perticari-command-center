import { Problem } from './security.mjs';
import { audit } from './db.mjs';
import { parseBnaBillete,validCoordinate,validatePolygon,polygonContains,convertFreight,validateAdsReport,classifyAdsRows } from '../domain/integrations.mjs';

const BNA='https://www.bna.com.ar/Personas',PREFIX='/api/pcc/v3/integrations/';
const schema=[
 'CREATE TABLE IF NOT EXISTS pcc_v3_integration_state (id TEXT PRIMARY KEY,value TEXT NOT NULL,updated INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS pcc_v3_delivery_zones (id TEXT PRIMARY KEY,name TEXT NOT NULL,usd_cents INTEGER NOT NULL,polygon TEXT NOT NULL,reference_names TEXT NOT NULL,approved INTEGER NOT NULL,updated INTEGER NOT NULL)',
 'CREATE TABLE IF NOT EXISTS pcc_v3_delivery_quotes (id TEXT PRIMARY KEY,value TEXT NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,accepted INTEGER)',
 'CREATE TABLE IF NOT EXISTS pcc_v3_geocache (query TEXT PRIMARY KEY,value TEXT NOT NULL,updated INTEGER NOT NULL)',
];
const defaults=[['1','Acarreo 1',2000,'Barracas, La Boca, Parque Patricios, Constitución, Avellaneda, Gerli y Sarandí'],['2','Acarreo 2',3950,'San Cristóbal, Boedo, Almagro, Retiro, Flores, Lugano, Soldati, Lanús, Escalada y Banfield'],['3','Acarreo 3',7900,'Mataderos, Liniers, Palermo, Chacarita y Lomas']];
const schemaReady=new WeakSet();
export async function ensureIntegrationSchema(db) {
 if(schemaReady.has(db))return;
 await db.batch(schema.map(sql=>db.prepare(sql)));
 await db.batch(defaults.map(([id,name,usd,refs])=>db.prepare("INSERT OR IGNORE INTO pcc_v3_delivery_zones VALUES (?,?,?,'[]',?,0,?)").bind(id,name,usd,refs,Date.now())));
 schemaReady.add(db);
}
const get=async(db,id)=>{const row=await db.prepare('SELECT value FROM pcc_v3_integration_state WHERE id=?').bind(id).first();return row?JSON.parse(row.value):null;};
const put=(db,id,value)=>db.prepare('INSERT INTO pcc_v3_integration_state VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated=excluded.updated').bind(id,JSON.stringify(value),Date.now()).run();
const zoneRow=z=>({...z,references:z.reference_names,polygon:JSON.parse(z.polygon),approved:!!z.approved});
const safeError=(e,label)=>({resource:label,message:e instanceof Problem?e.message:label+' no respondió con datos verificables',remote_status:Number.isInteger(e.remote_status)?e.remote_status:null,at:Date.now()});
async function fetchBounded(url,init={},max=1000000){
 let response;try{response=await fetch(url,{...init,redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw new Problem('No se pudo conectar con la fuente externa',503);}
 if(!response.ok){const e=new Problem('La fuente externa rechazó la consulta ('+response.status+')',502);e.remote_status=response.status;throw e;}
 const reader=response.body.getReader();let size=0,parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Problem('Respuesta externa demasiado grande',502);}parts.push(value);}
 const joined=new Uint8Array(size);let offset=0;for(const p of parts){joined.set(p,offset);offset+=p.length;}
 return new TextDecoder().decode(joined);
}

async function refreshFx(db,{force=false}={}){
 const previous=await get(db,'fx'),now=Date.now();
 if(!force&&previous?.checked_at&&now-previous.checked_at<3600000)return previous;
 // Claim before I/O so two cron invocations cannot both poll the bank.
 const lock=await db.prepare("INSERT INTO pcc_v3_integration_state VALUES ('fx_lock','{}',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated<?").bind(now,now-60000).run();
 if(!lock.meta.changes)return previous||{status:'checking'};
 try{
  const parsed=parseBnaBillete(await fetchBounded(BNA),now);
  const fx={...parsed,checked_at:now,last_success:now,status:'ready',error:null,manual:false};
  await put(db,'fx',fx);
  // Keep V1 quoting consistent with the official indicator without changing tariff coverage.
  await syncFxSetting(db,fx);
  return fx;
 }catch(e){const fx={...(previous||{}),status:'error',checked_at:now,error:safeError(e,'BNA · USD billete vendedor')};await put(db,'fx',fx);return fx;}
}
async function syncFxSetting(db,fx){
 await db.prepare("UPDATE pcc_settings SET value=json_set(value,'$.fx_cents',?,'$.fx_at',?,'$.fx_source',?),version=version+1 WHERE id=1").bind(fx.rate_cents,fx.quoted_at,fx.source+' · billete vendedor'+(fx.manual?' · manual':'')).run();
}
async function readState(env,db){
 const [fx,zones,quotes,report,candidates,providers]=await Promise.all([get(db,'fx'),db.prepare('SELECT * FROM pcc_v3_delivery_zones ORDER BY id').all(),db.prepare('SELECT * FROM pcc_v3_delivery_quotes ORDER BY created DESC LIMIT 50').all(),get(db,'ads_report'),get(db,'ads_candidates'),get(db,'providers')]);
 return {fx:fx||{status:'pending',source:'Banco de la Nación Argentina',indicator:'USD billete vendedor',rate_cents:null},zones:zones.results.map(zoneRow),quotes:quotes.results.map(q=>({...JSON.parse(q.value),id:q.id,status:q.status,created:q.created,expires:q.expires,accepted:q.accepted})),ads:{snapshot:report?{...report,rows:undefined,row_count:report.rows.length}:null,candidates:candidates||[],status:report?'file_imported':'pending',portfolios:[{id:'discovery',name:'Descubrimiento'},{id:'winners',name:'Escala de ganadoras'},{id:'opportunities',name:'Oportunidades / estacionalidad'}],api_status:'contract_pending',spending_enabled:false},providers:providers||{geocoding_enabled:false,routing_enabled:false},capabilities:{geocoding:env.PCC_GEOCODING_ENABLED==='true'||providers?.geocoding_enabled===true,routing:env.PCC_ROUTING_ENABLED==='true'||providers?.routing_enabled===true,ads_read:false,ads_write:false,fx_source:BNA,origin:'San Antonio 1250, Barracas, CABA',routing_note:'Ruta de automóvil orientativa; dimensiones y vehículo requieren comprobación'}};
}

async function geocode(env,db,input){
 const providers=await get(db,'providers');
 if(env.PCC_GEOCODING_ENABLED!=='true'&&providers?.geocoding_enabled!==true)throw new Problem('Habilitá el servicio gratuito de búsqueda de direcciones antes de enviar una dirección al proveedor',409);
 const query=String(input.query||'').trim();if(query.length<4||query.length>240)throw new Problem('Ingresá una dirección o localidad y código postal');
 const key=query.normalize('NFKC').toLowerCase(),cached=await db.prepare('SELECT value,updated FROM pcc_v3_geocache WHERE query=?').bind(key).first();
 if(cached&&Date.now()-cached.updated<86400000)return {results:JSON.parse(cached.value),cached:true,attribution:'© OpenStreetMap contributors'};
 const now=Date.now(),locked=await db.prepare("INSERT INTO pcc_v3_integration_state VALUES ('geocode_lock','{}',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated<?").bind(now,now-1100).run();
 if(!locked.meta.changes)throw new Problem('Esperá un segundo antes de otra búsqueda de dirección',429);
 const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('q',query);u.searchParams.set('countrycodes','ar');u.searchParams.set('format','jsonv2');u.searchParams.set('limit','5');
 const data=JSON.parse(await fetchBounded(u.href,{headers:{'accept':'application/json','user-agent':'PerticariCommandCenter/3.0 ('+(env.PCC_ORIGIN||'https://perticari-notificaiones.perticari-sa.workers.dev')+')'}}));
 if(!Array.isArray(data))throw new Problem('El geocodificador devolvió una respuesta inválida',502);
 const results=data.slice(0,5).map(r=>({lat:Number(r.lat),lon:Number(r.lon),label:String(r.display_name||'').slice(0,500),type:String(r.type||''),approximate:!['house','building'].includes(r.type)})).filter(validCoordinate);
 await db.prepare('INSERT INTO pcc_v3_geocache VALUES (?,?,?) ON CONFLICT(query) DO UPDATE SET value=excluded.value,updated=excluded.updated').bind(key,JSON.stringify(results),now).run();
 return {results,cached:false,attribution:'© OpenStreetMap contributors'};
}
async function route(env,db,input){
 const providers=await get(db,'providers');
 if(env.PCC_ROUTING_ENABLED!=='true'&&providers?.routing_enabled!==true)throw new Problem('Habilitá el cálculo vial orientativo OSRM antes de consultar una ruta',409);
 if(!validCoordinate(input.origin)||!validCoordinate(input.destination))throw new Problem('Elegí coordenadas de origen y destino válidas');
 const a=input.origin,b=input.destination,url=`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`;
 const now=Date.now(),locked=await db.prepare("INSERT INTO pcc_v3_integration_state VALUES ('route_lock','{}',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated<?").bind(now,now-1100).run();
 if(!locked.meta.changes)throw new Problem('Esperá un segundo antes de consultar otra ruta',429);
 const result=JSON.parse(await fetchBounded(url,{headers:{accept:'application/json'}}));
 const r=result.routes?.[0];if(result.code!=='Ok'||!r||!Number.isFinite(r.distance)||!Number.isFinite(r.duration))throw new Problem('No se encontró un recorrido vial verificable',502);
 return {distance_meters:Math.round(r.distance),duration_seconds:Math.round(r.duration),provider:'OSRM',profile:'driving',vehicle_verified:false,note:'Referencia vial de automóvil; no verifica restricciones de camión ni capacidad de entrega'};
}

export async function handleIntegrations(env,db,path,method,input={}){
 if(!path.startsWith(PREFIX))return null;
 await ensureIntegrationSchema(db);const action=path.slice(PREFIX.length);
 if(method==='GET'&&action==='state')return readState(env,db);
 if(method!=='POST')throw new Problem('Método no permitido',405);
 if(action==='providers/save'){
  if(typeof input.geocoding_enabled!=='boolean'||typeof input.routing_enabled!=='boolean')throw new Problem('Configuración de mapas inválida');
  if((input.geocoding_enabled||input.routing_enabled)&&input.external_lookup_acknowledged!==true)throw new Problem('Confirmá que las direcciones/coordenadas se consultarán con OpenStreetMap/OSRM',409);
  const value={geocoding_enabled:input.geocoding_enabled,routing_enabled:input.routing_enabled,acknowledged_at:Date.now()};await put(db,'providers',value);await audit(db,'v3_maps_providers','maps',value);return {providers:value};
 }
 if(action==='fx/refresh')return {fx:await refreshFx(db,{force:true})};
 if(action==='fx/manual'){
  if(!Number.isSafeInteger(input.rate_cents)||input.rate_cents<=0||input.rate_cents>100000000||!String(input.source_note||'').trim())throw new Problem('Indicá cotización en centavos y fuente de la carga manual');
  const quoted=typeof input.quoted_at==='number'?input.quoted_at:Date.parse(input.quoted_at);
  if(!Number.isFinite(quoted)||quoted>Date.now()+60000||quoted<Date.now()-7*86400000)throw new Problem('Fecha de cotización manual inválida o mayor a siete días');
  const fx={rate_cents:input.rate_cents,quoted_at:quoted,checked_at:Date.now(),last_success:Date.now(),source:String(input.source_note).slice(0,200),indicator:'USD billete vendedor · carga manual',manual:true,status:'manual',error:null};
  await put(db,'fx',fx);await syncFxSetting(db,fx);await audit(db,'v3_fx_manual','USD_ARS',{rate_cents:fx.rate_cents,quoted_at:quoted});return {fx};
 }
 if(action==='zones/save'){
  const id=String(input.id||'');if(!['1','2','3'].includes(id))throw new Problem('Acarreo inválido');
  if(input.usd_cents!=null&&input.usd_cents!==defaults.find(d=>d[0]===id)[2])throw new Problem('La tarifa USD no coincide con los tres acarreos aprobados');
  const polygon=validatePolygon(input.polygon),name=String(input.name||'Acarreo '+id).trim();if(name.length>100)throw new Problem('Nombre de zona demasiado largo');
  await db.prepare('UPDATE pcc_v3_delivery_zones SET name=?,polygon=?,approved=?,updated=? WHERE id=?').bind(name,JSON.stringify(polygon),input.approved===true?1:0,Date.now(),id).run();
  await audit(db,'v3_delivery_zone',id,{approved:input.approved===true,points:polygon.length});return {ok:true};
 }
 if(action==='geocode')return geocode(env,db,input);
 if(action==='route')return route(env,db,input);
 if(action==='quotes/create'){
  if(!validCoordinate(input))throw new Problem('Confirmá la ubicación antes de cotizar');
  const zones=(await db.prepare('SELECT * FROM pcc_v3_delivery_zones').all()).results.map(zoneRow),matches=zones.map(z=>({...z,match:polygonContains(z.polygon,input.lon,input.lat)})).filter(z=>z.match.inside);
  const zone=matches.find(z=>z.id===String(input.zone_id||''))||matches[0];
  if(!zone)throw new Problem('La ubicación está fuera de las zonas dibujadas. Requiere cotización manual o agencia.',409);
  const fx=await get(db,'fx');if(!fx?.rate_cents)throw new Problem('Falta una cotización de dólar válida',409);
  const reasons=[];
  if(!zone.approved)reasons.push('Zona pendiente de aprobación');
  if(zone.match.boundary||matches.length>1)reasons.push('Ubicación en borde o superposición de zonas');
  if(input.approximate!==false)reasons.push('Confirmar dirección exacta y condiciones de entrega');
  if(fx.status==='error'||fx.manual||Date.now()-fx.quoted_at>4*86400000)reasons.push('Confirmar vigencia y fuente del dólar');
  if(input.delivery_checked!==true)reasons.push('Confirmar dimensiones, peso y posibilidad de reparto');
  const fxConfirmed=input.fx_confirmed===true;
  const blocking=reasons.filter(r=>!(fxConfirmed&&r==='Confirmar vigencia y fuente del dólar'));
  const id=crypto.randomUUID(),now=Date.now(),value={zone_id:zone.id,zone_name:zone.name,usd_cents:zone.usd_cents,rate_cents:fx.rate_cents,ars_cents:convertFreight(zone.usd_cents,fx.rate_cents),fx_source:fx.source,fx_quoted_at:fx.quoted_at,location_label:String(input.location_label||'Ubicación confirmada').slice(0,300),lat:input.lat,lon:input.lon,reasons,executable:blocking.length===0};
  await db.prepare('INSERT INTO pcc_v3_delivery_quotes VALUES (?,?,?,?,?,NULL)').bind(id,JSON.stringify(value),'proposed',now,now+86400000).run();
  await audit(db,'v3_quote_created',id,{zone_id:zone.id,ars_cents:value.ars_cents,executable:value.executable});return {id,...value,expires:now+86400000};
 }
 if(action==='quotes/accept'){
  const q=await db.prepare('SELECT * FROM pcc_v3_delivery_quotes WHERE id=?').bind(String(input.id||'')).first();if(!q)throw new Problem('Cotización no encontrada',404);
  if(q.status==='accepted')return {id:q.id,status:'accepted',...JSON.parse(q.value)};
  if(q.expires<Date.now())throw new Problem('La cotización venció; prepará una nueva',409);
  if(!JSON.parse(q.value).executable)throw new Problem('La cotización tiene verificaciones pendientes',409);
  const zone=await db.prepare('SELECT approved,updated FROM pcc_v3_delivery_zones WHERE id=?').bind(JSON.parse(q.value).zone_id).first();
  if(!zone?.approved||zone.updated>q.created)throw new Problem('La cobertura cambió; prepará una cotización con la zona actual',409);
  await db.prepare("UPDATE pcc_v3_delivery_quotes SET status='accepted',accepted=? WHERE id=? AND status='proposed'").bind(Date.now(),q.id).run();await audit(db,'v3_quote_accepted',q.id,{});return {id:q.id,status:'accepted',...JSON.parse(q.value)};
 }
 if(action==='ads/import'){
  const report=validateAdsReport(input.report),safe={...report,imported_at:Date.now(),mode:'owner_file_import'};await put(db,'ads_report',safe);
  await audit(db,'v3_ads_report_import','Product Ads',{row_count:safe.rows.length,period_start:safe.period_start,period_end:safe.period_end});return classifyAds(db,safe);
 }
 if(action==='ads/classify'){const report=await get(db,'ads_report');if(!report)throw new Problem('Importá un informe real de publicaciones/publicidad para evaluar resultados',409);return classifyAds(db,report);}
 if(action==='ads/refresh')throw new Problem('Product Ads: falta verificar el contrato y permisos de lectura de la cuenta. Podés importar un informe exportado de ML; no se ejecutará gasto.',409);
 throw new Problem('Recurso no encontrado',404);
}
async function classifyAds(db,report){
 const listings=(await db.prepare('SELECT id,title,status FROM pcc_listings LIMIT 10000').all()).results,candidates=classifyAdsRows(report.rows,listings);
 await put(db,'ads_candidates',candidates);return {candidates,period_start:report.period_start,period_end:report.period_end,source:report.source,spending_enabled:false};
}
export async function integrationTick(env,db){await ensureIntegrationSchema(db);return {fx:await refreshFx(db)};}
