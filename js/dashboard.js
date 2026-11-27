/* Cockpit dashboard + system layout renderer.
   Everything drawn here comes from the sampled sensor values (smp), the derived
   health (h) and the scenario's incidents. Nothing is tied to a fixed time. */
(function () {
  const SD = window.SkyDemo;
  const NS = 'http://www.w3.org/2000/svg';
  const COL = { g: '#48dd8a', a: '#f3b23e', r: '#f0524f', c: '#45cdea', fg: '#e9eef4', dim: '#8796a8', edge: '#2e3947', ink: '#03060a' };
  const ST_COL = { ok: COL.g, caution: COL.a, isolated: COL.a, fail: COL.r, off: COL.dim };
  const ST_CLS = { ok: 'grn', caution: 'amb', isolated: 'amb', fail: 'red', off: 'dim' };
  const LV_CLS = { warning: 'red', caution: 'amb', advisory: 'cyn' };
  const LV_COL = { warning: COL.r, caution: COL.a, advisory: COL.c };
  const $ = id => document.getElementById(id);
  const cache = new Map();
  const setT = (id, s) => { const n = $(id); if (n && n.textContent !== s) n.textContent = s; };
  const setA = (id, k, v) => { const n = typeof id === 'string' ? $(id) : id; if (!n) return; const key = (n.id || '') + '|' + k; v = String(v); if (cache.get(key) === v) return; cache.set(key, v); n.setAttribute(k, v); };
  const setC = (id, base, c) => setA(id, 'class', (base ? base + ' ' : '') + c);
  const el = (tag, attrs, parent, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; if (parent) parent.appendChild(n); return n; };
  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); };
  const pad3 = v => String(Math.round(((v % 360) + 360) % 360)).padStart(3, '0');
  const r0 = Math.round;
  const spans = (id, parts) => { // parts: [[text, cls], ...]
    const n = $(id), key = JSON.stringify(parts);
    if (n._k === key) return; n._k = key; clear(n);
    parts.forEach(([t, c]) => el('tspan', { class: c }, n, t));
  };
  const pill = (id, text, status) => {
    const t = $(id + 'T'), r = $(id + 'R'); if (!t || !r) return;
    const cls = ST_CLS[status] || 'grn';
    if (t.textContent !== text || !r._sized) { t.textContent = text; try { const w = t.getComputedTextLength(); if (w > 0) { r.setAttribute('width', Math.ceil(w) + 18); r._sized = true; } } catch (e) {} }
    setC(t, t.getAttribute('class').split(' ').filter(c => c === 't-m' || c === 't-j').join(' '), cls);
    setA(r, 'stroke', ST_COL[status] || COL.g);
    setA(r, 'fill', status === 'ok' ? '#0b1f15' : status === 'fail' ? '#2a1414' : status === 'info' ? '#0e2a33' : '#2b2210');
    if (status === 'info') { setA(r, 'stroke', COL.c); setC(t, 't-j', 'cyn'); }
  };

  // ----- one-time construction
  const ladder = $('adiLadder');
  [-20, -15, -10, -5, 5, 10, 15, 20].forEach(p => {
    const y = 300 - p * 3.6, w = p % 10 ? 10 : 22;
    el('line', { x1: 149 - w, x2: 149 + w, y1: y, y2: y }, ladder);
    if (!(p % 10)) { el('text', { x: 149 - w - 15, y: y + 3, fill: '#fff', stroke: 'none', 'font-family': 'JetBrains Mono, monospace', 'font-size': 9 }, ladder, Math.abs(p)); el('text', { x: 149 + w + 3, y: y + 3, fill: '#fff', stroke: 'none', 'font-family': 'JetBrains Mono, monospace', 'font-size': 9 }, ladder, Math.abs(p)); }
  });
  const MONO = { 'font-family': 'JetBrains Mono, monospace' };

  function tapeSpeed(v) {
    const g = $('spdTape'); const k = Math.round(v * 2) / 2; if (g._v === k) return; g._v = k; clear(g);
    for (let s = Math.floor((v - 35) / 10) * 10; s <= v + 35; s += 10) {
      if (s < 0) continue; const y = 300 - (s - v) * 3;
      el('line', { x1: 70, x2: 80, y1: y, y2: y, stroke: '#fff', 'stroke-width': 1.2 }, g);
      if (s % 20 === 0 && Math.abs(y - 300) > 13) el('text', Object.assign({ x: 68, y: y + 3.5, 'text-anchor': 'end', fill: COL.fg, 'font-size': 10 }, MONO), g, s);
    }
  }
  function tapeAlt(v) {
    const g = $('altTape'); const k = Math.round(v / 5) * 5; if (g._v === k) return; g._v = k; clear(g);
    for (let a = Math.floor((v - 340) / 100) * 100; a <= v + 340; a += 100) {
      if (a < 0) continue; const y = 300 - (a - v) * .3;
      el('line', { x1: 220, x2: a % 500 ? 226 : 230, y1: y, y2: y, stroke: '#fff', 'stroke-width': 1.2 }, g);
      if (a % 200 === 0 && Math.abs(y - 300) > 13) el('text', Object.assign({ x: 232, y: y + 3.5, fill: COL.fg, 'font-size': 10 }, MONO), g, String(a / 100).padStart(3, '0'));
    }
  }
  function tapeHdg(v) {
    const g = $('hdgTape'); const k = Math.round(v * 2) / 2; if (g._v === k) return; g._v = k; clear(g);
    for (let d = Math.floor((v - 20) / 5) * 5; d <= v + 20; d += 5) {
      const x = 149 + (d - v) * 4, dd = ((d % 360) + 360) % 360;
      el('line', { x1: x, x2: x, y1: 405, y2: dd % 10 ? 411 : 415, stroke: '#fff', 'stroke-width': 1.2 }, g);
      if (dd % 10 === 0) el('text', Object.assign({ x, y: 427, 'text-anchor': 'middle', fill: COL.fg, 'font-size': 10 }, MONO), g, dd / 10);
    }
  }
  function rose(v) {
    const g = $('ndRose'); const k = Math.round(v); if (g._v === k) return; g._v = k; clear(g);
    for (let d = Math.ceil((v - 38) / 5) * 5; d <= v + 38; d += 5) {
      const a = (d - v) * Math.PI / 180, dd = ((d % 360) + 360) % 360, L = dd % 10 ? 5 : 9;
      const p = r => [391 + r * Math.sin(a), 470 - r * Math.cos(a)];
      const [x1, y1] = p(175), [x2, y2] = p(175 - L);
      el('line', { x1, y1, x2, y2, stroke: '#fff', 'stroke-width': 1.2 }, g);
      if (dd % 30 === 0) { const [x, y] = p(186); el('text', Object.assign({ x, y: y + 3, 'text-anchor': 'middle', fill: COL.fg, 'font-size': 10 }, MONO), g, dd / 10); }
    }
  }
  function n1Gauge(n, cx, v, lim, st) {
    const th = Math.PI - SD.clamp(v, 0, 110) / 100 * Math.PI * 170 / 180;
    const x = cx + 60 * Math.cos(th), y = 230 - 60 * Math.sin(th);
    setA('n1Arc' + n, 'd', `M${cx - 60} 230 A60 60 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`);
    setA('n1Arc' + n, 'stroke', st === 'fail' ? COL.r : st === 'caution' ? COL.a : COL.fg);
    const nd = $('n1Ndl' + n); setA(nd, 'x2', x.toFixed(1)); setA(nd, 'y2', y.toFixed(1)); setA(nd, 'stroke', st === 'fail' ? COL.r : st === 'caution' ? COL.a : COL.g);
    const lm = $('n1Lim' + n);
    if (lim) { const tl = Math.PI - lim / 100 * Math.PI * 170 / 180; setA(lm, 'x1', (cx + 54 * Math.cos(tl)).toFixed(1)); setA(lm, 'y1', (230 - 54 * Math.sin(tl)).toFixed(1)); setA(lm, 'x2', (cx + 68 * Math.cos(tl)).toFixed(1)); setA(lm, 'y2', (230 - 68 * Math.sin(tl)).toFixed(1)); setA(lm, 'opacity', 1); }
    else setA(lm, 'opacity', 0);
    setT('n1LimT' + n, lim ? `LIM ${lim}%` : '');
    setT('n1v' + n, v.toFixed(1)); setC('n1v' + n, '', st === 'fail' ? 'red' : st === 'caution' ? 'amb' : 'grn');
  }

  // ----- timeline (rolling 90 s window)
  const LANE = { pilot: 655, ai: 715, sys: 775, atc: 835 };
  let tlLast = -1;
  function timeline(scn, t) {
    if (Math.abs(t - tlLast) < .05) return; tlLast = t;
    const W = 90, x = tt => 120 + (tt - (t - W)) / W * 367, inWin = tt => tt >= t - W && tt <= t;
    const grid = $('tlGrid'), links = $('tlLinks'), dots = $('tlDots');
    clear(grid); clear(links); clear(dots);
    for (let m = Math.ceil((t - W) / 15) * 15; m <= t; m += 15) {
      if (m < 0) continue; const px = x(m);
      el('line', { x1: px, x2: px, y1: 628, y2: 852, stroke: '#223041' }, grid);
      el('text', Object.assign({ x: px, y: 622, 'text-anchor': 'middle', fill: COL.dim, 'font-size': 9 }, MONO), grid, SD.fmt(m));
    }
    const curve = (t0, l0, t1, l1, op) => {
      const x0 = x(Math.max(t0, t - W)), x1 = x(t1), y0 = LANE[l0], y1 = LANE[l1], mx = (x0 + x1) / 2;
      el('path', { d: `M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`, stroke: COL.c, 'stroke-opacity': op }, links);
    };
    scn.incidents.forEach(inc => {
      const [d, p, k] = inc.steps;
      if (t >= p && p >= t - W - 30) curve(d, 'sys', Math.min(p, t), 'ai', .7);
      if (t >= k && k >= t - W - 30) curve(p, 'ai', k, 'pilot', 1);
      else if (t >= p && t < k) {
        curve(p, 'ai', t - .6, 'pilot', 1);
        el('circle', { cx: x(t) - 8, cy: LANE.pilot, r: 6, fill: 'none', stroke: COL.fg, 'stroke-width': 2, class: 'pulse' }, dots);
        el('text', { x: x(t) - 30, y: LANE.pilot + 21, fill: COL.fg, 'font-family': 'Noto Sans JP, sans-serif', 'font-size': 10 }, dots, '検討中');
      }
      if (inWin(d)) { const px = x(d); el('path', { d: `M${px} ${LANE.sys - 7} l7 7 l-7 7 l-7 -7z`, fill: COL.a }, dots); }
    });
    const evs = scn.events.filter(e => LANE[e.who] && inWin(e.t));
    const latest = {};
    evs.forEach(e => { latest[e.who] = e; });
    evs.forEach(e => {
      const px = x(e.t), py = LANE[e.who], col = e.who === 'ai' ? COL.c : e.who === 'atc' ? '#e061d2' : e.who === 'sys' ? COL.g : COL.fg;
      el('circle', { cx: px, cy: py, r: 4.5, fill: col }, dots);
      if (latest[e.who] !== e) return;
      const txt = e.text.replace(/^(AI|機長|管制|副操縦士)：/, '');
      const short = txt.length > 18 ? txt.slice(0, 17) + '…' : txt;
      const right = px > 330;
      el('text', { x: right ? px - 7 : px + 7, y: py - 9, 'text-anchor': right ? 'end' : 'start', fill: col, 'font-family': 'Noto Sans JP, sans-serif', 'font-size': 10 }, dots, short);
    });
    setT('tlNow', 'NOW ' + SD.fmt(t));
  }

  // ----- main render
  let lastScn = null;
  function render(scn, t, smp, h) {
    if (scn !== lastScn) { lastScn = scn; tlLast = -1; cache.clear(); }
    const { v, d, air } = smp, L = scn.limits, A = h.alerts, has = c => A.some(a => a.code === c);
    const pend = SD.pendingProposal(scn, t), last = SD.lastProposal(scn, t);
    const tg = pend ? pend.proposal.targets : {};
    const au = d.authority, auIdx = { manual: 0, assist: 1, auto: 2 }[au] ?? 0;
    const engSt = n => h.nodes['fadec_' + n] === 'fail' ? 'fail' : A.some(a => a.eng === n) ? 'caution' : 'ok';

    // FCU + master lights
    setT('fcuSpd', d.fcu_spd != null ? String(d.fcu_spd) : air ? String(r0(v.ias)) : '---');
    setT('fcuHdg', d.fcu_hdg != null ? pad3(d.fcu_hdg) : pad3(v.hdg));
    setT('fcuAlt', d.fcu_alt != null ? String(d.fcu_alt) : '-----');
    setT('fcuVs', d.fcu_vs != null ? (d.fcu_vs > 0 ? '+' : '') + d.fcu_vs : '-----');
    setT('fcuAi', tg.alt != null ? `AI案 ${tg.alt >= 18000 ? tg.alt / 100 : tg.alt}` : '');
    setT('fcuAiSpd', tg.spd != null ? `AI案 ${tg.spd}` : '');
    setT('fcuAiHdg', tg.hdg != null ? `AI案 ${pad3(tg.hdg)}` : '');
    setA('ap1Bar', 'opacity', d.ap ? 1 : 0); setC('ap1T', '', d.ap ? 'fg' : 'dim');
    setA('athrBar', 'opacity', air ? 1 : 0); setC('athrT', '', air ? 'fg' : 'dim');
    const AIM = ['AI MONITOR · DISPLAY', 'AI ASSIST · ADVISORY', 'AI AUTO · APPROVED'];
    setT('fcuAiMode', AIM[auIdx]); setC('fcuAiMode', '', auIdx ? 'cyn' : 'dim');
    setA('fcuAiBox', 'stroke', auIdx ? COL.c : COL.edge); setA('fcuAiBox', 'fill', auIdx === 2 ? '#12505e' : auIdx ? '#0e2a33' : '#1a222d');
    const fresh = lv => A.filter(a => a.level === lv).map(a => t - SD.onset(scn, a.code, t));
    const cauF = fresh('caution'), warF = fresh('warning');
    const lightC = cauF.some(x => x < 12) ? 2 : cauF.length ? 1 : 0, lightW = warF.some(x => x < 12) ? 2 : warF.length ? 1 : 0;
    ['L', 'R'].forEach(s => {
      setA('mc' + s, 'fill', lightC ? '#3a2a0c' : '#1d1a12'); setA('mc' + s, 'stroke', lightC ? COL.a : '#3a3220');
      setA('mc' + s + 'T', 'opacity', lightC === 2 ? 1 : lightC ? .75 : .3); setA('mc' + s + 'T', 'class', 't-m amb' + (lightC === 2 ? ' mwOn' : ''));
      setA('mw' + s, 'fill', lightW ? '#4a1414' : '#2a1414'); setA('mw' + s, 'stroke', lightW ? COL.r : '#5a2424');
      setA('mw' + s + 'T', 'opacity', lightW === 2 ? 1 : lightW ? .8 : .45); setA('mw' + s + 'T', 'class', 't-m red' + (lightW === 2 ? ' mwOn' : ''));
    });

    // PFD
    setT('fmaSpd', d.fma_spd || ''); setT('fmaVert', d.fma_vert || ''); setT('fmaLat', d.fma_lat || '');
    setT('fmaAp', d.ap || ''); setT('fmaAthr', air ? 'A/THR' : '');
    setT('fmaAi', ['AI MON', 'AI ADV', 'AI AUTO'][auIdx]);
    setA('adiHor', 'transform', `rotate(${(-v.roll).toFixed(1)} 149 300) translate(0 ${(v.pitch * 3.6).toFixed(1)})`);
    tapeSpeed(v.ias); tapeAlt(v.alt); tapeHdg(v.hdg);
    setT('pfdSpd', String(r0(v.ias)));
    const bug = d.fcu_spd != null ? 300 - (d.fcu_spd - v.ias) * 3 : -100;
    setA('spdBug', 'transform', `translate(0 ${SD.clamp(bug, 200, 400).toFixed(1)})`); setA('spdBug', 'opacity', d.fcu_spd != null ? 1 : 0);
    setT('pfdMach', v.alt > 20000 ? '.' + String(r0(v.mach * 100)).padStart(2, '0') : '');
    setT('pfdAlt', v.alt >= 18000 ? 'FL' + r0(v.alt / 100) : String(r0(v.alt / 10) * 10));
    setT('pfdAltTgt', d.fcu_alt != null ? (d.fcu_alt >= 18000 ? 'FL' + d.fcu_alt / 100 : String(d.fcu_alt)) : '');
    setT('pfdAltAi', tg.alt != null ? `${tg.alt > (d.fcu_alt ?? v.alt) ? '▲' : '▼'}${tg.alt >= 18000 ? tg.alt / 100 : tg.alt} AI` : '');
    setT('pfdVs', Math.abs(v.vs) > 250 ? (v.vs > 0 ? '↑' : '↓') + r0(Math.abs(v.vs) / 100) : '');
    const ra = d.tcas === 'ra_climb' ? 'CLIMB, CLIMB' : d.tcas === 'ra_descend' ? 'DESCEND' : d.windshear ? 'WINDSHEAR' : d.tcas === 'ta' ? 'TRAFFIC' : '';
    setT('pfdWarn', ra); setC('pfdWarn', 't-m', ra === 'TRAFFIC' ? 'amb' : 'red mwOn');
    setT('pfdGs', String(r0(v.gs))); setT('pfdTas', String(v.tas));
    setT('pfdWind', v.wind_spd > 0 ? `${pad3(v.wind_dir)}°/${r0(v.wind_spd)}` : '');
    const aoaBad = [1, 2, 3].some(i => h.nodes['adc_' + i] === 'fail');
    setT('pfdAoa', `AOA ${[v.aoa_1, v.aoa_2, v.aoa_3].map(x => x.toFixed(1)).join(' / ')}`); setC('pfdAoa', '', aoaBad ? 'amb' : 'dim');

    // ND
    setT('ndGsTas', `GS ${r0(v.gs)} TAS ${v.tas}`); setT('ndWpt', d.nav_wpt || ''); setT('ndHdg', `HDG ${pad3(v.hdg)}°`);
    rose(v.hdg);
    if (v.wx_level > 0 && v.wx_dist < 175) {
      const rr = v.wx_dist / 148 * 175, a = v.wx_brg * Math.PI / 180, sc = .8 + v.wx_level * .25;
      setA('ndWx', 'transform', `translate(${(391 + rr * Math.sin(a)).toFixed(1)} ${(470 - rr * Math.cos(a)).toFixed(1)}) scale(${sc})`); setA('ndWx', 'opacity', 1);
      setA('ndWx2', 'opacity', v.wx_level >= 2 ? .75 : 0); setA('ndWx3', 'opacity', v.wx_level >= 3 ? .9 : 0);
      setT('ndWxLbl', `WX ${r0(v.wx_dist)}KM`); setC('ndWxLbl', 't-m', has('WX_AHEAD') ? 'amb' : 'grn');
    } else { setA('ndWx', 'opacity', 0); setT('ndWxLbl', ''); }
    setA('ndRoute', 'opacity', air ? 1 : .35);
    setA('ndAiRoute', 'd', tg.route === 'left' ? 'M391 470 C380 420 330 380 330 330 S380 280 420 260' : tg.route === 'right' ? 'M391 470 C402 420 452 380 452 330 S402 280 362 260' : '');
    const yv = a => 528 - a / (scn.maxAlt * 1.1) * 30;
    const tgtAlt = d.fcu_alt != null && air ? d.fcu_alt : v.alt;
    setA('vdOwn', 'd', `M300 ${yv(v.alt).toFixed(1)} H372 L420 ${yv(tgtAlt).toFixed(1)} H504`);
    setA('vdPlane', 'transform', `translate(0 ${(yv(v.alt) - 522).toFixed(1)})`);
    setA('vdAi', 'd', tg.alt != null ? `M372 ${yv(v.alt).toFixed(1)} L420 ${yv(tg.alt).toFixed(1)} H504` : '');
    setT('vdCur', SD.fmtAlt(v.alt)); setT('vdAiT', tg.alt != null ? `${SD.fmtAlt(tg.alt)} AI案` : '');
    setA('vdAiT', 'y', tg.alt != null ? (yv(tg.alt) - 5).toFixed(1) : 500);

    // EWD
    const mode = !air ? (v.n1_1 > 70 ? 'TOGA' : 'IDLE') : v.vs > 400 ? 'CLB' : v.vs < -400 ? 'IDLE' : 'CRZ';
    setT('ewdThr', `${mode} ${Math.max(v.n1_1, v.n1_2).toFixed(1)}%`);
    [1, 2].forEach(n => {
      const st = engSt(n), cls = st === 'fail' ? 'red' : st === 'caution' ? 'amb' : 'grn';
      n1Gauge(n, n === 1 ? 690 : 910, v['n1_' + n], d['thr_lim_' + n], st);
      const egtC = A.some(a => a.eng === n && /EGT|OVHT/.test(a.code));
      setT('egt' + n, r0(v['egt_' + n]) + (egtC ? ' ▲' : '')); setC('egt' + n, '', egtC ? (has(`ENG${n}_OVHT`) ? 'red' : 'amb') : 'grn');
      setT('n2' + n, v['n2_' + n].toFixed(1)); setC('n2' + n, '', has(`ENG${n}_FAIL`) ? 'red' : 'grn');
      setT('ff' + n, String(r0(v['ff_' + n] / 10) * 10)); setC('ff' + n, '', 'grn');
    });
    const gc = n => h.nodes['gen_' + n] === 'ok' ? 'grn' : 'amb';
    spans('ewdElec', [['GEN1 ', 'dim'], [String(r0(v.gen_1)), gc(1)], ['  GEN2 ', 'dim'], [String(r0(v.gen_2)), gc(2)], ['  APU ', 'dim'], [v.apu_gen > 5 ? String(r0(v.apu_gen)) : d.apu === 'starting' ? 'START' : '—', v.apu_gen > 5 ? 'grn' : d.apu === 'starting' ? 'cyn' : 'dim'], [' kVA', 'dim']]);
    spans('ewdHyd', [['HYD ', 'dim']].concat(...[1, 2, 3].map(n => [[` ${n} `, 'dim'], [String(r0(v['hyd_' + n] / 10) * 10), ST_CLS[h.nodes['hyd_' + n]]]])).concat([[' psi  CAB ', 'dim'], [String(r0(v.cab_alt / 100) * 100), has('CAB_PR') ? 'red' : 'grn'], [' ft', 'dim']]));
    const imb = has('FUEL_IMBAL');
    spans('ewdFuelLR', [['L ', 'dim'], [(v.fuel_l / 1000).toFixed(1), imb ? 'amb' : 'grn'], ['  C ', 'dim'], [(v.fuel_c / 1000).toFixed(1), 'grn'], ['  R ', 'dim'], [(v.fuel_r / 1000).toFixed(1), imb ? 'amb' : 'grn'], [' t', 'dim']]);
    setT('ewdFob', `${(r0(v.fob / 100) * 100).toLocaleString('en').replace(/,/g, ' ')} KG`); setC('ewdFob', '', has('FUEL_LOW') ? 'red' : 'grn');
    const lines = [];
    A.forEach(a => { lines.push([a.title, LV_CLS[a.level]]); (a.actions || []).forEach(x => lines.push([x, 'cyn'])); });
    const ga = $('ewdAlerts'), gk = JSON.stringify(lines);
    if (ga._k !== gk) { ga._k = gk; clear(ga); lines.slice(0, 6).forEach(([s, c], i) => el('text', { x: 562, y: 424 + i * 18, class: c + (c === 'red' ? ' mwOn' : '') }, ga, s)); }
    const memo = [[['AI MONITOR ONLY', 'AI ADVISORY MODE', 'AI AUTO · APPROVED'][auIdx], 'grn']];
    [1, 2].forEach(n => { if (d['thr_lim_' + n]) memo.push([`ENG ${n} THR LIM ${d['thr_lim_' + n]}%`, 'cyn']); });
    if (v.apu_gen > 5) memo.push(['APU AVAIL', 'grn']);
    if (d.memo) memo.push([String(d.memo), 'grn']);
    if (pend) { memo.push([`${pend.proposal.memo || 'AI'} PROPOSED`, 'cyn']); memo.push(['PENDING CREW ACK', 'fg pulse']); }
    else if (last && last.proposal.memo) memo.push([`${last.proposal.memo} ${last.decision === 'reject' ? 'REJECTED' : 'APPROVED'}`, last.decision === 'reject' ? 'amb' : 'grn']);
    const gm = $('ewdMemo'), mk = JSON.stringify(memo);
    if (gm._k !== mk) { gm._k = mk; clear(gm); memo.slice(0, 6).forEach(([s, c], i) => el('text', { x: 836, y: 424 + i * 18, class: c }, gm, s)); }

    // AI display
    setT('aiMode', 'MODE: ' + ['MONITOR', 'ADVISORY', 'AUTO'][auIdx]);
    const shown = pend || last;
    if (!shown) {
      setT('aiTitle', scn.aiIdle.title); setT('aiLine', scn.aiIdle.line); setT('aiSrc', scn.aiIdle.src);
      setA('aiBox', 'stroke', COL.edge); setA('aiBar', 'width', 0); setT('aiConf', '—');
      setA('aiBtnA', 'opacity', .3); setA('aiBtnR', 'opacity', .3); setT('aiBtnAT', '承認'); setT('aiBtnRT', '却下');
    } else {
      const p = shown.proposal, rej = !pend && shown.decision === 'reject';
      setT('aiTitle', p.title); setT('aiLine', rej && p.rejectNote ? p.rejectNote : p.line); setT('aiSrc', p.src);
      setA('aiBar', 'width', r0(200 * p.conf)); setT('aiConf', p.conf.toFixed(2));
      setA('aiBox', 'stroke', pend ? COL.c : rej ? COL.a : COL.g);
      setA('aiBtnA', 'opacity', rej ? .3 : 1); setT('aiBtnAT', pend ? '承認' : rej ? '承認' : '承認済');
      setA('aiBtnR', 'opacity', pend || rej ? 1 : .3); setT('aiBtnRT', rej ? '却下済' : '却下');
      setA('aiBtnR', 'stroke', rej ? COL.a : '#4a5868'); setC('aiBtnRT', 't-j', rej ? 'amb' : 'fg');
    }
    [['aiC2', A[0]], ['aiC3', A[1]]].forEach(([id, a]) => {
      setA(id, 'opacity', a ? 1 : 0);
      if (!a) return;
      setT(id + 'T', a.jp || a.title); setT(id + 'D', a.detail || '');
      setA(id + 'Ic', 'fill', LV_COL[a.level]); setA(id + 'Box', 'stroke', a.level === 'warning' ? COL.r : COL.edge);
    });
    setA('aiNoAlert', 'opacity', A.length ? 0 : 1);
    setT('aiCh', `${(1200 + Object.keys(scn.sensors).length * 3).toLocaleString('en')} ch`);
    const lat = r0(v.ai_latency + 3 * Math.sin(t * 1.7));
    setT('aiLat', `${lat} ms`); setC('aiLat', '', lat > 150 ? 'amb' : 'cyn');

    timeline(scn, t);

    // mesh
    setT('mCount', `${h.ok} OK`); setC('mCount', '', h.ok === h.total ? 'grn' : 'amb');
    [1, 2, 3].forEach(i => {
      const s = h.nodes['fcc_' + i];
      setA('mFcc' + i, 'stroke', ST_COL[s]); setA('mFcc' + i, 'fill', s === 'ok' ? '#121a24' : s === 'fail' ? '#2a1414' : '#1f1a10'); setA('mFcc' + i, 'stroke-dasharray', s === 'ok' ? '' : '3 3');
      setC('mFcc' + i + 'T', '', s === 'ok' ? 'fg' : ST_CLS[s]); setT('mFcc' + i + 'S', { ok: '正常', isolated: '除外中', fail: '故障', caution: '注意', off: '停止' }[s]); setC('mFcc' + i + 'S', '', ST_CLS[s]);
      setA('lF' + i, 'stroke', ST_COL[s]); setA('lF' + i, 'fill', s === 'ok' ? '#0b1f15' : '#2b2210'); setA('lF' + i, 'stroke-dasharray', s === 'ok' ? '' : '2 2'); setC('lF' + i + 'T', '', ST_CLS[s]);
    });
    setT('mVote', h.fccOk >= 2 ? `VOTE ${h.fccOk}/3 · OUTPUT AGREE` : `VOTE ${h.fccOk}/3 · NO MAJORITY`); setC('mVote', 't-m', h.fccOk === 3 ? 'grn' : h.fccOk === 2 ? 'amb' : 'red');
    const engTxt = n => {
      if (has(`ENG${n}_FAIL`)) return ['FADEC 停止', 'fail'];
      if (has(`ENG${n}_OVHT`)) return ['EGT 超過', 'fail'];
      if (has(`ENG${n}_EGT`)) return ['FADEC EGT↑', 'caution'];
      if (d['thr_lim_' + n]) return [`推力制限 ${d['thr_lim_' + n]}%`, 'caution'];
      return ['FADEC 正常', 'ok'];
    };
    const hydOk = [1, 2, 3].filter(n => h.nodes['hyd_' + n] === 'ok');
    const hydBad = [1, 2, 3].filter(n => h.nodes['hyd_' + n] !== 'ok');
    const genOk = [1, 2].filter(n => h.nodes['gen_' + n] === 'ok').length;
    const adcBad = [1, 2, 3].filter(n => h.nodes['adc_' + n] !== 'ok');
    const meshTxt = [
      engTxt(1), engTxt(2),
      hydBad.length ? [`HYD${hydBad.join('+')} ${hydBad.some(n => h.nodes['hyd_' + n] === 'fail') ? '喪失' : '低圧'} · ${hydOk.length}/3`, hydBad.length > 1 ? 'fail' : 'caution'] : ['3系統 ' + r0(Math.min(v.hyd_1, v.hyd_2, v.hyd_3) / 100) * 100 + 'psi', 'ok'],
      genOk === 2 ? ['発電機 ×2', 'ok'] : [`発電機 ${genOk}/2${v.apu_gen > 5 ? ' + APU' : ''}`, v.apu_gen > 5 || genOk ? 'caution' : 'fail'],
      adcBad.length ? [`ADC-${adcBad.join(',')} 不一致`, 'caution'] : d.datalink !== 'ok' ? ['SATCOM 断', 'caution'] : ['IRS×3 · GNSS', 'ok']
    ];
    meshTxt.forEach(([s, st], i) => { setT('mN' + (i + 1) + 'S', s); setC('mN' + (i + 1) + 'S', '', ST_CLS[st]); setA('mN' + (i + 1), 'stroke', st === 'ok' ? COL.edge : ST_COL[st]); });
    setA('mProp', 'class', pend ? 'flow' : ''); setA('mProp', 'stroke-opacity', pend ? 1 : .4);
    setA('mAck', 'class', last && t - last.steps[2] < 4 ? 'flow' : '');
    setT('mAiSub', ['監視のみ', '助言 · 監視', '承認範囲で実行'][auIdx]);
    setT('mGateT', auIdx === 2 ? '承認範囲で実行' : '承認後のみ');

    // authority + health tiles
    [0, 1, 2].forEach(i => {
      const on = i === auIdx;
      setA('au' + i, 'fill', on ? '#0e2a33' : '#121a24'); setA('au' + i, 'stroke', on ? COL.c : COL.edge); setA('au' + i, 'stroke-width', on ? 2 : 1);
      setC('au' + i + 'T', '', on ? 'cyn' : 'dim'); setC('au' + i + 'S', '', on ? 'cyn' : 'dim');
    });
    setT('hHealth', `${h.ok}/${h.total}`); setC('hHealth', '', h.ok === h.total ? 'grn' : 'amb');
    setT('hLink', d.datalink === 'ok' ? 'OK' : 'LOST'); setC('hLink', '', d.datalink === 'ok' ? 'grn' : 'red');
    const nW = A.filter(a => a.level === 'warning').length, nC = A.filter(a => a.level === 'caution').length;
    setT('hAlerts', nW ? (nC ? `${nW}警告 ${nC}注意` : `${nW} 警告`) : nC ? `${nC} 注意` : '0'); setC('hAlerts', '', nW ? 'red' : nC ? 'amb' : 'grn');
    setT('dClock', `DEMO ${SD.fmt(t)} / ${SD.fmt(scn.meta.duration)} · ${SD.fmtAlt(v.alt)} · GS ${r0(v.gs)} · HDG ${pad3(v.hdg)}`);

    // ---------- system layout
    [1, 2].forEach(n => {
      const [txt, st] = engTxt(n);
      setA('lNac' + n, 'stroke', st === 'ok' ? COL.dim : ST_COL[st]);
      setA('lFad' + n, 'stroke', ST_COL[st]); setA('lFad' + n, 'fill', st === 'ok' ? '#0b1f15' : st === 'fail' ? '#2a1414' : '#2b2210'); setC('lFad' + n + 'T', '', ST_CLS[st]);
      setC('lE' + n + 'T', 't-d', st === 'ok' ? 'fg' : ST_CLS[st]); setT('lE' + n + 'S', txt); setC('lE' + n + 'S', 't-j', ST_CLS[st]);
      setA('lG' + n, 'stroke', h.nodes['gen_' + n] === 'ok' ? COL.fg : COL.a);
      setA('lPm' + n, 'stroke', h.nodes['hyd_' + n] === 'ok' ? COL.fg : ST_COL[h.nodes['hyd_' + n]]);
    });
    [1, 2, 3].forEach(n => { const s = h.nodes['hyd_' + n]; setA('lH' + n, 'stroke', ST_COL[s]); setC('lH' + n + 'T', '', ST_CLS[s]); });
    const apuOn = v.apu_gen > 5, apuSt = h.nodes.apu;
    setA('lApu', 'stroke', apuSt === 'fail' ? COL.r : apuOn ? COL.g : d.apu === 'starting' ? COL.c : '#4a5868'); setC('lApuT', 't-m', apuOn ? 'grn' : d.apu === 'starting' ? 'cyn' : 'dim');
    const fmax = scn.fuelMax || (scn.fuelMax = Math.max(1, ...['fuel_l', 'fuel_r'].map(id => scn.sensors[id] && scn.sensors[id].keys ? Math.max(...scn.sensors[id].keys.map(k => k[1])) : 12000)));
    ['l', 'r'].forEach(s => { setA('lFuel' + s.toUpperCase(), 'fill-opacity', (.03 + .16 * SD.clamp(v['fuel_' + s] / fmax, 0, 1)).toFixed(3)); setA('lFuel' + s.toUpperCase(), 'stroke', imb ? COL.a : COL.g); });
    const hydN = hydOk.length;
    pill('lp1', `HYD ${hydN}/3 · GEN ${genOk}/2${apuOn ? ' · APU' : ''}`, hydN === 3 && genOk === 2 ? 'ok' : hydN < 2 || (genOk === 0 && !apuOn) ? 'fail' : 'caution');
    const e1 = engTxt(1), e2 = engTxt(2);
    pill('lp2', e1[1] === 'ok' && e2[1] === 'ok' ? 'FADEC ×2 正常' : e2[1] !== 'ok' ? `ENG 2 · ${e2[0].replace('FADEC ', '')}` : `ENG 1 · ${e1[0].replace('FADEC ', '')}`, e1[1] === 'fail' || e2[1] === 'fail' ? 'fail' : e1[1] === 'ok' && e2[1] === 'ok' ? 'ok' : 'caution');
    pill('lp3', ['MONITOR · 機上推論', 'ADVISORY · 機上推論', 'AUTO · 承認範囲で実行'][auIdx], 'info');
    pill('lp4', `VOTE ${h.fccOk}/3`, h.fccOk === 3 ? 'ok' : h.fccOk === 2 ? 'caution' : 'fail');
    const badF = [1, 2, 3].filter(i => h.nodes['fcc_' + i] !== 'ok');
    setT('lC4a', badF.length ? `FCC-${badF.join(',')} は迎角センサの` : '全3系統が一致して'); setT('lC4b', badF.length ? '不一致で除外中。' : '正常に制御中。');
    pill('lp6', hydN === 3 ? 'REU 12/12' : `REU 12/12 · HYD ${hydN}/3`, hydN === 3 ? 'ok' : 'caution');
    pill('lp7', imb ? `FOB ${(v.fob / 1000).toFixed(1)} t · 左右差 ${(Math.abs(v.fuel_l - v.fuel_r) / 1000).toFixed(1)} t` : `FOB ${(v.fob / 1000).toFixed(1)} t`, has('FUEL_LOW') ? 'fail' : imb ? 'caution' : 'ok');
    pill('lp8', 'A/B OK', 'ok');
    pill('lp9', d.datalink === 'ok' ? 'SATCOM OK' : 'SATCOM LOST', d.datalink === 'ok' ? 'ok' : 'fail');
    pill('lp10', has('TCAS_RA') ? 'TCAS RA 回避中' : has('WINDSHEAR') ? 'ウィンドシア検知' : has('TCAS_TA') ? 'TCAS 接近機' : adcBad.length ? `迎角 ${adcBad.length}系統 不一致` : has('WX_AHEAD') ? '気象レーダー 積乱雲を探知' : has('XWIND') ? `横風 ${r0(v.xwind)}kt 制限超過` : 'センサ 全系統一致', has('TCAS_RA') || has('WINDSHEAR') ? 'fail' : adcBad.length || has('WX_AHEAD') || has('XWIND') || has('TCAS_TA') ? 'caution' : 'ok');

    // focus
    const sc = scn.scenes[SD.sceneAt(scn, t)];
    const f = sc.focus || {};
    const panels = f.panels || ['dash'];
    ['pDash', 'pAir'].forEach(id => document.getElementById(id).classList.toggle('focus', panels.includes(id === 'pDash' ? 'dash' : 'air')));
    const cards = new Set(f.cards || []);
    if (f.auto !== false) { A.forEach(a => (a.sys || []).forEach(c => cards.add(c))); if (pend) pend.systems.forEach(c => cards.add(c)); }
    for (let i = 1; i <= 10; i++) { const c = $('ac' + i); if (c) c.classList.toggle('off', cards.size > 0 && !cards.has(i)); }
    setT('lHdr', `場面：${sc.name}　・　センサー値に応じて各機能の色と状態が変わります`);
  }

  SD.Dash = { render };
})();
