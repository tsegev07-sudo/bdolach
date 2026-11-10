/*
 * The book: general details and the colour tabs.
 * Each tab's pages live in their own file (content/white.js, ...),
 * which calls BOOK.addPages(...). index.html must load each file.
 */
var BOOK = {
  title: 'בד"ח סופה',
  subtitle: 'נוהלי חירום',
  edition: 'עדכון 6 · מרץ 2025',
  marking: 'סודי', // classification marking shown next to each page number

  // Order matches the printed book (right to left).
  // prefix = the page-number prefix used in cross-references, e.g. (חח-43)
  tabs: [
    { id: 'yellow', name: 'צהוב', prefix: 'ח' },
    { id: 'white', name: 'לבן', prefix: 'ל' },
    { id: 'green', name: 'ירוק', prefix: null },
    { id: 'red', name: 'אדום', prefix: 'חח' }
  ],

  pages: [],

  addPages: function (tabId, pages) {
    var tab = this.tabs.find(function (t) { return t.id === tabId; });
    pages.forEach(function (p) {
      p.tab = tabId;
      p.id = tab.prefix + '-' + p.num; // e.g. "ל-1"
      BOOK.pages.push(p);
    });
  }
};
