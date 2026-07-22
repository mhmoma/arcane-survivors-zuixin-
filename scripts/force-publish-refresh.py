#!/usr/bin/env python3
from pathlib import Path
import re
import time

ROOT = Path(__file__).resolve().parents[1]
PUBLISH = ROOT / 'publish'
INDEX = PUBLISH / 'index.html'
STAMP = time.strftime('%Y%m%d%H%M%S')
TOKEN = f'global-refresh-{STAMP}'

SCRIPT_RE = re.compile(r'<script\s+([^>]*?)src="(\.\/[^"?#]+\.js)(?:\?v=[^"]*)?"([^>]*)></script>')
STYLE_RE = re.compile(r'<link\s+([^>]*?)href="(\.\/[^"?#]+\.css)(?:\?v=[^"]*)?"([^>]*)>')

def refresh_url(rel: str) -> str:
    return f'{rel}?v={TOKEN}'

def main():
    if not INDEX.exists():
        raise SystemExit('publish/index.html 不存在')
    html = INDEX.read_text(encoding='utf-8')

    def repl_script(m):
        return f'<script {m.group(1)}src="{refresh_url(m.group(2))}"{m.group(3)}></script>'

    def repl_style(m):
        return f'<link {m.group(1)}href="{refresh_url(m.group(2))}"{m.group(3)}>'

    html = SCRIPT_RE.sub(repl_script, html)
    html = STYLE_RE.sub(repl_style, html)
    html = re.sub(r'global-refresh-\d{14}', TOKEN, html)
    INDEX.write_text(html, encoding='utf-8')
    print(TOKEN)

if __name__ == '__main__':
    main()
