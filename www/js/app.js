/*
 * בד"ח סופה — the app.
 * Reads the content from BOOK (content/*.js) and renders it.
 *
 * Addresses (the part after # in the URL):
 *   (empty)      -> opens the first page of BOOK.startTab
 *   #ל-1         -> page ל-1
 *   #ל-1/h2      -> page ל-1, scrolled to its 3rd heading (counting from 0)
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    tabs: $('tabs'),
    page: $('page'),
    header: $('pageHeader'),
    label: $('pageLabel'),
    prev: $('prevBtn'),
    next: $('nextBtn'),
    reset: $('resetBtn'),
    home: $('homeBtn'),
    night: $('nightBtn'),
    sheet: $('sheet'),
    sheetBody: $('sheetBody'),
    sheetClose: $('sheetClose')
  };

  // Ticked items, per page. Kept in memory only: closing the app clears them.
  var ticks = {};
  var current = null; // the page being shown, or null on the home screen

  /* ---------------- Small helpers ---------------- */

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* not available */ }
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
      .replace(/\u0001/g, '<bdi>')
      .replace(/\u0002/g, '</bdi>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<b><bdi>$1</bdi></b>');

    // Note references: ^1, ^2 ...
    html = html.replace(/\^(\d+)/g, function (m, n) {
      return '<button class="ref" data-note="' + n + '" aria-label="הערה ' + n + '">' + n + '</button>';
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
            '<span class="item-num">' + (done ? '✓' : (i + 1) + '.') + '</span>' +
            '<div class="item-body">' + renderItemBody(item) + '</div>' +
            '</li>';
        }).join('') + '</ol>';

      default:
        return '';
    }
  }

  function renderPage(page, headingIndex) {
    current = page;
    document.body.dataset.tab = page.tab;
    var pageTicks = ticks[page.id] || {};

    els.header.textContent = page.header || BOOK.title;
    els.label.textContent = pageLabel(page);

    els.page.innerHTML = '<div class="page-inner">' +
      page.blocks.map(function (block, b) { return renderBlock(block, b, pageTicks); }).join('') +
      '</div>';

    // Previous / next stay inside the current colour tab
    var pages = tabPages(page.tab);
    var i = pages.indexOf(page);
    els.prev.disabled = i <= 0;
    els.next.disabled = i >= pages.length - 1;

    markActiveTab(page.tab);

    fitPage();

    var target = headingIndex != null ? els.page.querySelectorAll('.heading')[headingIndex] : null;
    if (target) target.scrollIntoView();
    else els.page.scrollTop = 0;
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
        html += '<button class="toc-entry" data-go="' + p.id + '/h' + h + '">' +
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
  // The text never gets smaller than MIN_TEXT_PX; if the page still doesn't
  // fit at that size (phone, tablet on its side), the page scrolls instead.
  var MIN_TEXT_PX = 15;

  function fitPage() {
    var el = els.page;
    var fit = 1;
    el.style.setProperty('--fit', fit);
    var basePx = parseFloat(getComputedStyle(el).fontSize);
    var minFit = Math.min(1, MIN_TEXT_PX / basePx);
    while (el.scrollHeight > el.clientHeight + 1 && fit - 0.03 >= minFit) {
      fit = Math.round((fit - 0.03) * 100) / 100;
      el.style.setProperty('--fit', fit);
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
          return { page: page, item: block.items[n - 1], heading: headingIndexBefore(page, b) };
        }
      }
    }
    return null;
  }

  function headingIndexBefore(page, blockIndex) {
    var h = -1;
    for (var b = 0; b < blockIndex; b++) {
      if (page.blocks[b].type === 'heading') h++;
    }
    return h < 0 ? null : h;
  }

  function showNote(n) {
    var note = current && findNote(current.tab, n);
    if (!note) return;

    var goto = note.page.id + (note.heading != null ? '/h' + note.heading : '');
    openSheet(
      '<h2>הערה ' + n + '</h2>' +
      '<div>' + renderItemBody(note.item) + '</div>' +
      '<button class="go-btn" data-go="' + goto + '">לכל ההערות (<bdi>' + note.page.id + '</bdi>)</button>'
    );
  }

  function openSheet(html) {
    els.sheetBody.innerHTML = html;
    els.sheet.hidden = false;
  }

  function closeSheet() {
    els.sheet.hidden = true;
  }

  /* ---------------- Navigation ---------------- */

  function go(address) {
    var id = address.split('/')[0];
    if (id && !findPage(id)) {
      openSheet('<h2><bdi>' + escapeHtml(id) + '</bdi></h2><p>העמוד הזה עדיין לא הוכנס לאפליקציה.</p>');
      return;
    }
    closeSheet();
    // Changing the hash adds a history entry, so the Android back button works
    if (location.hash.slice(1) === address) route();
    else location.hash = address;
  }

  function route() {
    var address = decodeURIComponent(location.hash.slice(1));
    var parts = address.split('/');
    var page = findPage(parts[0]);
    var heading = parts[1] && parts[1][0] === 'h' ? parseInt(parts[1].slice(1), 10) : null;

    if (page) {
      renderPage(page, heading);
      return;
    }

    // No page in the address (first launch): open straight into the start tab.
    // replace() so the back button doesn't return to an empty address.
    var start = tabPages(BOOK.startTab)[0] || BOOK.pages[0];
    location.replace('#' + start.id);
    renderPage(start);
  }

  function step(delta) {
    if (!current) return;
    var pages = tabPages(current.tab);
    var target = pages[pages.indexOf(current) + delta];
    if (target) go(target.id);
  }

  /* ---------------- Settings ---------------- */

  function applyTheme(theme) {
    if (theme === 'night') document.documentElement.dataset.theme = 'night';
    else delete document.documentElement.dataset.theme;
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
      var num = item.querySelector('.item-num');
      num.textContent = pageTicks[key] ? '✓' : (parseInt(key.split('.')[1], 10) + 1) + '.';
    }
  });

  els.prev.addEventListener('click', function () { step(-1); });
  els.next.addEventListener('click', function () { step(1); });
  els.home.addEventListener('click', showToc);

  els.reset.addEventListener('click', function () {
    if (!current) return;
    delete ticks[current.id];
    renderPage(current);
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

  window.addEventListener('hashchange', route);

  // Re-fit when the screen size changes (rotating the tablet)
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitPage, 100);
  });

  // Android back button (only inside the installed app):
  // close an open note first, otherwise go back a page, otherwise exit.
  var capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (capApp) {
    capApp.addListener('backButton', function (e) {
      if (!els.sheet.hidden) closeSheet();
      else if (e.canGoBack) history.back();
      else capApp.exitApp();
    });
  }

  // Offline support when opened from a website (iPhone / browser).
  // Skipped inside the Android app, which already has every file.
  if ('serviceWorker' in navigator && !window.Capacitor && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* app still works online */ });
  }

  renderTabs();
  route();
})();
