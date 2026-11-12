/*
 * Service worker: saves the whole app on the device the first time it is
 * opened from a website, so afterwards it works with no internet (iPhone / browser).
 * Not used inside the Android APK, which already contains all the files.
 *
 * When you change any file, raise VERSION so devices download the new files.
 */
var VERSION = 'v8';
var CACHE = 'bdolach-' + VERSION;

var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'content/book.js',
  'content/white.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Answer from the saved copy first (works offline); fall back to the network.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(e.request);
    })
  );
});
