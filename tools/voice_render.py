#!/usr/bin/env python3
"""セリフごとの音声ファイルを作る（デモに同梱して、オフラインでも同じ声で再生するため）。

使い方:
  python3 tools/voice_render.py                  # Open JTalk（オフライン）で足りない分だけ作る
  python3 tools/voice_render.py --force          # 全部作り直す
  python3 tools/voice_render.py --engine google  # Google Cloud Text-to-Speech（環境変数 GOOGLE_TTS_API_KEY）
  python3 tools/voice_render.py scenarios/03_*.json   # シナリオを指定

出力: voice/<meta.id>/<セリフのハッシュ>.mp3
  ハッシュは「話者 + セリフ本文」から作るので、セリフを書き換えると新しいファイルになり、
  使われなくなったファイルは自動で消える。tools/bundle.py がファイルのあるセリフに audio を付ける。

話者ごとの声は下の VOICES が既定値。シナリオ側で speakers.<id>.voice.render.jtalk / .google を書くと上書きできる。
Open JTalk に必要なもの: open_jtalk, NAIST-jdic, 声のファイル（.htsvoice）。
  Ubuntu: apt install open-jtalk open-jtalk-mecab-naist-jdic hts-voice-nitech-jp-atr503-m001
  mei / takumi の声: MMDAgent_Example-1.8.zip（sourceforge.net/projects/mmdagent）の Voice/ を
  --voices で指定するフォルダ（既定は tools/voices/）に置く。ライセンスは voice/CREDITS.md を参照。
"""
import argparse, base64, hashlib, json, os, pathlib, re, shutil, subprocess, sys, tempfile, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIC = '/var/lib/mecab/dic/open-jtalk/naist-jdic'
NITECH = '/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice'

# fm: 声の高さ（半音）, r: 話す速さ, jf: 抑揚の強さ（1 が標準。少し上げると平板になりにくい）
VOICES = {
    'narr':  {'jtalk': {'model': 'mei_normal',   'fm': -1.0, 'r': 0.97, 'jf': 1.15}, 'google': {'name': 'ja-JP-Neural2-B', 'rate': 0.98}},
    'ai':    {'jtalk': {'model': 'mei_happy',    'fm': -1.5, 'r': 1.04, 'jf': 0.95}, 'google': {'name': 'ja-JP-Wavenet-A', 'rate': 1.04}},
    'capt':  {'jtalk': {'model': 'takumi_normal', 'fm': -1.0, 'r': 1.00, 'jf': 1.2}, 'google': {'name': 'ja-JP-Neural2-D', 'rate': 1.0}},
    'fo':    {'jtalk': {'model': 'nitech',       'fm': 0.5,  'r': 1.08, 'jf': 1.25}, 'google': {'name': 'ja-JP-Neural2-C', 'rate': 1.08}},
    'atc':   {'jtalk': {'model': 'takumi_normal', 'fm': 1.5, 'r': 1.15, 'jf': 1.0},  'google': {'name': 'ja-JP-Wavenet-D', 'rate': 1.15}},
    'cabin': {'jtalk': {'model': 'mei_bashful',  'fm': 0.0,  'r': 1.05, 'jf': 1.1},  'google': {'name': 'ja-JP-Wavenet-B', 'rate': 1.05}},
    'gpws':  {'jtalk': {'model': 'nitech',       'fm': -3.0, 'r': 1.0,  'jf': 0.4},  'google': {'name': 'ja-JP-Standard-D', 'rate': 1.05, 'pitch': -4}},
}
DEFAULT = VOICES['narr']

