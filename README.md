# בד"ח סופה — digital checklist

An offline Android tablet app that replaces the PDF of the emergency-procedures booklet.
Pilot scope: the **white tab (בד"ח מז"א)**, pages 180–182 of the PDF.

The app is plain HTML, CSS and JavaScript. There is no framework and no build step.
Capacitor wraps it as an Android app (APK), and it never needs internet.

## Folder structure

```
www/                  ← the app itself (everything that goes into the APK)
  index.html          page skeleton
  sw.js, manifest.webmanifest, icons/   offline + "Add to Home Screen" support
  css/app.css         all styling (colours, night mode, sizes)
  js/app.js           renders the content, navigation, notes, ticks
  content/
    book.js           book details + the colour tabs
    white.js          white tab pages (the instructions for writing content are at the top)
.github/workflows/android.yml   builds the APK on GitHub on every push
icon/                           app icon: icon.png (1024×1024) + make-icons.py, which makes every size
signing/debug.keystore          fixed signing key, so updates install over the old app
capacitor.config.json           app id and name for Android
```

## Adding or editing content

All content lives in `www/content/`. Each tab has its own file, which calls `BOOK.addPages(...)`.
The top of `white.js` explains the format:

- `**bold**` — bold text
- `^1` — boxed note reference; tapping it opens the tab's notes page at note 1 ("חזור" returns)
- `(חח-43)` — becomes a link to that page. If the page isn't in the app yet, the link is grey and says so.

To add a new tab, create `www/content/<tab>.js` and add a `<script>` line for it in `www/index.html`.

## Running it on your computer

Open `www/index.html` directly in Chrome. To test the tablet size, use DevTools → device toolbar.
Alternatively, `npm start` serves it at http://localhost:8080.

## Getting the APK

1. Push to GitHub. The **Build Android APK** workflow runs automatically.
2. On GitHub, go to **Actions** → the latest run → **Artifacts** → download `bdolach-apk` (a zip containing `bdolach.apk`).
3. Copy `bdolach.apk` to the tablet (USB cable or file transfer) and open it to install.
   Android asks you to allow installing from that source the first time.

New versions install over the old one, because every build is signed with the same key.

The app keeps the screen on while it is open, however long it goes without a tap:
- Android: set natively when the app starts (`native/android/MainActivity.java`, copied in by the APK build).
- iPhone / iPad: the Wake Lock API, plus a tiny silent video (`www/js/awake-video.js`) playing out of sight,
  because before iOS 18.4 the Wake Lock does nothing in an app added to the home screen.
- Other browsers: the Wake Lock API.
The build copies Capacitor's JavaScript into `www/js/capacitor.js`; that file is not kept in the repo.

## Changing the app icon

Replace `icon/icon.png` with a new 1024×1024 picture, then run `python3 icon/make-icons.py`
(needs `pip install pillow numpy`). It rewrites `www/icons/` (iPhone/browser) and `icon/android-res/`
(Android, copied into the APK by the build). Raise `VERSION` in `sw.js` afterwards.

## iPhone / iPad (and any browser)

The same `www/` folder also works as an installable web app (PWA), and it works offline.

It is published on GitHub Pages at **https://tsegev07-sudo.github.io/bdolach/**.
The **Publish website** workflow (`.github/workflows/pages.yml`) updates the site on every push to `main`.
(One-time setup, if the workflow can't turn Pages on by itself: Settings → Pages → Source: **GitHub Actions**.)

1. On the iPhone, open the address in Safari → Share → **Add to Home Screen**.
2. Open it once while online. After that it runs full screen, with no internet.

The site used to be on Netlify; `netlify.toml` is kept in case it moves back, and is not used by GitHub Pages.

`www/sw.js` saves the files on the device. **Whenever you change any file in `www/`, raise `VERSION` in `sw.js`**
(v1 → v2 …) so phones download the new version. They pick it up the next time the app is opened online.
