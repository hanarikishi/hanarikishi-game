// オフラインでも遊べるようにキャッシュする。更新したら VERSION を上げる。
const VERSION = 'life-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', '../parts/icon-192.png', '../parts/icon-512.png'];   // 絵や音は、遊んだぶんだけ自動でキャッシュされる
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // ネット優先: 常に最新を取りに行き、成功したらキャッシュを更新。オフライン時だけキャッシュを使う
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
