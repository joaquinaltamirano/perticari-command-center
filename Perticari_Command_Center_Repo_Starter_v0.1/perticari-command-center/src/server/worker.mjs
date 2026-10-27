import notifications from './notifications.mjs';
import { scheduledOAuth } from './oauth.mjs';
import { database,policies } from './db.mjs';
import { api } from './api.mjs';
import { json,Problem,secureHeaders } from './security.mjs';
import { schedule } from './jobs.mjs';
import assets from 'virtual:assets';
import {publicWorkflowAsset} from './publication-workflow.mjs';
import {faqTick} from './faq.mjs';
import {integrationTick} from './v3-integrations.mjs';
import {automationTick} from './v3-automation.mjs';
export default {
 async fetch(request,env,ctx){
  const path=new URL(request.url).pathname;
  try{
   if(path.startsWith('/media/pcc/')&&['GET','HEAD'].includes(request.method)){const asset=await publicWorkflowAsset(env,path);if(asset)return request.method==='HEAD'?new Response(null,{status:asset.status,headers:asset.headers}):asset;}
   if(path.startsWith('/api/pcc/'))return await api(request,env,ctx);
   if(path==='/app'||path==='/app/'||path.startsWith('/app/assets/')){
    if(!['GET','HEAD'].includes(request.method))return json({error:'Método no permitido'},405);
    const asset=assets[path.startsWith('/app/assets/')?path:'/app'];
    if(!asset)return json({error:'Archivo no encontrado'},404);
    return new Response(request.method==='HEAD'?null:asset.body,{headers:{...secureHeaders,'content-type':asset.type,...(path.endsWith('/pcc-sw.js')?{'service-worker-allowed':'/app'}:{})}});
   }
   if(path==='/')return new Response(null,{status:302,headers:{location:'/app','cache-control':'no-store'}});
   const response=await notifications.fetch(request,env,ctx);
   if(request.method==='POST'&&path==='/api/integrations/mercadolibre/notifications'&&response.ok)ctx.waitUntil((async()=>{try{await schedule(env,await database(env),{force:true});}catch{}})());
   return response;
  }catch(error){
   return json({error:error instanceof Problem?error.message:'No se pudo completar la solicitud. Los datos previos se conservan.'},error instanceof Problem?error.status:503);
  }
 },
 async scheduled(event,env,ctx){ctx.waitUntil((async()=>{await scheduledOAuth(env);try{const db=await database(env);try{await schedule(env,db);}catch{}if(!(await policies(db)).pause_jobs){try{await integrationTick(env,db);}catch{}}try{await automationTick(env,db);}catch{}try{await faqTick(env,db);}catch{}}catch{/* No tokens or customer text in runtime logs. */}})());},
};
