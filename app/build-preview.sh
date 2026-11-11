#!/bin/bash
# Inline every script and stylesheet into one file, so the app can be opened
# from a single HTML document with no server.
set -e
OUT=../creator-studio-preview.html
python3 - <<'PY'
import re, os
html = open('index.html', encoding='utf-8').read()

def inline_script(m):
    src = m.group(1)
    if not os.path.exists(src): return m.group(0)
    return '<script>\n' + open(src, encoding='utf-8').read() + '\n</script>'

def inline_css(m):
    href = m.group(1)
    if not os.path.exists(href): return m.group(0)
    css = open(href, encoding='utf-8').read()
    base = os.path.dirname(href)
    # fonts are referenced relative to their stylesheet
    def fix(mm):
        p = os.path.join(base, mm.group(1))
        if not os.path.exists(p): return mm.group(0)
        import base64
        data = base64.b64encode(open(p, 'rb').read()).decode()
        return 'url("data:font/woff2;base64,%s")' % data
    css = re.sub(r'url\("([^"]+\.woff2)"\)', fix, css)
    return '<style>\n' + css + '\n</style>'

n = len(re.findall(r'<script src="([^"]+)"></script>', html))
html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
# The board page rides along as text; the Board screen loads it into its
# frame with srcdoc (a file:// frame couldn't reach the app's database).
if os.path.exists('board/board.html'):
    board = open('board/board.html', encoding='utf-8').read().replace('</script>', '<\\/script>')
    at = html.rfind('</body>')
    html = html[:at] + '<script type="text/plain" id="cs3-board-src">' + board + '</script>\n' + html[at:]
open('../creator-studio-preview.html', 'w', encoding='utf-8').write(html)
size = os.path.getsize('../creator-studio-preview.html') // 1024
print('inlined %d scripts -> ../creator-studio-preview.html (%d KB)' % (n, size))
PY
