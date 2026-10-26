import { cents } from '../domain/money.mjs';
import { familyOf,presentationOf } from '../domain/catalog.mjs';
import { Problem } from './security.mjs';
const origin='https://www.memosoft.net.ar',tenant='/_pedidos/2513/0/',entry=tenant+'index.php',catalog=tenant+'carrito/catalogo.php';
export function parseCatalog(html){
 const rows=[];let cells=[],inRow=false,inCell=false,text='';const strip=s=>s.replace(/\s+/g,' ').trim();
 return new Promise((resolve,reject)=>{
  new HTMLRewriter().on('tr.catalogo',{element(el){inRow=true;cells=[];el.onEndTag(()=>{if(cells.length>=4&&cells[0]&&cells[1]&&!/^(CODIGO|CÓDIGO)$/i.test(cells[0]))rows.push({sku:cells[0],name:cells[1],price_text:cells[3]});inRow=false;});}})
  .on('tr.catalogo td',{element(el){inCell=true;text='';el.onEndTag(()=>{cells.push(strip(text));inCell=false;});},text(chunk){if(inRow&&inCell)text+=chunk.text;}})
  .transform(new Response(html)).text().then(()=>resolve(rows),reject);
 });
}
async function readText(response){if(Number(response.headers.get('content-length'))>2000000)throw new Problem('Página MEMOSOFT demasiado grande',502);const reader=response.body.getReader(),parts=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Problem('Página MEMOSOFT demasiado grande',502);}parts.push(value);}const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return new TextDecoder().decode(out);}
function allowed(value,base=origin+entry){const u=new URL(value,base);if(u.origin!==origin||!u.pathname.startsWith(tenant)||/pedido|checkout|pago|comprar|confirmar/i.test(u.pathname.slice(tenant.length)))throw new Problem('MEMOSOFT indicó una ruta fuera del acceso invitado de lectura',409);return u;}
function updateJar(jar,response){const values=response.headers.getSetCookie?.()||[response.headers.get('set-cookie')||''];for(const value of values)for(const piece of value.split(/,(?=\s*[^;,=\s]+=)/)){const pair=piece.split(';')[0].trim(),i=pair.indexOf('=');if(i>0&&pair.length<4096)jar.set(pair.slice(0,i),pair.slice(i+1));}}
async function getGuest(url,jar,init={}){
 for(let n=0;n<5;n++){
  let response;try{response=await fetch(allowed(url).href,{...init,headers:{...(init.headers||{}),...(jar.size?{cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')}:{})},redirect:'manual',signal:AbortSignal.timeout(15000)});}catch(e){if(e instanceof Problem)throw e;throw new Problem('MEMOSOFT no es accesible desde el servidor. La importación de archivos sigue disponible.',503);}
  updateJar(jar,response);
  if([301,302,303,307,308].includes(response.status)){const loc=response.headers.get('location');if(!loc)throw new Problem('Redirección invitado incompleta',502);url=allowed(loc,url).href;if([301,302,303].includes(response.status))init={};continue;}
  if(!response.ok)throw new Problem('MEMOSOFT rechazó el acceso invitado ('+response.status+'). Usá importación de archivos.',503);
  return {response,url};
 }
 throw new Problem('MEMOSOFT excedió el límite de redirecciones de invitado',502);
}
async function observedGuestAction(html){
 const forms=[];let current=null,button=null;
 await new HTMLRewriter().on('form',{element(el){current={id:el.getAttribute('id'),action:el.getAttribute('action')||entry,method:(el.getAttribute('method')||'GET').toUpperCase(),fields:[]};forms.push(current);el.onEndTag(()=>{current=null;});}})
 .on('form input',{element(el){if(current&&el.getAttribute('type')==='hidden'&&el.getAttribute('name'))current.fields.push([el.getAttribute('name'),el.getAttribute('value')||'']);}})
 .on('#usuario-invitado',{element(el){button={href:el.getAttribute('href'),onclick:el.getAttribute('onclick'),name:el.getAttribute('name'),value:el.getAttribute('value')||'',form:current,formId:el.getAttribute('form'),tag:el.tagName,type:el.getAttribute('type')};}}).transform(new Response(html)).text();
 if(!button)throw new Problem('No se encontró el ingreso invitado. Usá Excel mientras se verifica el acceso.',409);
 const location=button.onclick?.match(/^\s*(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]\s*;?\s*$/)?.[1],href=button.href&&button.href!=='#'?button.href:location;
 if(href){const url=allowed(href);if(!/invitado|guest|catalogo/i.test(url.pathname+url.search))throw new Problem('El enlace invitado requiere revisión',409);return {url:url.href,init:{}};}
 const form=button.formId?forms.find(f=>f.id===button.formId):button.form;
 if(!form||!['button','input'].includes(button.tag)||button.onclick||button.type==='button'||!['GET','POST'].includes(form.method)||form.fields.length>30)throw new Problem('El formulario invitado requiere validar su solicitud. Usá el catálogo importado.',409);
 const url=allowed(form.action);if(![entry,catalog].includes(url.pathname)&&!/invitado|guest/.test(url.pathname))throw new Problem('Acción de formulario invitado no reconocida',409);
 const values=new URLSearchParams(form.fields);if(button.name)values.set(button.name,button.value);
 if(form.method==='GET'){for(const [k,v] of values)url.searchParams.set(k,v);return {url:url.href,init:{}};}
 return {url:url.href,init:{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:values.toString()}};
}
export async function guestPage(page=1,sessionCookie=null){
 if(!Number.isInteger(page)||page<1||page>500)throw new Problem('Página inválida');
 const jar=new Map((sessionCookie||'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
 if(!sessionCookie){const first=await getGuest(origin+entry,jar),html=await readText(first.response),action=await observedGuestAction(html);await getGuest(action.url,jar,action.init);}
 const result=await getGuest(origin+catalog+'?pagina='+page,jar),html=await readText(result.response),raw=await parseCatalog(html);
 if(!raw.length&&(page===1||/id\s*=\s*["']usuario-invitado/.test(html)))throw new Problem('MEMOSOFT no devolvió catálogo o venció la sesión invitado. Los precios previos se conservan.',409);
 if(!raw.length&&!/<table[^>]*(?:id|class)=["'][^"']*catalogo|no hay productos|sin resultados/i.test(html))throw new Problem('No se pudo verificar el fin del catálogo. Se conserva la lectura parcial y requiere revisión.',409);
 const products=raw.map(r=>{let price=null;try{price=cents(r.price_text);}catch{}const family=familyOf(r.name,r.sku),p=presentationOf(r.name,family);return {sku:r.sku,name:r.name,family,unit:p.unit,length:p.length,base_cents:price,currency:'ARS',source_at:Date.now(),source:'memosoft',technical:{}};});
 return {products,sessionCookie:[...jar].map(([k,v])=>k+'='+v).join('; ')};
}
