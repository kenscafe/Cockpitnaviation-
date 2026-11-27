#!/usr/bin/env python3
"""scenarios/*.json をまとめて scenarios/builtin.js を作り直す（同梱シナリオの一覧になる）。
使い方:  python3 tools/bundle.py
並び順はファイル名順。ファイル名の先頭に 01_ などを付けると順番を変えられる。"""
import hashlib, json, pathlib
base = pathlib.Path(__file__).resolve().parent.parent
root = base / 'scenarios'

def attach_audio(data):
    """tools/voice_render.py で作った音声 voice/<id>/<hash>.mp3 があるセリフに audio を付ける。"""
    sid = (data.get('meta') or {}).get('id', '')
    n = 0
    for d in data.get('dialogue', []):
        k = hashlib.sha1(f"{d.get('who', 'narr')}\n{d.get('text', '')}".encode('utf-8')).hexdigest()[:12]
        rel = f'voice/{sid}/{k}.mp3'
        if 'audio' not in d and (base / rel).exists():
            d['audio'] = rel; n += 1
    return n
out = ['/* 自動生成：scenarios/*.json を同梱用にまとめたもの。tools/bundle.py で作り直せます。 */']
for p in sorted(root.glob('*.json')):
    if p.name.startswith('_') or p.name == 'schema.json':
        continue
    data = json.loads(p.read_text(encoding='utf-8'))
    n = attach_audio(data)
    out.append(f'SkyDemo.register({json.dumps(data, ensure_ascii=False)});')
    print('  +', p.name, f'(音声 {n} 本)' if n else '')
(root / 'builtin.js').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('wrote', root / 'builtin.js')
