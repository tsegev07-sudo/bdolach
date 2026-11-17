#!/usr/bin/env python3
"""
Exports the whole app as a PDF of plain-ASCII code, for a closed network
that takes in PDFs but not program files. On the other side:
open the PDF -> Select all -> Copy -> paste into a new text file named
bdolach.html -> delete the two lines above the code -> double-click it.

    python3 tools/make-pdf-export.py
        -> dist/bdolach.html       the app in one file, ASCII only
        -> dist/bdolach.html.pdf   that file printed, ready to transfer

Copying text out of a PDF can scramble Hebrew (right-to-left) and breaks any
line that the page wrapped. So the exported code:
  - has no Hebrew or other non-ASCII characters. They are written as escapes
    that the browser turns back into Hebrew: \\u05d0 in JavaScript, \\0005d0 in
    CSS, &#x5d0; in HTML. The app shows exactly the same text.
  - has no line longer than LIMIT characters. Long strings are split into
    ('...' + '...'), and long comments are wrapped, so the PDF never wraps a line.
  - has /* */ comments only. A // comment would swallow the code after it if
    a line break were lost in the copy.

Needs Python 3 and Chrome (or Chromium) to print the PDF. If Chrome isn't
found, open dist/bdolach.html.print.html in Chrome and print it to PDF with
"Headers and footers" turned off.
"""
import html as htmllib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WWW = ROOT / 'www'
DIST = ROOT / 'dist'
NAME = 'bdolach.html'
LIMIT = 140  # longest line, in characters (the PDF page fits about 165)


def read(rel):
    return (WWW / rel).read_text(encoding='utf-8')


def js_escape(ch):
    """A non-ASCII character as a JavaScript \\uXXXX escape (two for emoji)."""
    b = ch.encode('utf-16-be')
    return ''.join('\\u%02x%02x' % (b[i], b[i + 1]) for i in range(0, len(b), 2))


def to_ascii_js(s):
    return ''.join(c if ord(c) < 128 else js_escape(c) for c in s)


def to_ascii_css(s):
    return ''.join(c if ord(c) < 128 else '\\%06x' % ord(c) for c in s)


def to_ascii_html(s):
    return ''.join(c if ord(c) < 128 else '&#x%x;' % ord(c) for c in s)


# ---------------------------------------------------------------- JavaScript

REGEX_AFTER = set('(,=:[!&|?{};+-*%<>~^')
REGEX_AFTER_WORDS = {'return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw'}


def js_tokens(src):
    """Splits JavaScript into (kind, text): code, string, regex, line, block."""
    out, i, n, code = [], 0, len(src), []
    last = ''  # last significant code text, to tell a regex from a division

    def flush():
        if code:
            out.append(('code', ''.join(code)))
            code.clear()

    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ''
        if c in '\'"':
            j = i + 1
            while src[j] != c:
                if src[j] == '\n':
                    sys.exit('unterminated string in JavaScript at %r' % src[i:i + 40])
                j += 2 if src[j] == '\\' else 1
            flush(); out.append(('string', src[i:j + 1])); last = 'x'; i = j + 1
        elif c == '`':
            sys.exit('template literals are not supported by this exporter')
        elif c == '/' and nxt == '/':
            j = src.find('\n', i)
            j = n if j < 0 else j
            flush(); out.append(('line', src[i + 2:j])); i = j
        elif c == '/' and nxt == '*':
            j = src.index('*/', i + 2)
            flush(); out.append(('block', src[i:j + 2])); i = j + 2
        elif c == '/' and (last == '' or last[-1] in REGEX_AFTER or
                           re.search(r'\b(%s)$' % '|'.join(REGEX_AFTER_WORDS), last)):
            j, in_class = i + 1, False
            while in_class or src[j] != '/':
                if src[j] == '\n':
                    sys.exit('unterminated regex in JavaScript at %r' % src[i:i + 40])
                if src[j] == '\\':
                    j += 1
                elif src[j] == '[':
                    in_class = True
                elif src[j] == ']':
                    in_class = False
                j += 1
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            flush(); out.append(('regex', src[i:j])); last = 'x'; i = j
        else:
            code.append(c)
            if not c.isspace():
                last = (last + c)[-12:]
            i += 1
    flush()
    return out


def units(s):
    """Splits escaped ASCII text into pieces that must not be cut apart."""
    return re.findall(r'\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}|\\.|.', s, re.S)


