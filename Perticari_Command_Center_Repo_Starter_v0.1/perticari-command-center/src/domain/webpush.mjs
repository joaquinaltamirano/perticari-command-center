const enc=new TextEncoder();
export const pushB64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const pushUnb64=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const concat=(...parts)=>{const n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
async function hkdf(ikm,salt,info,length){const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));}
export function validatePushSubscription(value){
 let url;try{url=new URL(value?.endpoint);}catch{throw new Error('Endpoint push inválido');}
 const allowed=url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname==='web.push.apple.com'||url.hostname.endsWith('.notify.windows.com');
 if(!allowed||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||url.href.length>4096)throw new Error('Proveedor push no permitido');
 let pub,auth;try{pub=pushUnb64(value.keys.p256dh);auth=pushUnb64(value.keys.auth);}catch{throw new Error('Claves push inválidas');}
 if(pub.length!==65||pub[0]!==4||auth.length!==16)throw new Error('Claves push inválidas');
 return {endpoint:url.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export async function createVapidKeys(){
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return {public_key:pushB64(await crypto.subtle.exportKey('raw',pair.publicKey)),private_jwk:await crypto.subtle.exportKey('jwk',pair.privateKey)};
}
export async function encryptedPushRequest(subscription,payload,vapid,subject,now=Date.now()){
 const sub=validatePushSubscription(subscription),client=pushUnb64(sub.keys.p256dh),auth=pushUnb64(sub.keys.auth),json=enc.encode(JSON.stringify(payload));
 if(json.length>2000)throw new Error('Aviso push demasiado grande');
 const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const server=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
 const clientKey=await crypto.subtle.importKey('raw',client,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:clientKey},pair.privateKey,256));
 const ikm=await hkdf(shared,auth,concat(enc.encode('WebPush: info\0'),client,server),32),salt=crypto.getRandomValues(new Uint8Array(16));
 const cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128},key,concat(json,new Uint8Array([2]))));
 const header=new Uint8Array(21);header.set(salt);new DataView(header.buffer).setUint32(16,4096);header[20]=server.length;
 const token=pushB64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+pushB64(enc.encode(JSON.stringify({aud:new URL(sub.endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:subject})));
 const signing=await crypto.subtle.importKey('jwk',vapid.private_jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signing,enc.encode(token));
 return {url:sub.endpoint,init:{method:'POST',redirect:'manual',headers:{'content-type':'application/octet-stream','content-encoding':'aes128gcm','TTL':'3600','Urgency':'high','Authorization':'vapid t='+token+'.'+pushB64(signature)+', k='+vapid.public_key},body:concat(header,server,cipher)}};
}
