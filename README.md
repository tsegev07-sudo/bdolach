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
tools/make-offline.py           builds dist/bdolach-offline.html, the one-file version for closed networks
tools/make-pdf-export.py        builds dist/closed-network/, PDFs for building the tablet app in Android Studio inside
android-studio/                 the Android Studio files and steps that go into those PDFs
.github/workflows/offline.yml   builds both on GitHub on every push
.github/workflows/android-studio.yml   tests the PDFs: copies them back out, builds and runs the app
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

## Closed network (no internet, no web server)

`python3 tools/make-offline.py` builds **`dist/bdolach-offline.html`**: the whole app in one file
(styles, scripts, content and icon inside it; no internet, no install, no server).
GitHub also builds it on every push: **Actions** → **Build offline file** → latest run → **Artifacts** → `bdolach-offline`.

1. Move `bdolach-offline.html` to the closed computer through your network's approved transfer process.
2. Double-click it to open it in Chrome or Edge (Windows, Linux or Mac).
3. Ticks and night mode are kept by that browser on that computer.

After any change in `www/`, run the script again and transfer the new file. It replaces the old one.

### Tablet app built inside, from PDFs (when only PDFs can go in)

`python3 tools/make-pdf-export.py` builds **`dist/closed-network/`**: numbered PDFs of plain text, from which the
tablet app is built in Android Studio on the closed computer and installed on the tablets by USB
(GitHub puts them in the same `bdolach-offline` artifact):

- `1-steps.pdf` — the steps (from `android-studio/steps.html`)
- `2-index.html.pdf` — the app (the same one-file app as above)
- `3-…` to `7-…` — the Android Studio files in `android-studio/`: `MainActivity.java` (full-screen page,
  screen kept on, back button), `AndroidManifest.xml`, `strings.xml` (the name), and the icon redrawn as
  vector XML (`ic_launcher_background.xml`, `ic_launcher_foreground.xml`)

The Android part is plain Android with no libraries (unlike the Capacitor APK above), so it builds with nothing
but Android Studio and its SDK. For content changes only `2-index.html.pdf` needs to go in again.

Copying from a PDF scrambles Hebrew (right to left), breaks lines the page wrapped, reorders text around wide gaps
and joins a line ending in `-` to the next. So every exported file is plain ASCII: Hebrew is written as `\u05d0`
(JavaScript), `\0005d0` (CSS) and `&#x5d0;` (HTML and XML), which turn back into Hebrew. Lines are kept short
(long strings are split into `('...' + '...')`), JavaScript comments are `/* */` only, and there are no runs of
spaces inside lines and no lines ending in `-`. The script refuses to build if any of this isn't met, and says which
line. Edit the files in `android-studio/` with that in mind. The app file has no tab icon (the picture data would
add pages to copy).

The **Test Android Studio route** workflow (`.github/workflows/android-studio.yml`) checks all of it on every push:
it makes the PDFs, copies the text back out of them into a new Android project, builds the app, and runs it on an
Android 15 tablet emulator (`android-studio/emulator-test.sh`: the page shows, screen kept on, back button, turning).
Its artifact `bdolach-android-studio` has that APK and screenshots.

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