class Writer:
    """Collects output, knowing the current column and the line's indent."""

    def __init__(self):
        self.parts, self.col, self.indent = [], 0, 0

    def write(self, s):
        self.parts.append(s)
        if '\n' in s:
            last = s.rsplit('\n', 1)[1]
            self.col = len(last)
            self.indent = len(last) - len(last.lstrip(' '))
        else:
            if self.col == 0:
                self.indent = len(s) - len(s.lstrip(' '))
            self.col += len(s)

    def text(self):
        return ''.join(self.parts)


def chunks(us, first_room, room):
    """Groups units into pieces: the first fits first_room, the rest fit room."""
    pieces, cur, size, cap = [], [], 0, first_room
    for u in us:
        if cur and size + len(u) > cap:
            pieces.append(''.join(cur))
            cur, size, cap = [], 0, room
        cur.append(u)
        size += len(u)
    pieces.append(''.join(cur))
    return pieces


def write_string(w, s, tail):
    """A string literal; split into ('a' + 'b') when it would pass LIMIT."""
    if w.col + len(s) + tail <= LIMIT:
        w.write(s)
        return
    q, body = s[0], s[1:-1]
    pad = ' ' * (w.indent + 4)
    # Little room left on this line: start the string on the next one, where
    # a line break is harmless (after , ( [ { : = + ?, not after "return").
    before = w.text().rstrip(' ')
    if LIMIT - w.col < 30 and before and before[-1] in ',([{:=+?':
        w.parts[-1] = w.parts[-1].rstrip(' ') if w.parts[-1].strip() else w.parts[-1]
        w.write('\n' + pad)
        if w.col + len(s) + tail <= LIMIT:
            w.write(s)
            return
    first_room = max(LIMIT - w.col - 5, 20)  # ( ' ' +
    room = LIMIT - len(pad) - 4 - tail       # ' ' + / ')
    pieces = chunks(units(body), first_room, room)
    joined = (' +\n' + pad).join(q + p + q for p in pieces)
    w.write('(' + joined + ')')


def write_comment(w, body):
    """A /* */ comment, wrapped (at spaces when possible) to fit LIMIT."""
    lines = body.split('\n')
    for k, line in enumerate(lines):
        if k:
            w.write('\n')
        if k == 0:
            us = units(line)
        else:
            stripped = line.lstrip(' ')
            w.write(line[:len(line) - len(stripped)])
            us = units(stripped)
        while w.col + sum(map(len, us)) > LIMIT:
            room = LIMIT - w.col
            cut, size, fits = 0, 0, 0
            for idx, u in enumerate(us):
                if size + len(u) > room:
                    break
                size += len(u)
                fits = idx + 1
                if u == ' ':
                    cut = idx
            if cut == 0:  # no space to break at: cut between units
                cut = max(1, fits)
            w.write(''.join(us[:cut]).rstrip(' ') + '\n' + ' ' * (w.indent + 3))
            us = us[cut:]
            while us and us[0] == ' ':
                us.pop(0)
        w.write(''.join(us))


def export_js(src):
    toks = js_tokens(src)
    w = Writer()
    for idx, (kind, t) in enumerate(toks):
        # room needed after a string on its line, e.g. "'," or "' }"
        nxt = toks[idx + 1][1] if idx + 1 < len(toks) and toks[idx + 1][0] == 'code' else ''
        tail = len(nxt.split('\n', 1)[0])
        if kind == 'code':
            if any(ord(c) > 127 for c in t):
                sys.exit('non-ASCII outside strings/comments in JavaScript: %r' % t[:60])
            w.write(t)
        elif kind == 'string':
            # keep double spaces in text through the space-collapsing below
            t = re.sub(r'(?<= ) ', r'\\u0020', t)
            write_string(w, to_ascii_js(t), tail)
        elif kind == 'regex':
            w.write(to_ascii_js(t))
        elif kind == 'line':
            body = to_ascii_js(t).strip().replace('*/', '* /')
            w.write('/* ')
            write_comment(w, body)
            w.write(' */')
        else:  # block
            write_comment(w, to_ascii_js(t))
    return w.text()


# ---------------------------------------------------------------- CSS / HTML

def export_css(src):
    return to_ascii_css(src)


def wrap_html_line(line):
    """Breaks a long HTML line at spaces between attributes / words."""
    out = []
    pad = ' ' * (len(line) - len(line.lstrip(' ')) + 4)
    while len(line) > LIMIT:
        # a space outside quotes, as late as fits
        cut, quote = -1, None
        for i, c in enumerate(line[:LIMIT]):
            if quote:
                if c == quote:
                    quote = None
            elif c in '"\'':
                quote = c
            elif c == ' ' and i > len(pad):
                cut = i
        if cut < 0:
            break
        out.append(line[:cut])
        line = pad + line[cut + 1:]
    out.append(line)
    return '\n'.join(out)


