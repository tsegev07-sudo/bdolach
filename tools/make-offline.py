#!/usr/bin/env python3
"""
Builds ONE self-contained HTML file of the app, for computers with no
internet and no web server (closed / private networks).

    python3 tools/make-offline.py            -> dist/bdolach-offline.html

Everything (CSS, JavaScript, content, icon) is put inside the one file.
The computer only needs Chrome or Edge: double-click the file to open it.
Ticks and night mode are remembered by that browser on that computer.

Uses only the Python standard library. Run it again after any change in www/.
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WWW = ROOT / 'www'
OUT = ROOT / 'dist' / 'bdolach-offline.html'


def read(rel):
    return (WWW / rel).read_text(encoding='utf-8')


def inline_script(m):
    src = m.group(1)
    code = read(src)
    # "</script" inside the code would end the <script> tag early
    code = re.sub(r'</(script)', r'<\\/\1', code, flags=re.I)
    return '<script>/* %s */\n%s\n</script>' % (src, code)


def main():
    html = read('index.html')

    # Stylesheet -> <style>
    html, n = re.subn(r'<link rel="stylesheet" href="([^"]+)">',
                      lambda m: '<style>\n%s\n</style>' % read(m.group(1)), html)
    if n != 1:
        sys.exit('expected exactly one stylesheet link, found %d' % n)

    # <script src="..."> -> inline <script>
    html, n = re.subn(r'<script src="([^"]+)"></script>', inline_script, html)
    if n == 0:
        sys.exit('no <script src> tags found')

    # Tab icon -> data URI
    icon = base64.b64encode((WWW / 'icons/icon-192.png').read_bytes()).decode('ascii')
    html = html.replace('<link rel="icon" href="icons/icon-192.png">',
                        '<link rel="icon" href="data:image/png;base64,%s">' % icon)

    # Website-only links that a local file can't use (install / home-screen)
    html = re.sub(r'\s*<link rel="manifest"[^>]*>', '', html)
    html = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', '', html)

    # Nothing may still point at a separate file
    left = re.findall(r'(?:src|href)="(?!data:|#)([^"]+)"', html)
    if left:
        sys.exit('still refers to other files: %s' % ', '.join(left))

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print('%s (%d KB)' % (OUT.relative_to(ROOT), OUT.stat().st_size // 1024))


if __name__ == '__main__':
    main()
