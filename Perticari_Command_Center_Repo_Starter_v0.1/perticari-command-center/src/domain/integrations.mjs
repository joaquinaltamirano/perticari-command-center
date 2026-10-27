import { cents } from './money.mjs';

const invalid = message => { throw Object.assign(new Error(message), {status:400}); };
export function parseBnaBillete(html, now=Date.now()) {
 if(typeof html!=='string'||html.length>1000000)invalid('Respuesta BNA inválida');
 // BNA exposes both billete and divisa on the same page. Never take the first dollar row.
 const section=html.match(/\bid\s*=\s*["'](?:cotizacion)?billetes?["'][^>]*>([\s\S]*?)(?=\bid\s*=\s*["'](?:cotizacion)?divisas?["']|$)/i)?.[1];
 if(!section)invalid('No se pudo identificar la sección dólar billete de BNA');
 const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
 const rows=[...section.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
 const row=rows.map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>clean(c[1]))).find(c=>/^d[oó]lar\s*(?:u\.?s\.?a\.?|estadounidense|usa|u\.?s\.?d\.?)?$/i.test(c[0]||''));
 if(!row||row.length!==3)invalid('No se pudo identificar compra/venta del dólar billete BNA');
 const rate=cents(row[2]);if(!rate||rate>100000000)invalid('Cotización vendedora BNA fuera de rango');
 const dates=[...clean(section).matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
 if(!dates.length)invalid('La cotización BNA no incluye una fecha verificable');
 const [,d,m,y]=dates[0],date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,quotedAt=Date.parse(date+'T12:00:00-03:00');
 if(!Number.isFinite(quotedAt)||new Date(quotedAt-3*3600000).toISOString().slice(0,10)!==date||quotedAt>now+86400000)invalid('Fecha BNA inválida');
 return {rate_cents:rate,quoted_at:quotedAt,quote_date:date,indicator:'USD billete vendedor',source:'Banco de la Nación Argentina',source_url:'https://www.bna.com.ar/Personas'};
}

export function validCoordinate(value) {
 return value&&Number.isFinite(value.lat)&&Number.isFinite(value.lon)&&value.lat>=-90&&value.lat<=90&&value.lon>=-180&&value.lon<=180;
}
export function validatePolygon(raw) {
 if(!Array.isArray(raw)||raw.length<3||raw.length>200)invalid('La zona necesita de 3 a 200 puntos [longitud, latitud]');
 const points=raw.map(p=>{if(!Array.isArray(p)||p.length!==2||!validCoordinate({lon:p[0],lat:p[1]}))invalid('Coordenada de zona inválida');return [...p];});
 const area=points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0);
 if(Math.abs(area)<1e-10)invalid('Los puntos no delimitan una zona');
 return points;
}
export function polygonContains(polygon,lon,lat) {
 if(!Array.isArray(polygon)||polygon.length<3)return {inside:false,boundary:false};
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[j],b=polygon[i],cross=(lon-a[0])*(b[1]-a[1])-(lat-a[1])*(b[0]-a[0]);
  if(Math.abs(cross)<1e-9&&lon>=Math.min(a[0],b[0])-1e-9&&lon<=Math.max(a[0],b[0])+1e-9&&lat>=Math.min(a[1],b[1])-1e-9&&lat<=Math.max(a[1],b[1])+1e-9)return {inside:true,boundary:true};
  if(((a[1]>lat)!==(b[1]>lat))&&(lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 }
 return {inside,boundary:false};
}
export function convertFreight(usdCents,rateCents) {
 if(!Number.isSafeInteger(usdCents)||usdCents<0||!Number.isSafeInteger(rateCents)||rateCents<=0)invalid('Falta una tarifa USD o cotización válida');
 const result=(BigInt(usdCents)*BigInt(rateCents)+50n)/100n;
 if(result>BigInt(Number.MAX_SAFE_INTEGER))invalid('Cotización fuera de rango');
 return Number(result);
}
export function classifyAdsRows(rows,listings=[]) {
 const byId=new Map(listings.map(l=>[l.id,l]));
 return rows.map(row=>{
  const listing=byId.get(row.item_id),live=listing?.status==='active';
  let portfolio='review',reason='Información insuficiente; revisar ficha y métricas antes de invertir';
  if(!listing){reason='Publicación no vinculada al catálogo consultado';}
  else if(!live){reason='La publicación no está activa';}
  else if(row.orders>0&&row.visits>0){portfolio='winners';reason='Tiene visitas y ventas observadas; revisar cobertura de costos antes de escalar';}
  else if(row.visits===0&&row.orders===0){portfolio='discovery';reason='Sin visitas ni ventas en el período importado; validar ficha y disponibilidad';}
  else if(row.visits>0&&row.orders===0){reason='Tiene visitas sin ventas: revisar precio, ficha y entrega antes de aumentar inversión';}
  return {...row,title:listing?.title||row.item_id,portfolio,reason,roas:row.spend_cents>0&&row.attributed_sales_cents!=null?row.attributed_sales_cents/row.spend_cents:null,acos:row.attributed_sales_cents>0&&row.spend_cents!=null?row.spend_cents/row.attributed_sales_cents:null};
 });
}

export function validateAdsReport(report,now=Date.now()) {
 if(!report||typeof report.source!=='string'||report.source.trim().length<5||report.source.length>200||!Array.isArray(report.rows)||report.rows.length>10000||!report.rows.length)invalid('Importá un informe con fuente, período y hasta 10.000 publicaciones');
 const start=typeof report.period_start==='number'?report.period_start:Date.parse(report.period_start),end=typeof report.period_end==='number'?report.period_end:Date.parse(report.period_end);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||end>now+86400000)invalid('Período del informe inválido');
 const seen=new Set();
 const rows=report.rows.map(r=>{
  if(!/^MLA\d+$/.test(r.item_id)||seen.has(r.item_id))invalid('Publicación inválida o repetida en el informe');seen.add(r.item_id);
  const out={item_id:r.item_id};
  for(const key of ['visits','clicks','orders','spend_cents','attributed_sales_cents','impressions']){
   const n=r[key];if(n!=null&&(!Number.isSafeInteger(n)||n<0))invalid('Métrica inválida: '+key);out[key]=n??null;
  }
  return out;
 });
 return {source:report.source.trim(),period_start:start,period_end:end,rows};
}
