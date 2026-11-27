/* Flight progress card: altitude profile over demo time, built from the scenario. */
(function () {
  const SD = window.SkyDemo;
  const NS = 'http://www.w3.org/2000/svg';
  const C = { fg: '#e9eef4', dim: '#8796a8', rule: '#223041', edge: '#2e3947', green: '#48dd8a', cyan: '#45cdea', amber: '#f3b23e', ink: '#03060a' };
  const $ = id => document.getElementById(id);
  const el = (tag, attrs, parent, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = SD.t(text); if (parent) parent.appendChild(n); return n; };
  const clear = n => { while (n.firstChild) n.removeChild(n.firstChild); };
  const X0 = 140, X1 = 1460, BASE = 230, TOP = 70;
  const STEP_COL = [C.amber, C.cyan, C.fg, C.green];
  const AUTH_STYLE = { manual: ['#1a222d', C.edge, C.fg, '手動'], assist: ['#0e2a33', C.cyan, C.cyan, 'アシスト'], auto: ['#12505e', C.cyan, C.fg, '自動'] };
  const WHO = { sys: ['SYSTEM', 'c-sys'], ai: ['AI', 'c-ai'], pilot: ['PILOT', 'c-pilot'], atc: ['ATC', 'c-atc'] };
  let S = null, T = 300, MAXA = 37000, incEls = [], sceneEls = [];
  const x = t => X0 + (X1 - X0) * t / T;
  const y = a => BASE - (BASE - TOP) * a / MAXA;
  const altAt = t => SD.raw(S, 'alt', t) || 0;
  const pathOf = (fn, t0, t1) => { let d = ''; for (let t = t0; t <= t1; t += .5) d += (d ? 'L' : 'M') + x(t).toFixed(1) + ' ' + y(fn(t)).toFixed(1); return d; };
  const F = { 'font-family': 'Noto Sans JP, sans-serif' }, M = { 'font-family': 'JetBrains Mono, monospace' };

  function build(scn) {
    S = scn; T = scn.meta.duration;
    MAXA = Math.ceil(scn.maxAlt / 1000) * 1000;
    ['grid', 'weather', 'ticks', 'incidents', 'bands'].forEach(id => clear($(id)));
    const grid = $('grid');
    const step = MAXA > 25000 ? 10000 : 5000;
    const levels = [0]; for (let a = step; a < MAXA - 1500; a += step) levels.push(a);
    const cruise = Math.max(...(scn.sensors.alt ? scn.sensors.alt.keys.map(k => k[1]) : [0]));
    if (cruise > 0) levels.push(cruise);
    if (MAXA !== cruise) levels.push(MAXA);
    [...new Set(levels)].forEach(a => {
      el('line', { x1: X0, x2: X1, y1: y(a), y2: y(a), stroke: a ? C.rule : C.edge, 'stroke-dasharray': a ? '2 6' : '' }, grid);
      el('text', Object.assign({ x: X0 - 10, y: y(a) + 4, 'text-anchor': 'end', fill: a === cruise ? C.green : C.dim, 'font-size': 10 }, M), grid, a ? (a >= 18000 ? 'FL' + a / 100 : a + 'ft') : 'GND');
    });
    const mstep = T > 600 ? 120 : 60;
    for (let m = 0; m <= T; m += mstep) el('text', Object.assign({ x: x(m), y: 322, 'text-anchor': 'middle', fill: C.dim, 'font-size': 10 }, M), grid, SD.fmt(m));
    // airports: the first and last time the aircraft is on the ground next to a flight
    const keys = scn.sensors.alt ? scn.sensors.alt.keys : [[0, 0]];
    const firstAir = keys.findIndex(k => k[1] > 0);
    const offGround = firstAir > 0 ? keys[firstAir - 1][0] : 0;
    let touch = T; for (let i = keys.length - 1; i > 0; i--) if (keys[i - 1][1] > 0 && keys[i][1] <= 0) { touch = keys[i][0]; break; }
    const m = scn.meta;
    [[offGround, 'start', m.from], [touch, 'middle', m.landing || m.to]].forEach(([tt, anc, ap]) => {
      if (!ap || !ap.code) return;
      el('rect', { x: x(tt) - 14, y: BASE - 1, width: 28, height: 3, fill: C.fg }, grid);
      el('text', Object.assign({ x: anc === 'start' ? X0 : x(tt), y: BASE + 14, 'text-anchor': anc, fill: C.fg, 'font-size': 10 }, F), grid, `${ap.code} ${ap.name || ''}${ap.runway ? ' · RWY ' + ap.runway : ''}`);
    });
    const wx = $('weather');
    (scn.chart.weather || []).forEach(w => {
      el('ellipse', { cx: x(w.t), cy: y(w.alt ?? cruise), rx: w.rx || 70, ry: w.ry || 46, fill: 'url(#cb)' }, wx);
      if (w.label) el('text', Object.assign({ x: x(w.t), y: y(w.alt ?? cruise) + (w.ry || 46) * .5 + 2, 'text-anchor': 'middle', fill: C.amber, 'font-size': 10 }, F), wx, w.label);
    });
    if (scn.planned) {
      $('plan').setAttribute('d', pathOf(interpPlan, scn.planned[0][0], scn.planned[scn.planned.length - 1][0]));
      const pk = scn.planned.reduce((a, b) => b[1] > a[1] ? b : a);
      if (pk[1] !== cruise) el('text', Object.assign({ x: x(pk[0]) - 4, y: y(pk[1]) - 6, fill: C.dim, 'font-size': 10 }, F), grid, SD.L('当初計画 ', 'Planned ') + `${pk[1] >= 18000 ? 'FL' + pk[1] / 100 : pk[1] + 'ft'}`);
    } else $('plan').setAttribute('d', '');
    const prof = pathOf(altAt, 0, T);
    $('profDim').setAttribute('d', prof); $('profLit').setAttribute('d', prof);
    $('area').setAttribute('d', prof + `L${X1} ${BASE}L${X0} ${BASE}Z`);
    const ticks = $('ticks');
    (scn.chart.markers || []).forEach((mk, i) => {
      const [tt, label] = Array.isArray(mk) ? mk : [mk.t, mk.label];
      const px = x(tt), py = y(altAt(tt)), left = px > X1 - 160;
      el('circle', { cx: px, cy: py, r: 3, fill: C.fg }, ticks);
      el('text', { x: px + (left ? -6 : 6), y: py - 8 - (i % 2 ? 10 : 0), 'text-anchor': left ? 'end' : 'start', fill: C.dim, 'font-family': 'JetBrains Mono, Noto Sans JP, monospace', 'font-size': 9 }, ticks, label);
    });
    const incG = $('incidents');
    const chartInc = scn.incidents.filter(i => i.chart);
    incEls = chartInc.map(inc => {
      const px = x(inc.t), py = y(altAt(inc.t));
      const bx = Math.max(X0 - 40, Math.min(X1 - 96, px));
      const g = el('g', {}, incG);
      const by = 8;
      el('line', { x1: px, x2: px, y1: by + 42, y2: py - 9, stroke: C.edge, 'stroke-dasharray': '2 3' }, g);
      const dia = el('path', { d: `M${px} ${py - 9} l9 9 l-9 9 l-9 -9z`, fill: C.ink, stroke: C.amber, 'stroke-width': 1.8 }, g);
      el('text', Object.assign({ x: px, y: py + 4, 'text-anchor': 'middle', fill: C.amber, 'font-size': 10, 'font-weight': 700 }, F), g, inc.label);
      const box = el('rect', { x: bx - 96, y: by, width: 192, height: 44, rx: 6, fill: '#0b1016', stroke: C.edge }, g);
      const title = el('text', Object.assign({ x: bx - 86, y: by + 18, fill: C.fg, 'font-size': 11, 'font-weight': 700 }, F), g, `${inc.label} ${inc.title}`.slice(0, SD.L(22, 34)));
      const names = ['検知', '提案', inc.decision === 'reject' ? '却下' : '承認', '反映'];
      const pills = names.map((s, i) => {
        const r = el('rect', { x: bx - 86 + i * 44, y: by + 25, width: 40, height: 13, rx: 6.5, fill: 'none', stroke: C.edge }, g);
        const tx = el('text', Object.assign({ x: bx - 66 + i * 44, y: by + 35, 'text-anchor': 'middle', fill: C.dim, 'font-size': 8.5 }, F), g, s);
        return [r, tx];
      });
      return { inc, dia, box, title, pills };
    });
    const bands = $('bands');
    el('text', Object.assign({ x: X0 - 10, y: 262, 'text-anchor': 'end', fill: C.dim, 'font-size': 9 }, M), bands, 'SCENE');
    el('text', Object.assign({ x: X0 - 10, y: 290, 'text-anchor': 'end', fill: C.dim, 'font-size': 9 }, M), bands, 'AUTHORITY');
    sceneEls = scn.scenes.map((s, i) => {
      const r = el('rect', { x: x(s.t) + 1, y: 248, width: Math.max(2, x(s.end) - x(s.t) - 2), height: 20, rx: 3, fill: '#121a24', stroke: C.edge }, bands);
      const w = x(s.end) - x(s.t);
      const label = w > 110 ? `${i + 1} ${s.name}` : w > 30 ? String(i + 1) : '';
      const tx = el('text', Object.assign({ x: (x(s.t) + x(s.end)) / 2, y: 262, 'text-anchor': 'middle', fill: C.dim, 'font-size': 10 }, F), bands, label);
      return [r, tx];
    });
    const au = scn.states.authority || [[0, 'manual']];
    au.forEach(([a, k], i) => {
      const b = i + 1 < au.length ? au[i + 1][0] : T;
      const [f, s, tc, n] = AUTH_STYLE[k] || AUTH_STYLE.manual;
      el('rect', { x: x(a) + 1, y: 276, width: Math.max(2, x(b) - x(a) - 2), height: 20, rx: 3, fill: f, stroke: s }, bands);
      if (x(b) - x(a) > 40) el('text', Object.assign({ x: (x(a) + x(b)) / 2, y: 290, 'text-anchor': 'middle', fill: tc, 'font-size': 10 }, F), bands, n);
    });
    $('fNo').textContent = m.flight || '';
    $('fRoute').innerHTML = '';
    if (m.from && m.from.code) { const b = document.createElement('b'); b.textContent = m.from.code; $('fRoute').append(b, ` ${m.from.name || ''} → `); }
    if (m.to && m.to.code) { const b = document.createElement('b'); b.textContent = m.to.code; $('fRoute').append(b, ` ${m.to.name || ''}`); }
    $('clockTot').textContent = '/ ' + SD.fmt(T);
    $('scrub').max = T;
  }
  function interpPlan(t) {
    const k = S.planned; if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const u = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); const e = u * u * (3 - 2 * u); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * e; }
    return k[k.length - 1][1];
  }

  function render(scn, t, smp) {
    if (scn !== S) build(scn);
    const px = x(t), alt = altAt(t);
    $('flownRect').setAttribute('width', px);
    $('nowLine').setAttribute('x1', px); $('nowLine').setAttribute('x2', px);
    const dy = y(altAt(Math.min(T, t + 1))) - y(altAt(Math.max(0, t - 1)));
    const ang = Math.max(-22, Math.min(22, Math.atan2(dy, x(2) - x(0)) * 180 / Math.PI));
    $('plane').setAttribute('transform', `translate(${px} ${y(alt) - 3})`);
    $('planeRot').setAttribute('transform', `rotate(${ang.toFixed(1)})`);
    const sIdx = SD.sceneAt(scn, t), sc = scn.scenes[sIdx];
    sceneEls.forEach(([r, tx], i) => {
      const on = i === sIdx;
      r.setAttribute('fill', on ? '#e9eef4' : '#121a24');
      tx.setAttribute('fill', on ? C.ink : (i < sIdx ? C.fg : C.dim));
      tx.setAttribute('font-weight', on ? 700 : 400);
    });
    $('sceneTag').textContent = `SCENE ${sIdx + 1}`;
    if ($('sceneName').textContent !== sc.name) $('sceneName').textContent = sc.name;
    $('rPhase').textContent = sc.phase;
    const a = smp.d.authority, st = AUTH_STYLE[a] || AUTH_STYLE.manual;
    $('rAuth').textContent = SD.t(st[3]); $('rAuth').style.color = a === 'manual' ? 'var(--fg)' : 'var(--cyan)';
    $('rAlt').textContent = SD.fmtAlt(smp.v.alt);
    $('rSpd').textContent = `${Math.round(smp.v.gs)} kt`;
    const eta = +smp.d.eta || 0;
    $('rEta').textContent = eta ? `${eta > 0 ? '+' : ''}${eta} ${SD.L('分', 'min')}` : SD.L('±0 分', '±0 min');
    $('rEta').style.color = eta ? 'var(--amber)' : 'var(--fg)';
    $('clock').firstChild.nodeValue = SD.fmt(t) + ' ';
    const ev = SD.lastAt(scn.events, t), w = WHO[ev.who] || WHO.sys;
    $('evWho').textContent = w[0]; $('evWho').className = 'who ' + w[1];
    if ($('evTxt').textContent !== ev.text) $('evTxt').textContent = ev.text;
    // incident boxes: when two overlap, show the one closest to now
    incEls.forEach(o => { o.dist = Math.abs(t - (o.inc.steps[1] + o.inc.steps[2]) / 2); });
    incEls.forEach(o => {
      const { inc, dia, box, title, pills } = o;
      const k = SD.incidentStage(inc, t);
      const active = (k > 0 && k < 4) || (k === 4 && t < inc.steps[3] + 6);
      const rej = inc.decision === 'reject';
      const hidden = incEls.some(p => p !== o && Math.abs(x(p.inc.t) - x(inc.t)) < 196 && p.dist < o.dist);
      [box, title, ...pills.flat()].forEach(n => n.style.display = hidden ? 'none' : '');
      dia.setAttribute('fill', k === 0 ? C.ink : k === 4 ? '#0b1f15' : '#2b2210');
      dia.setAttribute('stroke', k === 4 ? C.green : C.amber);
      box.setAttribute('stroke', active ? STEP_COL[Math.max(0, k - 1)] : C.edge);
      title.setAttribute('fill', k === 0 ? C.dim : C.fg);
      pills.forEach(([r, tx], i) => {
        const on = i < k, col = rej && i === 2 ? C.amber : STEP_COL[i];
        r.setAttribute('fill', on ? col : 'none'); r.setAttribute('stroke', on ? col : C.edge);
        tx.setAttribute('fill', on ? C.ink : C.dim);
      });
    });
    $('scrub').value = t;
  }
  SD.Card = { render, build };
})();