def build():
    page = read('index.html')

    page = re.sub(r'\s*<link rel="manifest"[^>]*>', '', page)
    page = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', '', page)
    # The tab icon would be pages of picture data in the PDF; the browser's
    # default icon is used instead.
    page = re.sub(r'\s*<link rel="icon"[^>]*>', '', page)

    # HTML text: Hebrew -> &#x5d0; then fold long lines
    page = to_ascii_html(page)
    page = '\n'.join(wrap_html_line(l) for l in page.split('\n'))

    # Stylesheet -> <style>
    css = export_css(read('css/app.css'))
    page, n = re.subn(r'<link rel="stylesheet" href="([^"]+)">',
                      lambda m: '<style>\n%s\n</style>' % css, page)
    if n != 1:
        sys.exit('expected exactly one stylesheet link, found %d' % n)

    # Scripts -> inline <script>
    def inline(m):
        code = export_js(read(m.group(1)))
        code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.I)
        return '<script>/* %s */\n%s\n</script>' % (m.group(1), code)

    page, n = re.subn(r'<script src="([^"]+)"></script>', inline, page)
    if n == 0:
        sys.exit('no <script src> tags found')

    left = re.findall(r'(?:src|href)="(?!#)([^"]+)"', page)
    if left:
        sys.exit('still refers to other files: %s' % ', '.join(left))
    # Spaces lining things up in columns ("a  { x }") make PDF copy treat the
    # gap as a table column and reorder the text. Indentation is kept (it is
    # only lost in the copy, harmlessly); other runs of spaces become one.
    page = '\n'.join(re.sub(r'(?<=\S) {2,}', ' ', l).rstrip(' ') for l in page.split('\n'))

    bad = [c for c in page if ord(c) > 127 or (ord(c) < 32 and c != '\n')]
    if bad:
        sys.exit('non-ASCII left in the export: %r' % sorted(set(bad))[:10])
    # PDF copy joins a line ending in "-" to the next one (it takes it for a
    # hyphenated word), so no line may end that way.
    hyphen = [l for l in page.split('\n') if l.endswith('-')]
    if hyphen:
        sys.exit('lines ending in "-" (PDF copy would join them): %r' % hyphen[:3])
    long_lines = [l for l in page.split('\n') if len(l) > LIMIT]
    if long_lines:
        sys.exit('%d lines longer than %d, e.g. %r' % (len(long_lines), LIMIT, long_lines[0][:80]))
    return page


def print_page(code):
    lines = code.count('\n') + 1
    return '''<!doctype html>
<html><head><meta charset="utf-8"><title>%(name)s</title>
<style>
  @page { size: A4 landscape; margin: 12mm 14mm; }
  body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #000; }
  h1 { font-size: 14pt; margin: 0 0 4pt; }
  p { font-size: 9pt; margin: 0 0 10pt; }
  pre { font: 7.5pt/1.45 "DejaVu Sans Mono", Menlo, Consolas, monospace;
        white-space: pre; margin: 0; }
</style></head>
<body>
<h1>%(name)s</h1>
<p>Select all &rarr; copy &rarr; paste into a new file named <b>%(name)s</b>. Delete the two lines above the code. %(lines)d lines, %(chars)d characters.</p>
<pre>%(code)s</pre>
</body></html>
''' % {'name': NAME, 'lines': lines, 'chars': len(code), 'code': htmllib.escape(code, quote=False)}


def find_chrome():
    for c in [os.environ.get('CHROME'), 'google-chrome', 'google-chrome-stable', 'chromium',
              'chromium-browser', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:
        if c and (shutil.which(c) or Path(c).exists()):
            return shutil.which(c) or c
    return None


def main():
    code = build()
    DIST.mkdir(exist_ok=True)
    out = DIST / NAME
    out.write_text(code, encoding='ascii')
    printable = DIST / (NAME + '.print.html')
    printable.write_text(print_page(code), encoding='ascii')
    print('%s (%d lines)' % (out.relative_to(ROOT), code.count('\n') + 1))

    chrome = find_chrome()
    if not chrome:
        print('Chrome not found: open %s in Chrome and print it to PDF '
              '(Headers and footers: off).' % printable.relative_to(ROOT))
        return
    pdf = DIST / (NAME + '.pdf')
    subprocess.run([chrome, '--headless', '--no-sandbox', '--disable-gpu',
                    '--no-pdf-header-footer', '--print-to-pdf=' + str(pdf),
                    printable.as_uri()], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('%s (%d KB)' % (pdf.relative_to(ROOT), pdf.stat().st_size // 1024))


if __name__ == '__main__':
    main()
