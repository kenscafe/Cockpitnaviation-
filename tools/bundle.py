#!/usr/bin/env python3
"""scenarios/*.json をまとめて scenarios/builtin.js を作り直す（同梱シナリオの一覧になる）。
使い方:  python3 tools/bundle.py
並び順はファイル名順。ファイル名の先頭に 01_ などを付けると順番を変えられる。"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'scenarios'
out = ['/* 自動生成：scenarios/*.json を同梱用にまとめたもの。tools/bundle.py で作り直せます。 */']
for p in sorted(root.glob('*.json')):
    if p.name.startswith('_') or p.name == 'schema.json':
        continue
    data = json.loads(p.read_text(encoding='utf-8'))
    out.append(f'SkyDemo.register({json.dumps(data, ensure_ascii=False)});')
    print('  +', p.name)
(root / 'builtin.js').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('wrote', root / 'builtin.js')
