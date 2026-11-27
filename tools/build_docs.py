#!/usr/bin/env python3
"""README.md と docs/*.md から、デモ画面の「使い方」ボタンで開く HTML ページを作る。
使い方:  python3 tools/build_docs.py
外部ライブラリは使わない（この README で使う範囲の Markdown だけを変換する）。
作るもの: readme.html, docs/scenario-format.html, docs/publishing.html"""
import html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = [  # (元の Markdown, 出力先, デモへの相対パス)
    ('README.md', 'readme.html', 'index.html'),
    ('docs/SCENARIO_FORMAT.md', 'docs/scenario-format.html', '../index.html'),
    ('docs/PUBLISHING.md', 'docs/publishing.html', '../index.html'),
]
LINKS = {  # Markdown 内のリンク先 → HTML ページ（出力先からの相対で解決し直す）
    'README.md': 'readme.html',
    'docs/SCENARIO_FORMAT.md': 'docs/scenario-format.html',
    'docs/PUBLISHING.md': 'docs/publishing.html',
}


def rel(src_page, target):
    """src_page（出力先パス）から target（ルートからのパス）への相対パス。"""
    depth = src_page.count('/')
    return '../' * depth + target


def inline(text, out_path, src_dir):
    codes = []
    def keep(m):
        codes.append(m.group(1)); return f'\x00{len(codes) - 1}\x00'
    text = re.sub(r'`([^`]+)`', keep, text)
    text = html.escape(text, quote=False)

    def fix(url):
        if re.match(r'^[a-z]+:', url) or url.startswith('#'):
            return url
        key = str(pathlib.PurePosixPath(src_dir, url)).lstrip('./') if src_dir else url
        key = key.replace('docs/../', '')
        return rel(out_path, LINKS[key]) if key in LINKS else rel(out_path, key)

    # 画像付きリンク [![alt](img)](url)、画像、リンク
    text = re.sub(r'\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)',
                  lambda m: f'<a href="{fix(m.group(3))}"><img alt="{m.group(1)}" src="{m.group(2)}"></a>', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: f'<a href="{fix(m.group(2))}">{m.group(1)}</a>', text)
    text = re.sub(r'(?<!["=>])(https?://[^\s<）)*]+)', r'<a href="\1">\1</a>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # `docs/XXX.md` のようなコード表記のファイル名もページへのリンクにする
    def unkeep(m):
        c = codes[int(m.group(1))]
        key = c if c in LINKS else None
        code = f'<code>{html.escape(c)}</code>'
        return f'<a href="{rel(out_path, LINKS[key])}">{code}</a>' if key else code
    return re.sub(r'\x00(\d+)\x00', unkeep, text)


def convert(md, out_path, src_dir):
    lines, out, i = md.split('\n'), [], 0
    para = []
    def flush():
        if para:
            out.append('<p>' + '<br>'.join(inline(p, out_path, src_dir) for p in para) + '</p>'); para.clear()
    while i < len(lines):
        ln = lines[i]
        if ln.startswith('```'):
            flush(); lang = ln[3:].strip(); buf = []; i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                buf.append(lines[i]); i += 1
            out.append(f'<pre class="{lang}"><code>{html.escape(chr(10).join(buf))}</code></pre>'); i += 1; continue
        m = re.match(r'^(#{1,4})\s+(.*)', ln)
        if m:
            flush(); n = len(m.group(1)); t = m.group(2)
            hid = re.sub(r'[\s　]+', '-', re.sub(r'[`*（）()]', '', t)).lower()
            out.append(f'<h{n} id="{html.escape(hid)}">{inline(t, out_path, src_dir)}</h{n}>'); i += 1; continue
        if ln.startswith('|'):
            flush(); rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')]); i += 1
            head, body = rows[0], [r for r in rows[1:] if not all(re.fullmatch(r':?-+:?', c) for c in r)]
            t = ['<div class="tbl"><table><thead><tr>'] + [f'<th>{inline(c, out_path, src_dir)}</th>' for c in head] + ['</tr></thead><tbody>']
            for r in body:
                t += ['<tr>'] + [f'<td>{inline(c, out_path, src_dir)}</td>' for c in r] + ['</tr>']
            out.append(''.join(t) + '</tbody></table></div>'); continue
        m = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', ln)
        if m:
            flush(); tag = 'ol' if m.group(2)[0].isdigit() else 'ul'; items = []
            while i < len(lines):
                mm = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)', lines[i])
                if not mm: break
                items.append(f'<li>{inline(mm.group(3), out_path, src_dir)}</li>'); i += 1
            out.append(f'<{tag}>' + ''.join(items) + f'</{tag}>'); continue
        if not ln.strip():
            flush(); i += 1; continue
        para.append(ln.strip()); i += 1
    flush()
    return '\n'.join(out)


