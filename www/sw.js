/*
 * Service worker: saves the whole app on the device the first time it is
 * opened from a website, so afterwards it works with no internet (iPhone / browser).
 * Not used inside the Android APK, which already contains all the files.
 *
 * When you change any file, raise VERSION so devices download the new files.
 */
var VERSION = 'v19';
var CACHE = 'bdolach-' + VERSION;

var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/awake-video.js',
  'content/book.js',
  'content/white.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  // cache: 'reload' downloads each file fresh. Websites tell browsers to keep
  // files for a while (GitHub Pages: 10 minutes), and without this a new
  // version could be saved with a file left over from the old one.
  var fresh = FILES.map(function (f) { return new Request(f, { cache: 'reload' }); });
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(fresh); }));
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
