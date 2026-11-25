#!/usr/bin/env python3
"""Stamp a build version into every asset URL so browsers never mix old and new files.

Run before each release:   python3 tools/stamp_version.py
It rewrites:
  - index.html: css/js/vendor URLs  -> ?v=<build>, and the visible build label
  - js/*.js:    every relative ES-module import -> ?v=<build>
  - js/data.js: the BUILD constant used for data-file URLs
All modules must share the same ?v= or the browser would load two copies of a module.
"""
import re, pathlib, datetime, sys

root = pathlib.Path(__file__).resolve().parent.parent
build = sys.argv[1] if len(sys.argv) > 1 else datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d.%H%M')

idx = root / 'index.html'
s = idx.read_text()
s = re.sub(r'((?:css|js|vendor)/[\w.-]+\.(?:css|js))(\?v=[\w.]+)?"', lambda m: f'{m.group(1)}?v={build}"', s)
s = re.sub(r'(<span id="build"[^>]*>)[^<]*(</span>)', rf'\g<1>{build}\g<2>', s)
idx.write_text(s)

for f in (root / 'js').glob('*.js'):
    t = f.read_text()
    t = re.sub(r"""(from\s+['"]\./[\w.-]+\.js)(\?v=[\w.]+)?(['"])""", lambda m: f'{m.group(1)}?v={build}{m.group(3)}', t)
    t = re.sub(r"export const BUILD = '[^']*';", f"export const BUILD = '{build}';", t)
    f.write_text(t)
print('stamped build', build)
