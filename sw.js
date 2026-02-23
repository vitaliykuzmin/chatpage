// Service Worker для PWA — CDN Bakery Chat
const CACHE = 'cdnbakery-v1';
const BASE = '/chatpage/';
const SHELL = [BASE, BASE + 'index.html', BASE + 'manifest.json', BASE + 'icon-192.png', BASE + 'icon-512.png'];

// Установка: кэшируем оболочку приложения
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: shell из кэша, остальное — сеть
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Запросы к chat.cdnbakery.com — всегда через сеть
  if (url.hostname === 'chat.cdnbakery.com') {
    e.respondWith(fetch(e.request).catch(() => new Response('Нет соединения', { status: 503 })));
    return;
  }

  // Shell PWA — из кэша, fallback к сети
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
