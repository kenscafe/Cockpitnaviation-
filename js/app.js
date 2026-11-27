/* App shell: scenario picker / file loader, master clock, keyboard, sensor monitor. */
(function () {
  const SD = window.SkyDemo;
  const $ = id => document.getElementById(id);
  const LS_KEY = 'cockpitDemo.customScenarios';
  let scn = null, t = 0, speed = 4, playing = true, holding = false, last = null;
  const ov = {}; // sensor overrides from the monitor panel
  let resumeVoice = false;
  let customs = [];
  try { customs = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch (e) { customs = []; }

  // ---------- messages
  const msg = $('msg'); let msgTimer = null;
  function say(kind, title, items) {
    clearTimeout(msgTimer);
    msg.className = 'msg on ' + kind; msg.innerHTML = '';
    const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '閉じる'; x.onclick = () => msg.className = 'msg';
    const h = document.createElement('h2'); h.textContent = title;
    msg.append(x, h);
    if (items && items.length) { const ul = document.createElement('ul'); items.slice(0, 12).forEach(s => { const li = document.createElement('li'); li.textContent = s; ul.append(li); }); msg.append(ul); }
    if (kind !== 'err') msgTimer = setTimeout(() => msg.className = 'msg', 5000);
  }

  // ---------- picker
  const sel = $('scnSel');
  function fillPicker(activeKey) {
    sel.innerHTML = '';
    const g1 = document.createElement('optgroup'); g1.label = '同梱シナリオ';
    SD.builtins.forEach((s, i) => { const o = new Option(`${s.meta.title}`, 'b:' + i); g1.append(o); });
    sel.append(g1);
    if (customs.length) {
      const g2 = document.createElement('optgroup'); g2.label = '読み込んだファイル';
      customs.forEach((c, i) => g2.append(new Option(`${c.name}`, 'c:' + i)));
      sel.append(g2);
    }
    if (activeKey) sel.value = activeKey;
  }
  function rawFor(key) { const [k, i] = key.split(':'); return k === 'b' ? SD.builtins[+i] : customs[+i] && customs[+i].data; }

  function activate(raw, key) {
    const r = SD.load(raw);
    if (r.errors.length) { say('err', 'シナリオを読み込めませんでした', r.errors); return false; }
    scn = r.scn; t = 0; last = null; holding = false;
    for (const k in ov) delete ov[k];
    SD.Voice.setScenario(scn);
    SD.Card.build(scn);
    $('hTitle').firstChild.nodeValue = scn.meta.title;
    $('hSub').textContent = scn.meta.subtitle || `${SD.fmt(scn.meta.duration)} ・ ${scn.scenes.length}シーン ・ ${scn.incidents.filter(i => i.chart).length}インシデント`;
    document.title = scn.meta.title + ' · コックピット デモ';
    buildSensorPanel();
    if (key) { fillPicker(key); try { const u = new URL(location.href); u.searchParams.set('s', key); history.replaceState(null, '', u); } catch (e) {} }
    if (r.warnings.length) say('ok', `「${scn.meta.title}」を読み込みました（注意 ${r.warnings.length}件）`, r.warnings);
    // 読み込んだらすぐ頭から再生する（音声オンだった場合は音声も続ける）
    setPlaying(true);
    if (resumeVoice) { resumeVoice = false; const vb = $('voiceBtn'); if (vb && !vb.disabled) vb.click(); }
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setPlaying(false); t = scn.incidents[0] ? scn.incidents[0].steps[1] + 1 : 0; } } catch (e) {}
    render();
    if (typeof fit === 'function') fit();
    return true;
  }
  function loadText(text, name) {
    let data; try { data = JSON.parse(text); } catch (e) { say('err', `${name} はJSONとして読めません`, [e.message]); return; }
    const r = SD.load(data);
    if (r.errors.length) { say('err', `${name} を読み込めませんでした`, r.errors); return; }
    const label = (data.meta && data.meta.title) || name;
    const i = customs.findIndex(c => c.name === label);
    const entry = { name: label, data };
    if (i >= 0) customs[i] = entry; else customs.unshift(entry);
    customs = customs.slice(0, 8);
    try { localStorage.setItem(LS_KEY, JSON.stringify(customs)); } catch (e) {}
    const idx = customs.findIndex(c => c.name === label);
    fillPicker();
    if (activate(data, 'c:' + idx)) say('ok', `「${label}」を読み込み、再生を始めました`, r.warnings);
  }
  sel.addEventListener('change', () => { resumeVoice = SD.Voice.isOn(); SD.Voice.stop(); activate(rawFor(sel.value), sel.value); });
  $('scnOpen').addEventListener('click', () => $('scnFile').click());
  $('scnFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) { resumeVoice = SD.Voice.isOn(); SD.Voice.stop(); } if (f) f.text().then(tx => loadText(tx, f.name)); e.target.value = ''; });
  $('scnSave').addEventListener('click', () => {
    if (!scn) return;
    const blob = new Blob([JSON.stringify(scn.raw, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (scn.meta.id || 'scenario') + '.json';
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  // drag & drop anywhere
  const drop = $('drop'); let dragN = 0;
  const isFile = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  window.addEventListener('dragenter', e => { if (!isFile(e)) return; e.preventDefault(); dragN++; drop.classList.add('on'); });
  window.addEventListener('dragover', e => { if (isFile(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) drop.classList.remove('on'); });
  window.addEventListener('drop', e => {
    if (!isFile(e)) return; e.preventDefault(); dragN = 0; drop.classList.remove('on');
    const f = e.dataTransfer.files[0]; if (f) { resumeVoice = SD.Voice.isOn(); SD.Voice.stop(); f.text().then(tx => loadText(tx, f.name)); }
  });

  // ---------- clock
  function render() {
    if (!scn) return;
    const smp = SD.sample(scn, t, ov);
    const h = SD.health(scn, smp);
    SD.Dash.render(scn, t, smp, h);
    SD.Card.render(scn, t, smp);
    SD.Voice.update(t);
    updateSensorPanel(smp, h);
  }
  function frame(ts) {
    if (last != null && playing && !holding && scn) { t += (ts - last) / 1000 * speed; if (t > scn.meta.duration) t = 0; }
    last = ts; render(); requestAnimationFrame(frame);
  }
  const setPlaying = p => { playing = p; holding = false; $('play').textContent = p ? '❚❚ 停止' : '▶ 再生'; };
  $('play').addEventListener('click', () => setPlaying(!playing));
  $('scrub').addEventListener('input', e => { t = +e.target.value; render(); });
  const setSpeed = v => { speed = v; document.querySelectorAll('[data-speed]').forEach(o => o.setAttribute('aria-pressed', String(+o.dataset.speed === v))); };
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
  SD.App = {
    time: () => t, seek: s => { t = Math.max(0, Math.min(scn.meta.duration, s)); render(); },
    play: () => { if (holding) holding = false; else setPlaying(true); }, pause: soft => { if (soft) holding = true; else setPlaying(false); },
    setSpeed, scenario: () => scn, override: ov
  };

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const starts = scn ? scn.scenes.map(s => s.t) : [0];
    if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
    else if (e.key === 'ArrowRight') { const n = starts.find(s => s > t + .5); SD.App.seek(n == null ? 0 : n); }
    else if (e.key === 'ArrowLeft') { const p = starts.filter(s => s < t - 2).pop(); SD.App.seek(p == null ? 0 : p); }
    else if (e.key === 'v' || e.key === 'V') { const b = $('voiceBtn'); if (b && !b.disabled) b.click(); }
    else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); }
  });

  // ---------- sensor monitor
  const grid = $('sgrid'), rows = {};
  const STATE_CTL = [
    ['authority', '権限モード', [['manual', '手動'], ['assist', 'アシスト'], ['auto', '自動']]],
    ['datalink', 'データリンク', [['ok', '正常'], ['lost', '断']]],
    ['tcas', 'TCAS', [['clear', 'なし'], ['ta', 'TA 接近機'], ['ra_climb', 'RA 上昇'], ['ra_descend', 'RA 降下']]],
    ['windshear', 'ウィンドシア', [['', 'なし'], ['1', '検知']]]
  ];
  function buildSensorPanel() {
    grid.innerHTML = ''; for (const k in rows) delete rows[k];
    let group = '';
    const used = SD.SENSORS.filter(s => scn.sensors[s.id] || ['alt', 'ias', 'hdg', 'n1_1', 'n1_2', 'egt_1', 'egt_2', 'hyd_1', 'hyd_2', 'hyd_3', 'gen_1', 'gen_2', 'aoa_1', 'aoa_2', 'aoa_3', 'fuel_l', 'fuel_r', 'xwind', 'wx_dist', 'wx_level', 'cab_alt'].includes(s.id));
    used.forEach(s => {
      if (s.group !== group) { group = s.group; const g = document.createElement('div'); g.className = 'sgroup'; g.textContent = group; grid.append(g); }
      const row = document.createElement('div'); row.className = 'srow';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = s.label; n.title = s.id;
      const v = document.createElement('span'); v.className = 'v';
      const r = document.createElement('input'); r.type = 'range'; r.min = s.min; r.max = s.max; r.step = s.step; r.setAttribute('aria-label', s.label);
      const lb = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; lb.append(cb, ' 固定');
      r.addEventListener('input', () => { cb.checked = true; ov[s.id] = +r.value; row.classList.add('pinned'); render(); });
      cb.addEventListener('change', () => { if (cb.checked) { ov[s.id] = +r.value; row.classList.add('pinned'); } else { delete ov[s.id]; row.classList.remove('pinned'); } render(); });
      row.append(n, v, r, lb); grid.append(row);
      rows[s.id] = { v, r, cb, s, row };
    });
    const g = document.createElement('div'); g.className = 'sgroup'; g.textContent = '状態'; grid.append(g);
    STATE_CTL.forEach(([id, label, opts]) => {
      const row = document.createElement('div'); row.className = 'srow';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = label;
      const v = document.createElement('span'); v.className = 'v';
      const sl = document.createElement('select'); opts.forEach(([val, l]) => sl.append(new Option(l, val)));
      sl.style.cssText = 'font:12px var(--f-body);color:var(--fg);background:#1a222d;border:1px solid var(--edge);border-radius:6px;padding:3px 6px';
      const lb = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; lb.append(cb, ' 固定');
      const apply = () => { if (cb.checked) { ov['$' + id] = sl.value; row.classList.add('pinned'); } else { delete ov['$' + id]; row.classList.remove('pinned'); } render(); };
      sl.addEventListener('change', () => { cb.checked = true; apply(); }); cb.addEventListener('change', apply);
      row.append(n, v, sl, lb); grid.append(row);
      rows['$' + id] = { v, sel: sl, cb, row, state: id, opts };
    });
  }
  $('sReset').addEventListener('click', () => { for (const k in ov) delete ov[k]; Object.values(rows).forEach(o => { o.cb.checked = false; o.row.classList.remove('pinned'); }); render(); });
  let panelTick = 0;
  function updateSensorPanel(smp, h) {
    const now = performance.now();
    if (now - panelTick < 120) return; panelTick = now;
    const chips = $('alertChips'), key = h.alerts.map(a => a.code).join();
    if (chips._k !== key) {
      chips._k = key; chips.innerHTML = '';
      if (!h.alerts.length) { const c = document.createElement('span'); c.className = 'chip none'; c.textContent = '注意・警告なし'; chips.append(c); }
      h.alerts.forEach(a => { const c = document.createElement('span'); c.className = 'chip ' + a.level; c.textContent = a.title; c.title = a.jp || ''; chips.append(c); });
    }
    if (!$('sensors').open) return;
    for (const [id, o] of Object.entries(rows)) {
      if (o.state) { const val = o.state === 'windshear' ? (smp.d.windshear ? '1' : '') : smp.d[o.state]; const lab = (o.opts.find(x => x[0] === val) || [0, val])[1]; o.v.textContent = lab; if (!o.cb.checked) o.sel.value = val; continue; }
      const val = smp.v[id]; if (val == null) continue;
      const dp = o.s.step < 1 ? 1 : 0;
      o.v.textContent = `${(+val).toFixed(dp)} ${o.s.unit}`;
      if (!o.cb.checked && document.activeElement !== o.r) o.r.value = val;
    }
  }

  // ---------- 画面の高さに合わせる：上部バーからフライト進行カードまでが、スクロールせずに1画面に収まるよう縮小する
  const stage = document.querySelector('.stage');
  function fit() {
    stage.style.transform = ''; stage.style.marginBottom = '';
    if (innerWidth < 1100) return;
    const top = stage.getBoundingClientRect().top;
    const need = $('card').getBoundingClientRect().bottom - top;
    const avail = innerHeight - Math.max(0, top) - 8;
    if (need <= avail) return;
    const s = Math.max(.4, avail / need);
    stage.style.transformOrigin = 'top center';
    stage.style.transform = `scale(${s.toFixed(4)})`;
    stage.style.marginBottom = `${(-stage.offsetHeight * (1 - s)).toFixed(0)}px`;
  }
  addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 60));
  $('sensors').addEventListener('toggle', fit);
  try { document.fonts.ready.then(fit); } catch (e) {}
  SD.App && (SD.App.fit = fit);

  // ---------- start
  fillPicker();
  let startKey = 'b:0';
  try { const q = new URL(location.href).searchParams.get('s'); if (q && rawFor(q)) startKey = q; } catch (e) {}
  if (!SD.builtins.length) say('err', '同梱シナリオがありません', ['scenarios/builtin.js が読み込めているか確認してください。JSONファイルを画面にドロップしても再生できます。']);
  else activate(rawFor(startKey), startKey);
  setPlaying(playing); setSpeed(4);
  requestAnimationFrame(frame);
})();