CSS = '''
:root { color-scheme: dark; --room:#0c1117; --card:#10161e; --rule:#223041; --edge:#2e3947; --fg:#e9eef4; --dim:#8796a8; --cyan:#45cdea;
  --f-display:"Chakra Petch","Noto Sans JP",system-ui,sans-serif; --f-body:"Noto Sans JP","Hiragino Sans","Yu Gothic",system-ui,sans-serif;
  --f-mono:"JetBrains Mono",ui-monospace,"SFMono-Regular",Menlo,monospace; }
html, body { background: var(--room); }
body { margin: 0; color: var(--fg); font: 15px/1.75 var(--f-body); }
.nav { position: sticky; top: 0; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; padding: 10px 16px; background: rgba(12,17,23,.94);
  border-bottom: 1px solid var(--rule); font: 600 13px var(--f-mono); z-index: 1; }
.nav a { color: var(--fg); text-decoration: none; } .nav a:hover, .nav a[aria-current] { color: var(--cyan); }
.nav .back { border: 1px solid var(--cyan); color: var(--cyan); border-radius: 6px; padding: 4px 10px; }
main { max-width: 880px; margin: 0 auto; padding: 24px 16px 64px; }
h1, h2, h3 { font-family: var(--f-display); line-height: 1.35; } h1 { font-size: 28px; } h2 { font-size: 21px; margin-top: 40px; padding-top: 12px; border-top: 1px solid var(--rule); }
a { color: var(--cyan); } img { vertical-align: middle; max-width: 100%; }
code { font: 13px var(--f-mono); background: var(--card); border: 1px solid var(--rule); border-radius: 4px; padding: 1px 5px; overflow-wrap: anywhere; }
pre { background: var(--card); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; overflow-x: auto; }
pre code { border: 0; padding: 0; background: none; overflow-wrap: normal; }
.tbl { overflow-x: auto; } table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { border-bottom: 1px solid var(--rule); padding: 7px 10px; text-align: left; vertical-align: top; } th { color: var(--dim); font-weight: 600; white-space: nowrap; }
'''


def page(title, body, out_path, demo):
    nav = [('readme.html', '使い方'), ('docs/scenario-format.html', 'シナリオの書き方'), ('docs/publishing.html', '更新と公開')]
    links = ''.join(f'<a href="{rel(out_path, p)}"{" aria-current=page" if p == out_path else ""}>{t}</a>' for p, t in nav)
    fonts = rel(out_path, 'assets/fonts/fonts.css')
    return f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><link rel="stylesheet" href="{fonts}"><style>{CSS}</style></head>
<body><nav class="nav"><a class="back" href="{demo}">← デモに戻る</a>{links}</nav>
<main>
{body}
</main></body></html>
'''


for src, dst, demo in PAGES:
    md = (ROOT / src).read_text(encoding='utf-8')
    title = re.search(r'^#\s+(.*)', md, re.M).group(1)
    src_dir = str(pathlib.PurePosixPath(src).parent)
    src_dir = '' if src_dir == '.' else src_dir
    (ROOT / dst).write_text(page(title, convert(md, dst, src_dir), dst, demo), encoding='utf-8')
    print('wrote', dst)
