// オフラインでも遊べるようにキャッシュする。更新したら VERSION を上げる。
const VERSION = 'hanarikishi-v8';
const PREFIX = VERSION.replace(/v\d+$/, '');   // 自分のキャッシュの名前の頭（ほかのゲームのキャッシュは消さない）
const FILES = [
  './', './index.html', '../share.js', '../back.js', '../rank.js', '../firebase-config.js', './matter.min.js', './manifest.webmanifest',
  '../parts/body_color.png', '../parts/mawashi.png', '../parts/body_line.png',
  '../parts/normal.png', '../parts/collision.png',
  '../parts/win.png', '../parts/home.png',
  '../parts/icon-192.png', '../parts/icon-512.png', '../parts/icon-maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // ネット優先: 常に最新を取りに行き、成功したらキャッシュを更新。オフライン時だけキャッシュを使う
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {   // 失敗した応答や、よそのサイトの通信は とっておかない
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
