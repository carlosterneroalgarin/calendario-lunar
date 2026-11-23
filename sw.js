// 1) Funciona sin internet: guarda la app la primera vez que se abre.
// 2) Avisos: una vez al día (Periodic Background Sync, Chrome Android con la app instalada)
//    mira si la luna llena está a 3 días o menos y lo notifica una sola vez por luna.
importScripts("./luna.js");

const CACHE = "luna-v2";
const STATE = "luna-estado";
const ASSETS = ["./", "./index.html", "./luna.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== STATE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

// ---- Avisos ----
async function getState(key) {
  const r = await (await caches.open(STATE)).match("/estado/" + key);
  return r ? r.text() : null;
}
async function setState(key, val) {
  await (await caches.open(STATE)).put("/estado/" + key, new Response(String(val)));
}

async function comprobarAviso(forzar) {
  if (await getState("avisos") !== "on" && !forzar) return;
  const a = avisoPara(new Date());
  if (!a) return;
  if (!forzar && await getState("ultimo") === a.id) return; // ya avisado para esta luna
  await self.registration.showNotification(a.title, {
    body: a.body, icon: "icon-192.png", badge: "icon-192.png", tag: "luna-" + a.id, lang: "es-ES"
  });
  if (!forzar) await setState("ultimo", a.id);
}

self.addEventListener("periodicsync", e => {
  if (e.tag === "luna-diaria") e.waitUntil(comprobarAviso(false));
});

self.addEventListener("message", e => {
  const m = e.data || {};
  if (m.type === "avisos") e.waitUntil(setState("avisos", m.on ? "on" : "off").then(() => m.on && comprobarAviso(false)));
  if (m.type === "comprobar") e.waitUntil(comprobarAviso(false));
  if (m.type === "prueba") e.waitUntil(self.registration.showNotification("Aviso de prueba", {
    body: "Así te avisaré 3 días antes de cada luna llena.", icon: "icon-192.png", badge: "icon-192.png", tag: "luna-prueba"
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
