#!/usr/bin/env python3
from pathlib import Path
import hashlib
import re
import shutil
import time

ROOT = Path(__file__).resolve().parents[1]
PUBLISH = ROOT / 'publish'
INDEX = PUBLISH / 'index.html'
STAMP = time.strftime('%Y%m%d%H%M%S')
TOKEN = f'global-refresh-{STAMP}'

SCRIPT_RE = re.compile(r'<script\s+([^>]*?)src="(\.\/[^"?#]+\.js)(?:\?v=[^"]*)?"([^>]*)></script>')
STYLE_RE = re.compile(r'<link\s+([^>]*?)href="(\.\/[^"?#]+\.css)(?:\?v=[^"]*)?"([^>]*)>')

def digest(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]

def versioned_name(path: Path) -> str:
    stem = path.stem
    ext = path.suffix
    cleaned = re.sub(r'-prodrefresh\d+|-[0-9a-f]{8}-force\d+|-[0-9]{14}', '', stem)
    return f'{cleaned}-{digest(path)}-force{STAMP}{ext}'

def canonical_path(path: Path) -> Path:
    cleaned = re.sub(r'-prodrefresh\d+|-[0-9a-f]{8}-force\d+|-[0-9]{14}', '', path.stem)
    canonical = path.with_name(f'{cleaned}{path.suffix}')
    return canonical if canonical.exists() else path

def copy_versioned(rel: str) -> str:
    current = (PUBLISH / rel.removeprefix('./')).resolve()
    if not current.exists() or PUBLISH.resolve() not in current.parents:
        return f'{rel}?v={TOKEN}'
    src = canonical_path(current).resolve()
    if not src.exists() or PUBLISH.resolve() not in src.parents:
        src = current
    dst = src.with_name(versioned_name(src))
    if dst != src:
        shutil.copy2(src, dst)
    return f'./{dst.relative_to(PUBLISH).as_posix()}?v={TOKEN}'

def main():
    if not INDEX.exists():
        raise SystemExit('publish/index.html 不存在')
    html = INDEX.read_text(encoding='utf-8')

    def repl_script(m):
        return f'<script {m.group(1)}src="{copy_versioned(m.group(2))}"{m.group(3)}></script>'

    def repl_style(m):
        return f'<link {m.group(1)}href="{copy_versioned(m.group(2))}"{m.group(3)}>'

    html = SCRIPT_RE.sub(repl_script, html)
    html = STYLE_RE.sub(repl_style, html)
    html = re.sub(r"window\.__ARCANE_BUILD='[^']*'", f"window.__ARCANE_BUILD='{TOKEN}'", html)
    INDEX.write_text(html, encoding='utf-8')
    print(TOKEN)

if __name__ == '__main__':
    main()
