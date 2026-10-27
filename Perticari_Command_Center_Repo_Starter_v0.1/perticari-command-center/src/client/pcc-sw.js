self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Never cache authenticated API responses, customer data or application pages.
self.addEventListener('push',event=>{let data={title:'Perticari',body:'Tenés una novedad en tu centro de trabajo.'};try{if(event.data)data={...data,...event.data.json()};}catch{}event.waitUntil(self.registration.showNotification(data.title,{body:data.body||data.detail||'',tag:data.tag||'pcc-important',data:{url:'/app/#automation'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const window of windows)if(new URL(window.url).origin===self.location.origin){await window.navigate('/app/#automation');return window.focus();}return self.clients.openWindow('/app/#automation');})());});
