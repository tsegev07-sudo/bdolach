/*
 * בד"ח סופה — the app.
 * Reads the content from BOOK (content/*.js) and renders it.
 *
 * Addresses (the part after # in the URL):
 *   (empty)      -> opens the first page of BOOK.startTab
 *   #ל-1         -> page ל-1
 *   #ל-1/h2      -> page ל-1, scrolled to its 3rd heading (counting from 0)
 *   #ל-3/n2      -> the page with the tab's notes, scrolled to note 2 (highlighted)
 *
 * Every page you open is added to the history, so "חזור" (and the Android
 * back button) returns to the page you were on before, at the same spot.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    tabs: $('tabs'),
    page: $('page'),
    header: $('pageHeader'),
    label: $('pageLabel'),
    back: $('backBtn'),
    next: $('nextBtn'),
    reset: $('resetBtn'),
    undo: $('undoBtn'),
    home: $('homeBtn'),
    night: $('nightBtn'),
    sheet: $('sheet'),
    sheetBody: $('sheetBody'),
    sheetClose: $('sheetClose')
  };

  // Ticked items, per page. Saved on the device, so they survive the app
  // being reloaded (Android and iPhone close apps in the background, e.g.
  // while the crew switches to another app mid-procedure).
  // Saved ticks are dropped when they are older than TICKS_MAX_AGE (counted
  // from the last tick), and when the content has changed since, so a tick
  // can never land on a different step.
  var TICKS_KEY = 'ticks';
  var TICKS_MAX_AGE = 2 * 60 * 60 * 1000; // 2 hours
  var CONTENT_STAMP = contentStamp();
  var ticks = loadTicks();
  var current = null; // the page being shown, or null on the home screen

  /* ---------------- Small helpers ---------------- */

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* not available */ }
  }

  // A short fingerprint of all the pages' content
  function contentStamp() {
    var text = JSON.stringify(BOOK.pages), hash = 0;
    for (var i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
    return hash;
  }

  function loadTicks() {
    var saved;
    try {
      saved = JSON.parse(storageGet(TICKS_KEY));
    } catch (e) {
      return {}; // damaged saved data: start with nothing ticked
    }
    var fresh = saved && saved.content === CONTENT_STAMP &&
      Date.now() - saved.time < TICKS_MAX_AGE;
    return (fresh && saved.ticks) || {};
  }

  function saveTicks() {
    storageSet(TICKS_KEY, JSON.stringify({ time: Date.now(), content: CONTENT_STAMP, ticks: ticks }));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function findPage(id) {
    return BOOK.pages.find(function (p) { return p.id === id; }) || null;
  }

  function findTab(id) {
    return BOOK.tabs.find(function (t) { return t.id === id; });
  }

  function tabHasPages(tabId) {
    return BOOK.pages.some(function (p) { return p.tab === tabId; });
  }

  function pageLabel(page) {
    var tab = findTab(page.tab);
    return tab.prefix + ' - ' + page.num + ' - ' + BOOK.marking;
  }

  /* ---------------- Text formatting ---------------- */

  // Turns the content mini-syntax into HTML:
  //   **bold**   ^1 (note reference)   (חח-43) (link to a page)
  //
  // Right-to-left fixes: every English code (TCN, ANTI ICE + PROBEHEAT, T/R...)
  // and every bold term is "isolated" with <bdi>, so inside a Hebrew line they
  // keep the order they were written in, as in the printed book.
  var ISO_START = '\u0001', ISO_END = '\u0002';

  function format(text) {
    var s = String(text);

    // Page links first, so they are not split by the English-code rule
    s = s.replace(/(^|[^\u0590-\u05FF\w])((?:חח|ח|ל)-\d+)/g, function (m, before, id) {
      return before + '\u0003' + id + '\u0004';
    });

    // English codes: a run of Latin letters/digits, may contain spaces, / + -
    s = s.replace(/[A-Za-z][A-Za-z0-9\/ +\-]*[A-Za-z0-9]|[A-Za-z]/g, function (m) {
      return ISO_START + m + ISO_END;
    });

    var html = escapeHtml(s)
      .replace(/\u0001/g, '<bdi class="code">')
      .replace(/\u0002/g, '</bdi>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<b><bdi>$1</bdi></b>');

    // Note references: ^1, ^2 ...
    // The space before the box becomes a non-breaking space, and the box is
    // inline text (not a <button>), so it never drops onto a line of its own:
    // it always wraps together with the word before it.
    html = html.replace(/\s*\^(\d+)/g, function (m, n) {
      return ' <span class="ref" role="button" tabindex="0" data-note="' + n + '" aria-label="הערה ' + n + '">' + n + '</span>';
    });

    html = html.replace(/\u0003(.+?)\u0004/g, function (m, id) {
      var cls = findPage(id) ? 'link' : 'link missing';
      return '<a class="' + cls + '" data-go="' + id + '"><bdi>' + id + '</bdi></a>';
    });

    return html;
  }

  /* ---------------- Rendering ---------------- */

  function renderTabs() {
    els.tabs.innerHTML = BOOK.tabs.map(function (t) {
      var disabled = tabHasPages(t.id) ? '' : ' disabled';
      return '<button class="tab" data-tab="' + t.id + '"' + disabled + '>' + t.name + '</button>';
    }).join('');
  }

  function renderItemBody(item) {
    if (typeof item === 'string') return format(item);

    var html = format(item.text || '');

    if (item.sub) {
      var letters = 'אבגדהוזחטיכלמנסעפצקרשת';
      html += '<ul class="sub">' + item.sub.map(function (s, i) {
        return '<li><b>' + letters[i] + '.</b> ' + format(s) + '</li>';
      }).join('') + '</ul>';
    }

    if (item.table) {
      html += '<table class="table"><thead><tr>' +
        item.table.head.map(function (h) { return '<th>' + format(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        item.table.rows.map(function (row) {
          return '<tr>' + row.map(function (c) { return '<td>' + format(c) + '</td>'; }).join('') + '</tr>';
        }).join('') +
        '</tbody></table>';
    }

    return html;
  }

  function renderBlock(block, b, pageTicks) {
    switch (block.type) {
      case 'title':
        // The top bar already shows this page's header: don't repeat it
        if (current && block.text === current.header) return '';
        return '<h1 class="title">' + format(block.text) + '</h1>';

      case 'heading':
        return '<h2 class="heading">' + format(block.text) + ':</h2>';

      case 'text':
        return '<p class="text">' + format(block.text) + '</p>';

      case 'end':
        return '<p class="end">- סוף בד"ח -</p>';

      case 'list':
        var cls = 'list' + (block.columns === 2 ? ' columns-2' : '') + (block.notes ? ' notes' : '');
        return '<ol class="' + cls + '">' + block.items.map(function (item, i) {
          var key = b + '.' + i;
          var done = !block.notes && pageTicks[key];
          return '<li class="item' + (done ? ' done' : '') + '"' +
            (block.notes ? '' : ' data-key="' + key + '"') + '>' +
            // A ticked step keeps its number (shown with a ✓), so the crew
            // can still say "we're at step 3"
            '<span class="item-num">' + (i + 1) + '</span>' +
            '<div class="item-body">' + renderItemBody(item) + '</div>' +
            '</li>';
        }).join('') + '</ol>';

      default:
        return '';
    }
  }

  // target: { heading: n } or { note: n } to scroll to; scroll: a saved position
  function renderPage(page, target, scroll) {
    if (current !== page) hideUndo();
    current = page;
    document.body.dataset.tab = page.tab;
    var pageTicks = ticks[page.id] || {};

    els.header.textContent = page.header || BOOK.title;
    els.label.textContent = pageLabel(page);

    els.page.innerHTML = '<div class="page-inner">' +
      page.blocks.map(function (block, b) { return renderBlock(block, b, pageTicks); }).join('') +
      '</div>';

    // "המשך" stays inside the current colour tab; "חזור" needs somewhere to go back to
    var pages = tabPages(page.tab);
    els.next.disabled = pages.indexOf(page) >= pages.length - 1;
    els.back.disabled = depth <= 0;
    updateResetButton();

    markActiveTab(page.tab);

    fitPage();

    target = target || {};
    var el = null;
    if (target.heading != null) {
      el = els.page.querySelectorAll('.heading')[target.heading];
      if (el) el.scrollIntoView();
    } else if (target.note != null) {
      var notes = els.page.querySelector('.list.notes');
      el = notes && notes.children[target.note - 1];
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('flash'); // briefly highlights the note that was tapped
      }
    }
    if (!el) els.page.scrollTop = scroll || 0;
  }

  // "נקה סימונים" appears only while something on the page is ticked
  function updateResetButton() {
    var t = current && ticks[current.id];
    els.reset.hidden = !(t && Object.keys(t).some(function (k) { return t[k]; }));
  }

  // Table of contents (☰): the headings of the current tab only.
  // Other colours are reached only from the tabs at the top.
  function showToc() {
    if (!current) return;
    var tab = findTab(current.tab);
    var html = '<h2>תוכן עניינים — ' + tab.name + '</h2>';

    tabPages(current.tab).forEach(function (p) {
      var h = 0;
      p.blocks.forEach(function (block) {
        if (block.type !== 'heading') return;
        var here = p === current ? ' current' : '';
        html += '<button class="toc-entry' + here + '" data-go="' + p.id + '/h' + h + '">' +
          '<span>' + format(block.text) + '</span>' +
          '<span class="toc-page"><bdi>' + p.id + '</bdi></span></button>';
        h++;
      });
    });

    openSheet(html);
  }

  // The pages of one colour tab, in order
  function tabPages(tabId) {
    return BOOK.pages.filter(function (p) { return p.tab === tabId; });
  }

  // Makes the whole page fit the screen without scrolling, like a page of the
  // booklet: shrinks the text step by step until nothing overflows.
  // (On a wide screen the page is in two columns, see app.css.)
  // The text never gets smaller than MIN_TEXT_PX; if the page still doesn't
  // fit at that size (phone, tablet on its side), the page scrolls instead.
  var MIN_TEXT_PX = 15;

  function fitPage() {
    var el = els.page;
    var fit = 1;
    el.classList.remove('one-column');
    el.style.setProperty('--fit', fit);
    var basePx = parseFloat(getComputedStyle(el).fontSize);
    var minFit = Math.min(1, MIN_TEXT_PX / basePx);
    while (el.scrollHeight > el.clientHeight + 1 && fit - 0.03 >= minFit) {
      fit = Math.round((fit - 0.03) * 100) / 100;
      el.style.setProperty('--fit', fit);
    }
    // Still doesn't fit at the smallest size: smaller text gains nothing,
    // so keep the full size and let the page scroll. In one column, so the
    // page reads straight down (two columns would mean scrolling down the
    // first, then back up for the second).
    if (el.scrollHeight > el.clientHeight + 1) {
      el.classList.add('one-column');
      el.style.setProperty('--fit', 1);
    }
  }

  function markActiveTab(tabId) {
    Array.prototype.forEach.call(els.tabs.children, function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
  }

  /* ---------------- Notes pop-up ---------------- */

  // Finds note n of the given tab: the n-th item of the list marked notes: true
  function findNote(tabId, n) {
    for (var p = 0; p < BOOK.pages.length; p++) {
      var page = BOOK.pages[p];
      if (page.tab !== tabId) continue;
      for (var b = 0; b < page.blocks.length; b++) {
        var block = page.blocks[b];
        if (block.type === 'list' && block.notes && block.items[n - 1]) {
          return { page: page, item: block.items[n - 1] };
        }
      }
    }
    return null;
  }

  // A boxed note number opens the notes page of this tab, at that note
  function showNote(n) {
    var note = current && findNote(current.tab, n);
    if (note) go(note.page.id + '/n' + n);
  }

  function openSheet(html) {
    els.sheetBody.innerHTML = html;
    els.sheet.hidden = false;
  }

  function closeSheet() {
    els.sheet.hidden = true;
  }

  /* ---------------- Navigation ---------------- */

  // How many pages back "חזור" can go (0 = this is the first page opened)
  var depth = 0;

  function currentAddress() {
    return decodeURIComponent(location.hash.slice(1));
  }

  // Opens a page and adds it to the history
  function go(address) {
    var id = address.split('/')[0];
    if (id && !findPage(id)) {
      openSheet('<h2><bdi>' + escapeHtml(id) + '</bdi></h2><p>העמוד הזה עדיין לא הוכנס לאפליקציה.</p>');
      return;
    }
    closeSheet();
    // Same page as the one showing (its tab, a heading of this page in the
    // table of contents, a note on the notes page): move within the page
    // without a new history entry. Otherwise "חזור" would appear and only
    // lead back to this same page.
    if (id === currentAddress().split('/')[0]) {
      history.replaceState(history.state, '', '#' + address);
      show(address);
      return;
    }
    // Remember where this page was scrolled to, for when "חזור" returns here
    history.replaceState({ depth: depth, scroll: els.page.scrollTop }, '', location.hash);
    depth++;
    history.pushState({ depth: depth }, '', '#' + address);
    show(address);
  }

  // Shows the page in an address: "ל-1", "ל-1/h2" (heading) or "ל-3/n2" (note)
  function show(address, scroll) {
    var parts = address.split('/');
    var page = findPage(parts[0]);
    if (!page) return false;
    var kind = parts[1] && parts[1][0];
    var n = parts[1] ? parseInt(parts[1].slice(1), 10) : null;
    var target = kind === 'h' ? { heading: n } : kind === 'n' ? { note: n } : null;
    renderPage(page, target, scroll);
    return true;
  }

  // "חזור" and the Android back button land here, as does editing the address
  window.addEventListener('popstate', function (e) {
    closeSheet();
    depth = (e.state && e.state.depth) || 0;
    // Returning to a page: back to the same spot, without highlighting the note again
    var address = currentAddress();
    if (e.state && e.state.scroll != null) address = address.split('/')[0];
    show(address, e.state && e.state.scroll);
  });

  function back() {
    if (depth > 0) history.back();
  }

  function start() {
    depth = (history.state && history.state.depth) || 0;
    if (show(currentAddress(), history.state && history.state.scroll)) return;

    // No page in the address (first launch): open straight into the start tab
    var first = tabPages(BOOK.startTab)[0] || BOOK.pages[0];
    depth = 0;
    history.replaceState({ depth: 0 }, '', '#' + first.id);
    renderPage(first);
  }

  function step(delta) {
    if (!current) return;
    var pages = tabPages(current.tab);
    var target = pages[pages.indexOf(current) + delta];
    if (target) go(target.id);
  }

  /* ---------------- Settings ---------------- */

  // The button shows the mode it switches to: ☾ by day, ☀ at night
  function applyTheme(theme) {
    var night = theme === 'night';
    if (night) document.documentElement.dataset.theme = 'night';
    else delete document.documentElement.dataset.theme;
    els.night.textContent = night ? '☀' : '☾';
    els.night.setAttribute('aria-label', night ? 'מצב יום' : 'מצב לילה');
  }

  applyTheme(storageGet('theme'));

  /* ---------------- Events ---------------- */

  document.addEventListener('click', function (e) {
    var ref = e.target.closest('.ref');
    if (ref) { showNote(parseInt(ref.dataset.note, 10)); return; }

    var link = e.target.closest('[data-go]');
    if (link) { go(link.dataset.go); return; }

    var tab = e.target.closest('.tab');
    if (tab && !tab.disabled) {
      var first = BOOK.pages.find(function (p) { return p.tab === tab.dataset.tab; });
      if (first) go(first.id);
      return;
    }

    // Tap a checklist item to tick / untick it
    var item = e.target.closest('.item[data-key]');
    if (item && current) {
      var pageTicks = ticks[current.id] = ticks[current.id] || {};
      var key = item.dataset.key;
      pageTicks[key] = !pageTicks[key];
      item.classList.toggle('done', pageTicks[key]);
      saveTicks();
      updateResetButton();
    }
  });

  // Note boxes can also be opened from a keyboard
  document.addEventListener('keydown', function (e) {
    var ref = e.target.closest && e.target.closest('.ref');
    if (ref && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      showNote(parseInt(ref.dataset.note, 10));
    }
  });

  els.back.addEventListener('click', back);
  els.next.addEventListener('click', function () { step(1); });
  els.home.addEventListener('click', showToc);

  // Shows the page's ticks without redrawing it, so it stays where it is
  // instead of jumping back to the top
  function applyTicks() {
    var t = (current && ticks[current.id]) || {};
    els.page.querySelectorAll('.item[data-key]').forEach(function (item) {
      item.classList.toggle('done', !!t[item.dataset.key]);
    });
    updateResetButton();
  }

  // "נקה סימונים" can be undone for a few seconds, so a slip of the finger
  // mid-procedure doesn't lose the crew's place
  var UNDO_MS = 6000;
  var undoState = null; // { page, ticks, timer }

  function hideUndo() {
    if (undoState) clearTimeout(undoState.timer);
    undoState = null;
    els.undo.hidden = true;
  }

  els.reset.addEventListener('click', function () {
    if (!current) return;
    hideUndo();
    undoState = {
      page: current,
      ticks: ticks[current.id],
      timer: setTimeout(hideUndo, UNDO_MS)
    };
    delete ticks[current.id];
    saveTicks();
    applyTicks();
    els.undo.hidden = false;
  });

  els.undo.addEventListener('click', function () {
    if (!undoState || undoState.page !== current) { hideUndo(); return; }
    ticks[current.id] = undoState.ticks;
    saveTicks();
    hideUndo();
    applyTicks();
  });

  els.night.addEventListener('click', function () {
    var night = document.documentElement.dataset.theme !== 'night';
    applyTheme(night ? 'night' : 'day');
    storageSet('theme', night ? 'night' : 'day');
  });


  els.sheetClose.addEventListener('click', closeSheet);
  els.sheet.addEventListener('click', function (e) {
    if (e.target === els.sheet) closeSheet();
  });

  // Swipe between pages. As in a Hebrew book, the next page is on the left:
  // swipe right = next page, swipe left = previous page.
  var touchStart = null;
  els.page.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { touchStart = null; return; }
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  els.page.addEventListener('touchend', function (e) {
    if (!touchStart || !current) return;
    var dx = e.changedTouches[0].clientX - touchStart.x;
    var dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      step(dx > 0 ? 1 : -1);
    }
  });


  // Re-fit when the screen size changes (rotating the tablet)
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitPage, 100);
  });

  /* ---------------- Keep the screen on ---------------- */

  // The screen never turns off while the app is open, however long it goes
  // without a tap:
  // - Android app: set natively when the app starts
  //   (native/android/MainActivity.java); the KeepAwake plugin below asks too.
  // - Browsers: the Wake Lock API. The browser drops it whenever the app is
  //   hidden, so it is asked for again each time the app comes back.
  // - iPhone / iPad: also a tiny silent video (js/awake-video.js) playing in a
  //   loop, out of sight. Before iOS 18.4 the Wake Lock does nothing in an app
  //   added to the home screen, but iOS never sleeps while a video plays.
  var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPads report themselves as a Mac; a Mac has no touch screen
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  var wakeLock = null; // the lock, or 'asking' while a request is on its way
  var awakeVideo = null;

  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    wakeLock = 'asking';
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () {
      wakeLock = null; // not allowed right now: asked again on the next tap
    });
  }

  function playAwakeVideo() {
    if (!awakeVideo) {
      awakeVideo = document.createElement('video');
      awakeVideo.className = 'awake-video';
      awakeVideo.muted = true;
      awakeVideo.loop = true;
      awakeVideo.playsInline = true;
      // iOS also needs these as attributes to play inline without sound
      awakeVideo.setAttribute('muted', '');
      awakeVideo.setAttribute('playsinline', '');
      awakeVideo.setAttribute('aria-hidden', 'true');
      awakeVideo.src = AWAKE_VIDEO;
      document.body.appendChild(awakeVideo);
    }
    if (awakeVideo.paused) {
      awakeVideo.play().catch(function () {
        // not allowed yet (e.g. Low Power Mode): tried again on the next tap
      });
    }
  }

  function keepScreenOn() {
    if (document.visibilityState !== 'visible') return;
    if (IS_IOS) playAwakeVideo();
    requestWakeLock();
  }

  if (!window.Capacitor) {
    keepScreenOn();
    document.addEventListener('visibilitychange', keepScreenOn);
    // Some browsers only allow these after a tap
    document.addEventListener('click', keepScreenOn);
  }

  /* ---------------- Android app ---------------- */

  // Inside the Android app, Capacitor's JavaScript (js/capacitor.js, copied in
  // when the APK is built) gives access to the native plugins.
  function initAndroid() {
    var cap = window.Capacitor;
    if (!cap || !cap.registerPlugin) return;

    cap.registerPlugin('KeepAwake').keepAwake();

    // Back button: close an open pop-up first, otherwise go back a page
    // (same as "חזור"), otherwise leave the app.
    var app = cap.registerPlugin('App');
    app.addListener('backButton', function () {
      if (!els.sheet.hidden) closeSheet();
      else if (depth > 0) history.back();
      else app.exitApp();
    });
  }

  if (window.Capacitor) {
    var capScript = document.createElement('script');
    capScript.src = 'js/capacitor.js';
    capScript.onload = initAndroid;
    document.head.appendChild(capScript);
  }

  // Offline support when opened from a website (iPhone / browser).
  // Skipped inside the Android app, which already has every file.
  if ('serviceWorker' in navigator && !window.Capacitor && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* app still works online */ });
  }

  renderTabs();
  start();
})();
