/*
 * לשונית לבן — בד"ח מז"א (pages 180–182 of the PDF).
 *
 * How to write content
 * --------------------
 * Each page has a number (num) and a list of blocks, shown top to bottom.
 *
 * Block types:
 *   { type: 'title',   text: '...' }                      large centred title
 *   { type: 'heading', text: '...' }                      underlined section heading
 *   { type: 'list',    items: [ ... ] }                   numbered checklist (1, 2, 3...)
 *       columns: 2      -> show the list in two columns
 *       notes: true     -> this list holds the notes that ^1, ^2... point to
 *   { type: 'text',    text: '...' }                      plain paragraph
 *   { type: 'end' }                                       "- סוף בד"ח -"
 *
 * A list item is either text, or an object with extras:
 *   { text: '...', sub: ['...', '...'] }                  lettered sub-items (א, ב...)
 *   { text: '...', table: { head: [...], rows: [[...]] } }
 *
 * Inside any text:
 *   **bold**      -> bold
 *   ^1            -> boxed note reference; tapping it shows note 1 of this tab
 *   (חח-43)       -> link to page חח-43 (also ח-12, ל-3 ...)
 */
BOOK.addPages('white', [
  {
    num: 1,
    header: 'בד"ח מז"א',
    blocks: [
      { type: 'title', text: 'בד"ח מז"א' },
      { type: 'heading', text: 'על הקרקע' },
      {
        type: 'list',
        items: [
          '**ערוץ הסעה** - בדוק מז"א, זמן למעגל, בסיס משנה.',
          '**BINGO** - כייל בהתאם.',
          '**לחץ** - כייל והשווה לגובה הבסיס. ^1',
          '**TCN** - T/R, תדר - כייל ובדוק.',
          '**ILS** - תדר, COURSE, CMD STRG מואר - כייל ובדוק. ^2',
          '**ANTI ICE + PROBEHEAT** - בדוק.',
          '**רדיו** - בדוק.',
          '**פאנל HUD** - ודא ATT / FPM.',
          '**זע"ט** - בדוק.',
          '**INS** - ודא מאופס.',
          '**דיוק EGI** - בדוק.'
        ]
      },
      { type: 'heading', text: 'התיישרות והמראה' },
      {
        type: 'list',
        items: [
          '**אפס והשווה כיוונים** - בול ראשי, בול חירום, תע"ל, מצפן, מצפן חירום.',
          '**ANTI ICE** - ON.',
          '**PROBEHEAT** - PROBEHEAT.',
          '**נ"צ** - ע"פ SID.',
          '**מהירות טיסה בעננות פעילה (CAS)** - 320 ק\'.'
        ]
      }
    ]
  },

  {
    num: 2,
    header: 'בד"ח מז"א',
    blocks: [
      { type: 'heading', text: 'הצטרפות' },
      {
        type: 'list',
        items: [
          '**מז"א בבסיס** - בדוק מז"א, תהליך מבוצע, רוח, מצב מסלולים, בסיס משנה.',
          '**BINGO** - כייל בהתאם.',
          '**לחץ** - כייל.',
          '**TCN** - T/R, תדר - כייל ובדוק.',
          '**ILS** - תדר, COURSE, CMD STRG מואר - כייל ובדוק. ^2',
          '**נ"צ** - TDZ מסלול התהליך (נ"צ 49 - 40 אם ניתן).',
          '**הצלב נתונים** - TCN, NAV, בקר.',
          '**התראות גובה** - BARO לפי IF, מג"א לפי מינימה אישית.',
          '**בוחר עזר ניווט** - ע"פ התהליך המבוצע. ^3',
          '**HSI** - כייל COURSE. ^3',
          '**ANTI ICE + PROBEHEAT** - הפעל.',
          '**פאנל HUD** - VV / VAH.',
          '**תאורות** - חיצונית שקול להפסיק, פנימיות כנדרש.',
          '**אפס והשווה כיוונים** - תע"ל, בול ראשי, מצפן, בול חירום, מצפן חירום.',
          '**מוד מטוס** - NAV.',
          '**דיוק EGI** - בדוק (נדרש דיוק תחת M25 ו-GPS תחת 10 לביצוע ILS - NAV).',
          '**DOI** - לא בתע"ל.',
          '**CZ** - בצע.',
          '**עבור על התהליך המבוצע.** ^4'
        ]
      }
    ]
  },

  {
    num: 3,
    header: 'בד"ח מז"א',
    blocks: [
      { type: 'heading', text: 'נחיתה על מסלול רטוב' },
      {
        type: 'list',
        items: [
          '**משקל** - הפחת ככל הניתן.',
          '**רוח** - ודא במגבלות (20-90º ק\', 28-45º ק\', ללא רוח גב).',
          '**פיינל** - 13º ז"ה.',
          '**עצירה אווירודינמית** - עד 100 ק\'.',
          '**הורד אף ובלום בלימה רציפה ומירבית, מ"א מלא בחוץ, סטיק מלא אחורה.**',
          '**וו** - אם נדרש.'
        ]
      },
      { type: 'heading', text: 'הערות נוספות' },
      {
        type: 'list',
        notes: true,
        items: [
          '**מד גובה** - הפרש מירבי תקין בין התא לתע"ל - 75 רגל.',
          '**כיול COURSE ב-DED** (דף T-ILS) - מהפנקס + 5º.',
          {
            text: '**בוחר עזר ניווט וכיול CRS ב-HSI:**',
            table: {
              head: ['תהליך מבוצע', 'צלע יציאה', 'צלע כניסה', 'CRS ב-HSI'],
              rows: [
                ['ILS NAV', 'NAV', 'ILS / NAV', 'מהפנקס + 5º'],
                ['ILS TCN', 'TCN', 'ILS / TCN', 'מהפנקס'],
                ['TCN', 'TCN', 'TCN', 'מהפנקס']
              ]
            }
          },
          {
            text: '**מהירויות טיסה וטווח מזערי בין מטוסי קרב בתהליך:**',
            sub: [
              'צלע יציאה - 320 ק\', 7 מייל בין מטוסים.',
              'צלע כניסה - 180 ק\', 3 מייל בין מטוסים.'
            ]
          }
        ]
      },
      { type: 'heading', text: 'מכשירי חובה במטוס לטיסה בכט"מ' },
      {
        type: 'list',
        columns: 2,
        items: [
          'ANTI ICE + PROBEHEAT.',
          'מכשיר רדיו אחד.',
          'מד מהירות.',
          'מד גובה. ^1',
          'בול ראשי + בול חירום.',
          'ILS או TCN.',
          'EGI.',
          'זע"ט (להמראה בלבד).'
        ]
      },
      { type: 'end' }
    ]
  }
]);
