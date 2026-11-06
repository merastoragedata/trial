/* Yatra Portal service worker: offline shell, push notifications, notification clicks */
const V='yatra-v7',SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
 if(r.mode==='navigate'||u.pathname.endsWith('/index.html')){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(V).then(ch=>ch.put('./index.html',c));return x}).catch(()=>caches.match('./index.html')));return}
 e.respondWith(caches.match(r).then(h=>{const n=fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(V).then(ch=>ch.put(r,c))}return x}).catch(()=>h);return h||n}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={title:'Yatra',body:e.data?e.data.text():''}}
 const prio=!!d.prio,o={body:d.body||'',tag:d.tag||'yatra',renotify:true,icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:{url:d.url||'./index.html#today',kind:d.kind},requireInteraction:prio||d.kind==='alarm',vibrate:prio?[600,200,600,200,600,200,600,200,1200]:[200,100,200],silent:false,timestamp:Date.now()};
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cl=>{const fg=cl.find(c=>c.visibilityState==='visible'&&c.focused);
  if(fg){fg.postMessage({type:'push',payload:d});if(!prio&&d.kind!=='alarm')return}
  return self.registration.showNotification(d.title||'Yatra',o)}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'./index.html#today';
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cl=>{for(const c of cl){if('focus' in c){c.postMessage({type:'open',url});return c.focus()}}return self.clients.openWindow(url)}))});
