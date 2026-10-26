import { oauthConfig, adminSession, encryptValue, decryptValue, digest } from './oauth.mjs';
import { database } from './db.mjs';
export class Problem extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const secureHeaders={'cache-control':'no-store','referrer-policy':'strict-origin','x-content-type-options':'nosniff',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://auth.mercadolibre.com.ar https://www.mercadolibre.com.ar https://www.mercadolibre.com"};
export function json(value,status=200,extra={}){return new Response(JSON.stringify(value),{status,headers:{...secureHeaders,'content-type':'application/json; charset=utf-8',...extra}});}
export const getCookie=(request,name)=>(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
export const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
export async function body(request,max=5*1024*1024){
 if(Number(request.headers.get('content-length'))>max)throw new Problem('Archivo demasiado grande',413);
 if(!request.body)throw new Problem('Falta contenido');
 const reader=request.body.getReader(),parts=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Problem('Archivo demasiado grande',413);}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));}catch{throw new Problem('Contenido JSON inválido');}
}
export async function identity(request,env,requireMfa=true){
 let c;try{c=oauthConfig(env);}catch{throw new Problem('Completar la configuración en /connect',503);}
 const db=await database(env),session=await adminSession(request,db,c);
 if(!session)throw new Problem('Ingresá primero desde Conexión',401);
 if(request.method!=='GET'&&request.method!=='HEAD'&&(request.headers.get('origin')!==c.origin||new URL(request.url).origin!==c.origin))throw new Problem('Origen de solicitud no válido',403);
 let mfa=null;
 const token=getCookie(request,'__Host-pcc_mfa');
 if(token)mfa=await db.prepare('SELECT * FROM pcc_mfa_sessions WHERE hash=? AND admin_hash=? AND expires>?').bind(await digest(token),session.session_hash,Date.now()).first();
 if(requireMfa&&!mfa)throw new Problem('Verificá el segundo factor para abrir el panel',403);
 return {db,c,session,mfa};
}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes){let bits=0,value=0,result='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){result+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result;}
function decode32(text){let bits=0,value=0,out=[];for(const ch of text){value=(value<<5)|alphabet.indexOf(ch);bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return new Uint8Array(out);}
export async function totp(secret,counter){
 const key=await crypto.subtle.importKey('raw',decode32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const message=new Uint8Array(8);new DataView(message.buffer).setBigUint64(0,BigInt(counter));
 const hash=new Uint8Array(await crypto.subtle.sign('HMAC',key,message)),offset=hash.at(-1)&15;
 const binary=((hash[offset]&127)<<24)|(hash[offset+1]<<16)|(hash[offset+2]<<8)|hash[offset+3];
 return String(binary%1000000).padStart(6,'0');
}
export async function handleMfa(request,env,path){
 if(!['/api/pcc/session','/api/pcc/mfa/setup','/api/pcc/mfa/verify'].includes(path))throw new Problem('Recurso no encontrado',404);
 const {db,c,session}=await identity(request,env,false);
 const row=await db.prepare('SELECT * FROM pcc_mfa WHERE id=1').first();
 if(path==='/api/pcc/session'){
  const token=getCookie(request,'__Host-pcc_mfa');
  const active=token?await db.prepare('SELECT hash FROM pcc_mfa_sessions WHERE hash=? AND admin_hash=? AND expires>?').bind(await digest(token),session.session_hash,Date.now()).first():null;
  return json({enrolled:Boolean(row.secret),verified:Boolean(active)});
 }
 if(request.method!=='POST')throw new Problem('Método no permitido',405);
 if(path==='/api/pcc/mfa/setup'){
  if(row.secret)throw new Problem('El segundo factor ya está configurado',409);
  const secret=base32(crypto.getRandomValues(new Uint8Array(20)));
  await db.prepare('UPDATE pcc_mfa SET pending=? WHERE id=1 AND secret IS NULL').bind(await encryptValue(secret,c)).run();
  return json({secret,uri:`otpauth://totp/Perticari:Administrador?secret=${secret}&issuer=Perticari&algorithm=SHA1&digits=6&period=30`});
 }
 const input=await body(request,2048),code=String(input.code||'');
 const bucket=await digest(session.session_hash),window=Math.floor(Date.now()/600000);
 await db.prepare('INSERT INTO pcc_mfa_limits VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END').bind(bucket,window).run();
 const limit=await db.prepare('SELECT attempts FROM pcc_mfa_limits WHERE key=?').bind(bucket).first();
 if(limit.attempts>8)throw new Problem('Esperá 10 minutos antes de volver a intentar',429);
 if(!/^\d{6}$/.test(code)||!(row.secret||row.pending))throw new Problem('Código no válido',401);
 const secret=await decryptValue(row.secret||row.pending,c),counter=Math.floor(Date.now()/30000);
 let matched=null;
 for(const n of [counter-1,counter,counter+1])if(n>row.last_counter && await totp(secret,n)===code)matched=n;
 if(matched==null)throw new Problem('Código incorrecto o ya utilizado; esperá el siguiente',401);
 const changed=await db.prepare('UPDATE pcc_mfa SET secret=COALESCE(secret,pending),pending=NULL,last_counter=? WHERE id=1 AND last_counter<?').bind(matched,matched).run();
 if(changed.meta.changes!==1)throw new Problem('Código ya utilizado',409);
 const token=base32(crypto.getRandomValues(new Uint8Array(32)));
 await db.batch([db.prepare('DELETE FROM pcc_mfa_sessions WHERE expires<?').bind(Date.now()),db.prepare('INSERT INTO pcc_mfa_sessions VALUES (?,?,?)').bind(await digest(token),session.session_hash,Date.now()+8*3600000)]);
 return json({verified:true},200,{'set-cookie':cookie('__Host-pcc_mfa',token,8*3600)});
}
