#!/usr/bin/env python3
"""紹介ページの説明動画 story/tour.mp4 を作る。

  python3 tools/tour/make.py [--voices フォルダ]

1. tools/tour/tour.json の各段のナレーションを Open JTalk（声 mei_normal）で合成
2. node tools/tour/record.cjs でデモ画面を台本どおりに操作して録画（Playwright）
3. ffmpeg で録画とナレーションを合わせ、story/tour.mp4・story/img/tour-poster.jpg・story/tour-chapters.js を書き出す
必要なもの: open_jtalk と声のファイル（tools/voice_render.py と同じ）、Node.js と playwright、ffmpeg
"""
import argparse, json, pathlib, subprocess, sys, tempfile
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
import voice_render as vr

ap = argparse.ArgumentParser()
ap.add_argument('--voices', default=str(ROOT / 'tools' / 'voices'))
ap.add_argument('--crf', default='27')
a = ap.parse_args()
tour = json.loads((HERE / 'tour.json').read_text(encoding='utf-8'))
work = pathlib.Path(tempfile.mkdtemp(prefix='tour-'))
cfg = dict(vr.VOICES['narr']['jtalk'])

def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).decode())

durs = {}
for sg in tour['segments']:
    raw, wav = work / f"{sg['id']}.raw.wav", work / f"{sg['id']}.wav"
    vr.synth_jtalk(sg['ja'], cfg, pathlib.Path(a.voices), str(raw))
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(raw), '-af', vr.TRIM + ',loudnorm=I=-17:TP=-1.5', '-ac', '1', '-ar', '48000', str(wav)], check=True)
    durs[sg['id']] = round(dur(wav), 2)
    print(f"  {sg['id']:10s} {durs[sg['id']]:5.1f}s")
(work / 'durs.json').write_text(json.dumps(durs))

subprocess.run(['node', str(HERE / 'record.cjs'), str(HERE / 'tour.json'), str(work / 'durs.json'), str(work)], check=True)
tm = json.loads((work / 'timings.json').read_text())
segs = tm['segments']
t0 = max(0, segs[0]['start'] - 0.2)
total = tm['end'] - t0

cmd = ['ffmpeg', '-y', '-v', 'error', '-ss', f'{t0:.3f}', '-i', str(work / 'raw.webm')]
fl = []
for i, sg in enumerate(segs):
    cmd += ['-i', str(work / f"{sg['id']}.wav")]
    ms = int(round((sg['start'] - t0 + 0.35) * 1000))
    fl.append(f'[{i + 1}:a]adelay={ms}|{ms}[a{i}]')
fl.append(''.join(f'[a{i}]' for i in range(len(segs))) + f'amix=inputs={len(segs)}:normalize=0,apad[aout]')
fl.append('[0:v]scale=1280:720:flags=lanczos,fps=30,format=yuv420p[vout]')
out = ROOT / 'story' / 'tour.mp4'
cmd += ['-filter_complex', ';'.join(fl), '-map', '[vout]', '-map', '[aout]', '-t', f'{total:.3f}',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', a.crf, '-c:a', 'aac', '-b:a', '96k', '-ac', '1', '-movflags', '+faststart', str(out)]
subprocess.run(cmd, check=True)
poster = ROOT / 'story' / 'img' / 'tour-poster.jpg'
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '1.5', '-i', str(out), '-frames:v', '1', '-q:v', '4', str(poster)], check=True)
chapters = [{'id': s['id'], 'start': round(s['start'] - t0, 2), 'ja': s['title'], 'en': s['title_en']} for s in segs]
(ROOT / 'story' / 'tour-chapters.js').write_text('/* 自動生成：tools/tour/make.py */\nwindow.TOUR = ' + json.dumps({'duration': round(total, 2), 'chapters': chapters}, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
print('wrote', out, f'{out.stat().st_size / 1e6:.1f} MB', f'{total:.1f}s')
