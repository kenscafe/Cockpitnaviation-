/* デモ画面を台本どおりに自動操作して録画する（tools/tour/make.py から呼ばれる）。
   使い方: node tools/tour/record.cjs <tour.json> <durations.json> <出力フォルダ>
   出力: <出力フォルダ>/raw.webm と timings.json（各段の開始秒。録画の先頭が 0） */
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const [tourPath, durPath, outDir] = process.argv.slice(2);
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));
const durs = JSON.parse(fs.readFileSync(durPath, 'utf8'));
const root = path.resolve(__dirname, '..', '..');
const [W, H] = tour.viewport || [1600, 900];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 画面に重ねる字幕・強調枠・タイトルカード
const OVERLAY = () => {
  const css = document.createElement('style');
  css.textContent = `
  #tourHl{position:fixed;border:3px solid #45cdea;border-radius:12px;box-shadow:0 0 0 9999px rgba(3,6,10,.45),0 0 24px rgba(69,205,234,.55);pointer-events:none;z-index:9998;transition:all .45s cubic-bezier(.2,.7,.2,1);opacity:0}
  #tourCap{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;width:min(1240px,92vw);background:rgba(3,6,10,.88);border:1px solid #2e3947;border-radius:12px;padding:12px 22px 14px;z-index:9999;text-align:center;font-family:"Noto Sans JP","Hiragino Sans",sans-serif;transition:top .3s,bottom .3s}
  #tourCap.tourTop{bottom:auto;top:18px}
  #tourCap .tt{font:600 13px "Chakra Petch","Noto Sans JP",sans-serif;letter-spacing:.12em;color:#45cdea;margin-bottom:4px}
  #tourCap .ja{font-size:24px;line-height:1.45;color:#f1f6fa;font-weight:500}
  #tourCap .en{font-size:17px;line-height:1.4;color:#9fb6c9;margin-top:4px}
  #tourCard{position:fixed;inset:0;z-index:9997;display:grid;place-items:center;background:radial-gradient(900px 500px at 50% 40%,rgba(18,50,74,.92),rgba(3,6,10,.94));opacity:0;transition:opacity .6s;pointer-events:none;text-align:center;color:#e9eef4;font-family:"Noto Sans JP",sans-serif}
  #tourCard.on{opacity:1}
  #tourCard .k{font:600 18px "Chakra Petch",sans-serif;letter-spacing:.2em;color:#45cdea}
  #tourCard .h{font-size:56px;font-weight:700;margin:14px 0 8px}
  #tourCard .s{font:500 24px "Chakra Petch","Noto Sans JP",sans-serif;color:#9fb6c9}`;
  document.head.append(css);
  const hl = document.createElement('div'); hl.id = 'tourHl';
  const cap = document.createElement('div'); cap.id = 'tourCap'; cap.innerHTML = '<div class="tt"></div><div class="ja"></div><div class="en"></div>';
  const card = document.createElement('div'); card.id = 'tourCard';
  card.innerHTML = '<div><div class="k">COCKPIT DEMO PLATFORM</div><div class="h">コックピット デモ　画面の見方</div><div class="s">How to read the cockpit demo screen</div></div>';
  document.body.append(card, hl, cap);
  let target = null;
  const rectOf = t => {
    if (!t) return null;
    if (typeof t === 'string') { const e = document.querySelector(t); return e && e.getBoundingClientRect(); }
    const svg = document.querySelector(t.svg); if (!svg) return null;
    const m = svg.getScreenCTM(), [x, y, w, h] = t.rect, p = svg.createSVGPoint();
    p.x = x; p.y = y; const a = p.matrixTransform(m); p.x = x + w; p.y = y + h; const b = p.matrixTransform(m);
    return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y, bottom: b.y };
  };
  const place = () => {
    const r = rectOf(target);
    if (!r) { hl.style.opacity = 0; cap.classList.remove('tourTop'); return; }
    const pad = 6;
    Object.assign(hl.style, { opacity: 1, left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    cap.classList.toggle('tourTop', r.top + r.height > innerHeight - 170 && r.top > 200);
  };
  setInterval(place, 150);
  window.__tour = {
    cap: (tt, ja, en) => { cap.querySelector('.tt').textContent = tt; cap.querySelector('.ja').textContent = ja; cap.querySelector('.en').textContent = en; },
    hl: t => {
      target = t;
      const r = rectOf(t);
      if (r && (r.top < 0 || r.top + Math.min(r.height, innerHeight - 200) > innerHeight)) {
        const e = typeof t === 'string' ? document.querySelector(t) : document.querySelector(t.svg);
        if (e) e.scrollIntoView({ block: typeof t === 'string' && r.height < innerHeight ? 'center' : 'start', behavior: 'instant' });
      }
      place();
    },
    card: on => card.classList.toggle('on', on)
  };
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: outDir, size: { width: W, height: H } } });
  const t0 = Date.now();
  const p = await ctx.newPage();
  p.on('pageerror', e => console.error('page error:', e.message));
  const url = s => 'file://' + path.join(root, 'index.html') + '?lang=ja&s=' + s;
  async function act(a) {
    const [k, x, y] = a;
    if (k === 'load') {
      await p.evaluate(([key, t]) => {
        const sel = document.getElementById('scnSel');
        if (sel.value !== key) { sel.value = key; sel.dispatchEvent(new Event('change')); }
        SkyDemo.App.pause(); SkyDemo.App.seek(t);
      }, [x, y]);
    } else if (k === 'seek') await p.evaluate(t => { SkyDemo.App.pause(); SkyDemo.App.seek(t); }, x);
    else if (k === 'wait') await sleep(x * 1000);
    else if (k === 'monitor') await p.evaluate(on => { const d = document.getElementById('sensors'); d.open = on; if (on) setTimeout(() => d.scrollIntoView({ block: 'start', behavior: 'instant' }), 300); if (!on) { document.getElementById('sReset').click(); window.scrollTo(0, 0); } }, x);
    else if (k === 'hold') await p.evaluate(([id, v]) => {
      const s = SkyDemo.SENSORS.find(o => o.id === id);
      const r = [...document.querySelectorAll('#sgrid input[type=range]')].find(i => i.getAttribute('aria-label') === SkyDemo.t(s.label));
      if (!r) return;
      const from = +r.value, steps = 12;
      for (let i = 1; i <= steps; i++) setTimeout(() => { r.value = from + (v - from) * i / steps; r.dispatchEvent(new Event('input')); }, i * 70);
    }, [x, y]);
    else if (k === 'lang') await p.click(`[data-lang="${x}"]`);
  }

  await p.goto(url('b:0')); await p.waitForTimeout(1200);
  await p.evaluate(OVERLAY);
  await p.evaluate(() => { SkyDemo.App.pause(); SkyDemo.App.seek(0); document.fonts && document.fonts.ready; });
  await p.waitForTimeout(800);

  const timings = [];
  for (const sg of tour.segments) {
    const D = (durs[sg.id] + (sg.pad ?? 0.8)) * 1000;
    const start = Date.now();
    timings.push({ id: sg.id, start: (start - t0) / 1000, dur: D / 1000, title: sg.title, title_en: sg.title_en });
    await p.evaluate(([tt, ja, en, card]) => { __tour.cap(tt, ja, en); __tour.card(!!card); if (card) __tour.hl(null); }, [sg.title + ' · ' + sg.title_en, sg.ja, sg.en, sg.card]);
    const timers = (sg.hl || []).map(([o, t]) => setTimeout(() => p.evaluate(t => __tour.hl(t), t).catch(() => {}), o * 1000));
    if (!(sg.hl || []).length && !sg.card) await p.evaluate(() => __tour.hl(null));
    for (const a of sg.do || []) await act(a);
    const left = D - (Date.now() - start);
    if (left > 0) await sleep(left);
    timers.forEach(clearTimeout);
  }
  await p.evaluate(() => __tour.hl(null));
  await sleep(300);
  const end = (Date.now() - t0) / 1000;
  await ctx.close(); await b.close();
  const vids = fs.readdirSync(outDir).filter(f => f.endsWith('.webm'));
  const latest = vids.map(f => [f, fs.statSync(path.join(outDir, f)).mtimeMs]).sort((a, c) => c[1] - a[1])[0][0];
  fs.renameSync(path.join(outDir, latest), path.join(outDir, 'raw.webm'));
  fs.writeFileSync(path.join(outDir, 'timings.json'), JSON.stringify({ segments: timings, end }, null, 1));
  console.log('recorded', end.toFixed(1), 's');
})();
