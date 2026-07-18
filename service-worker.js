const CACHE_NAME = 'smart-sage-v4';
const ASSETS = [
  'index.html',
  'index.tsx',
  'App.tsx',
  'manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