DIGJ = dict(zip('0123456789', ['まる', 'いち', 'にい', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']))
digits = lambda n: ''.join(DIGJ[c] for c in n)
WORDS = [('TCAS', 'ティーキャス'), ('FCC', 'エフシーシー'), ('APU', 'エーピーユー'), ('psi', 'ピーエスアイ'), ('RA', 'アールエー'),
         ('AI', 'エーアイ'), ('V1', 'ブイワン'), ('V速度', 'ブイそくど'), ('N2', 'エヌツー'), ('・', '、')]

def reading(s):
    """表示用のセリフを、読み上げ用の読みに直す（管制用語の数字読みなど）。"""
    s = re.sub(r'SKY ?(\d+)', lambda m: 'スカイ' + digits(m.group(1)), s)
    s = re.sub(r'フライトレベル(\d+)', lambda m: 'フライトレベル' + digits(m.group(1)), s)
    s = re.sub(r'(\d+)([LR])', lambda m: digits(m.group(1)) + ('レフト' if m.group(2) == 'L' else 'ライト'), s)
    s = re.sub(r'滑走路(\d+)', lambda m: '滑走路' + digits(m.group(1)), s)
    s = re.sub(r'(^|[^\d.])(\d{2})(で|なら)', lambda m: m.group(1) + digits(m.group(2)) + m.group(3), s)   # 「22で再進入」
    s = re.sub(r'風、?(0\d\d)度', lambda m: '風、' + digits(m.group(1)) + '度', s)
    for a, b in WORDS:
        s = s.replace(a, b)
    return s

def line_key(who, text):
    return hashlib.sha1(f'{who}\n{text}'.encode('utf-8')).hexdigest()[:12]

def voice_cfg(scn, who, engine):
    base = dict((VOICES.get(who) or DEFAULT)[engine])
    over = (((scn.get('speakers') or {}).get(who) or {}).get('voice') or {}).get('render') or {}
    base.update(over.get(engine) or {})
    return base

def model_path(name, voices_dir):
    if name == 'nitech':
        return NITECH
    p = pathlib.Path(name)
    if p.suffix == '.htsvoice' and p.exists():
        return str(p)
    for cand in (voices_dir / f'{name}.htsvoice', *voices_dir.rglob(f'{name}.htsvoice')):
        if cand.exists():
            return str(cand)
    sys.exit(f'声のファイル {name}.htsvoice が見つかりません（--voices {voices_dir}）')

def synth_jtalk(text, cfg, voices_dir, wav):
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(reading(text))
    subprocess.run(['open_jtalk', '-x', DIC, '-m', model_path(cfg['model'], voices_dir), '-s', '48000',
                    '-fm', str(cfg.get('fm', 0)), '-r', str(cfg.get('r', 1)), '-jf', str(cfg.get('jf', 1)),
                    '-ow', wav, f.name], check=True)
    os.unlink(f.name)

def synth_google(text, cfg, out):
    key = os.environ.get('GOOGLE_TTS_API_KEY')
    if not key:
        sys.exit('環境変数 GOOGLE_TTS_API_KEY がありません')
    body = {'input': {'text': reading(text)}, 'voice': {'languageCode': 'ja-JP', 'name': cfg['name']},
            'audioConfig': {'audioEncoding': 'LINEAR16', 'sampleRateHertz': 48000,
                            'speakingRate': cfg.get('rate', 1), 'pitch': cfg.get('pitch', 0)}}
    req = urllib.request.Request('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + key,
                                 data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        pathlib.Path(out).write_bytes(base64.b64decode(json.load(r)['audioContent']))

TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'
RADIO = 'highpass=f=320,lowpass=f=3000,acompressor=threshold=-20dB:ratio=4:makeup=3'

def encode(wav, mp3, radio):
    af = TRIM + (',' + RADIO if radio else '') + ',loudnorm=I=-17:TP=-1.5,apad=pad_dur=0.05'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', af, '-ac', '1', '-ar', '24000',
                    '-c:a', 'libmp3lame', '-b:a', '48k', mp3], check=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='*')
    ap.add_argument('--engine', choices=['jtalk', 'google'], default='jtalk')
    ap.add_argument('--voices', default=str(ROOT / 'tools' / 'voices'))
    ap.add_argument('--force', action='store_true')
    a = ap.parse_args()
    files = [pathlib.Path(f) for f in a.files] or sorted((ROOT / 'scenarios').glob('*.json'))
    voices_dir = pathlib.Path(a.voices)
    made = kept = 0
    for p in files:
        scn = json.loads(p.read_text(encoding='utf-8'))
        sid = scn['meta']['id']
        speakers = scn.get('speakers') or {}
        outdir = ROOT / 'voice' / sid
        outdir.mkdir(parents=True, exist_ok=True)
        want = set()
        for d in scn.get('dialogue', []):
            who = d.get('who', 'narr')
            if who == 'sys' or (speakers.get(who) or {}).get('silent'):
                continue
            k = line_key(who, d['text']); want.add(k + '.mp3')
            mp3 = outdir / (k + '.mp3')
            if mp3.exists() and not a.force:
                kept += 1; continue
            radio = d.get('radio', who == 'atc' or bool((speakers.get(who) or {}).get('radio')))
            with tempfile.TemporaryDirectory() as td:
                wav = os.path.join(td, 'v.wav')
                cfg = voice_cfg(scn, who, a.engine)
                synth_jtalk(d['text'], cfg, voices_dir, wav) if a.engine == 'jtalk' else synth_google(d['text'], cfg, wav)
                encode(wav, str(mp3), radio)
            made += 1
        for old in outdir.glob('*.mp3'):
            if old.name not in want:
                old.unlink()
        print(f'  {p.name}: {len(want)} 本')
    print(f'作成 {made} / そのまま {kept}。続けて python3 tools/bundle.py を実行してください。')

if __name__ == '__main__':
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg が必要です')
    main()
