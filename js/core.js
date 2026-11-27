/* Scenario engine: loads a scenario object, samples sensor values at any demo time,
   and derives system health and alerts from those values. No DOM access here. */
(function () {
  const SD = window.SkyDemo = window.SkyDemo || {};
  SD.builtins = SD.builtins || [];
  SD.register = s => { SD.builtins.push(s); };

  const FORMAT = 'cockpit-demo-scenario/1';
  SD.FORMAT = FORMAT;
  const ease = u => u * u * (3 - 2 * u);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SD.clamp = clamp;
  const WRAP = { hdg: 360, wind_dir: 360, wx_brg: 360 };

  SD.DEFAULT_LIMITS = {
    egtSplit: 25,      // °C hotter than the other engine at the same or lower N1 → caution
    egtMax: 950,       // °C overtemperature → warning
    n2Min: 50,         // % below this while airborne → engine failure
    aoaDisagree: 2.0,  // ° away from the median of the 3 AOA sensors → that channel is voted out
    hydLow: 2200,      // psi
    hydFail: 500,      // psi
    genMin: 10,        // kVA
    fuelImbalance: 1500, // kg between left and right wing tanks
    fuelLow: 3000,     // kg total
    xwind: 20,         // kt landing crosswind
    wxDist: 100,       // km
    wxLevel: 2,        // 0–3 radar intensity
    cabAlt: 9550       // ft cabin altitude → warning
  };

  // Sensor catalogue: label, unit and range. Used by validation and the sensor panel.
  SD.SENSORS = [
    ['alt', '高度', 'ft', 0, 45000, 100, '飛行'],
    ['ias', '指示対気速度', 'kt', 0, 400, 1, '飛行'],
    ['gs', '対地速度', 'kt', 0, 650, 1, '飛行'],
    ['hdg', '機首方位', '°', 0, 359, 1, '飛行'],
    ['pitch', 'ピッチ', '°', -15, 25, .5, '飛行'],
    ['roll', 'ロール', '°', -45, 45, .5, '飛行'],
    ['vs', '昇降率', 'fpm', -6000, 6000, 100, '飛行'],
    ['n1_1', 'ENG1 N1', '%', 0, 110, .1, 'エンジン'],
    ['n1_2', 'ENG2 N1', '%', 0, 110, .1, 'エンジン'],
    ['n2_1', 'ENG1 N2', '%', 0, 110, .1, 'エンジン'],
    ['n2_2', 'ENG2 N2', '%', 0, 110, .1, 'エンジン'],
    ['egt_1', 'ENG1 EGT', '°C', 0, 1100, 1, 'エンジン'],
    ['egt_2', 'ENG2 EGT', '°C', 0, 1100, 1, 'エンジン'],
    ['ff_1', 'ENG1 燃料流量', 'kg/h', 0, 9000, 10, 'エンジン'],
    ['ff_2', 'ENG2 燃料流量', 'kg/h', 0, 9000, 10, 'エンジン'],
    ['fuel_l', '左翼タンク', 'kg', 0, 20000, 100, '燃料'],
    ['fuel_r', '右翼タンク', 'kg', 0, 20000, 100, '燃料'],
    ['fuel_c', '中央タンク', 'kg', 0, 40000, 100, '燃料'],
    ['hyd_1', '油圧 1系統', 'psi', 0, 3500, 10, '油圧・電源'],
    ['hyd_2', '油圧 2系統', 'psi', 0, 3500, 10, '油圧・電源'],
    ['hyd_3', '油圧 3系統', 'psi', 0, 3500, 10, '油圧・電源'],
    ['gen_1', '発電機 1', 'kVA', 0, 120, 1, '油圧・電源'],
    ['gen_2', '発電機 2', 'kVA', 0, 120, 1, '油圧・電源'],
    ['apu_gen', 'APU 発電機', 'kVA', 0, 120, 1, '油圧・電源'],
    ['aoa_1', '迎角センサ 1', '°', -5, 20, .1, 'センサ'],
    ['aoa_2', '迎角センサ 2', '°', -5, 20, .1, 'センサ'],
    ['aoa_3', '迎角センサ 3', '°', -5, 20, .1, 'センサ'],
    ['wind_dir', '風向', '°', 0, 359, 1, '気象'],
    ['wind_spd', '風速', 'kt', 0, 150, 1, '気象'],
    ['xwind', '着陸滑走路の横風', 'kt', 0, 50, 1, '気象'],
    ['wx_dist', '前方の積乱雲 距離', 'km', 0, 400, 1, '気象'],
    ['wx_brg', '積乱雲 相対方位', '°', -90, 90, 1, '気象'],
    ['wx_level', '積乱雲 強度', '0-3', 0, 3, 1, '気象'],
    ['cab_alt', '客室高度', 'ft', 0, 20000, 100, '与圧'],
    ['ai_latency', 'AI 応答遅延', 'ms', 0, 500, 1, 'AI']
  ].map(([id, label, unit, min, max, step, group]) => ({ id, label, unit, min, max, step, group }));
  const SENSOR_IDS = new Set(SD.SENSORS.map(s => s.id));

  SD.SPEAKERS = {
    narr: { label: 'ナレーター', color: '#8796a8', lane: null, voice: { pitch: 1, rate: 1, index: 0 } },
    capt: { label: '機長', color: '#e9eef4', lane: 'pilot', voice: { pitch: .72, rate: .95, index: 1 } },
    fo: { label: '副操縦士', color: '#e9eef4', lane: 'pilot', voice: { pitch: 1.15, rate: 1.05, index: 2 } },
    ai: { label: 'AI', color: '#45cdea', lane: 'ai', voice: { pitch: 1.35, rate: .95, index: 3 } },
    atc: { label: '管制', color: '#e061d2', lane: 'atc', radio: true, voice: { pitch: .9, rate: 1.2, index: 1 } },
    sys: { label: '機体システム', color: '#48dd8a', lane: 'sys', silent: true }
  };

  // ---------------------------------------------------------------- keyframes
  function interpKeys(keys, t, wrap, step) {
    if (!keys.length) return undefined;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i], [t0, v0] = keys[i - 1];
      if (t < t1) {
        if (step || typeof v0 !== 'number' || typeof v1 !== 'number' || v0 === null || v1 === null) return v0;
        const u = t1 === t0 ? 1 : ease((t - t0) / (t1 - t0));
        if (wrap) { let d = ((v1 - v0) % wrap + wrap * 1.5) % wrap - wrap / 2; return ((v0 + d * u) % wrap + wrap) % wrap; }
        return v0 + (v1 - v0) * u;
      }
    }
    return keys[keys.length - 1][1];
  }
  const stepAt = (keys, t) => { if (!keys || !keys.length) return undefined; let r = keys[0][1]; for (const k of keys) { if (t >= k[0]) r = k[1]; else break; } return r; };
  SD.stepAt = stepAt;

  const sortKeys = k => k.slice().sort((a, b) => a[0] - b[0]);

  // ---------------------------------------------------------------- validation + normalisation
  SD.load = function (raw) {
    const errors = [], warnings = [];
    const s = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (e) { errors.push('JSONとして読めません：' + e.message); return null; } })() : raw;
    if (!s) return { errors, warnings };
    if (typeof s !== 'object' || Array.isArray(s)) { errors.push('シナリオはJSONオブジェクトである必要があります'); return { errors, warnings }; }
    if (s.format && s.format !== FORMAT) warnings.push(`format が "${s.format}" です（このプレイヤーは ${FORMAT} 用）`);
    const meta = s.meta || {};
    if (!meta.title) errors.push('meta.title がありません');
    const duration = +meta.duration;
    if (!(duration > 0)) errors.push('meta.duration（秒）が正しくありません');
    const isKeys = k => Array.isArray(k) && k.every(p => Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number');

    // sensors
    const sensors = {};
    for (const [id, v] of Object.entries(s.sensors || {})) {
      if (!SENSOR_IDS.has(id)) warnings.push(`sensors.${id} は表示に使われないセンサー名です`);
      if (typeof v === 'number') sensors[id] = { keys: [[0, v]] };
      else if (isKeys(v)) sensors[id] = { keys: sortKeys(v) };
      else if (v && typeof v === 'object' && v.base) {
        if (!s.sensors[v.base]) errors.push(`sensors.${id}.base が指す "${v.base}" がありません`);
        sensors[id] = { base: v.base, add: isKeys(v.add) ? sortKeys(v.add) : [[0, +v.add || 0]], scale: isKeys(v.scale) ? sortKeys(v.scale) : null };
      } else errors.push(`sensors.${id} の形式が違います（[[秒, 値], …] か数値か {base, add}）`);
    }
    const states = {};
    for (const [id, v] of Object.entries(s.states || {})) {
      if (isKeys(v)) states[id] = sortKeys(v); else if (v !== null && typeof v !== 'object') states[id] = [[0, v]]; else errors.push(`states.${id} の形式が違います（[[秒, 値], …]）`);
    }
    const nodes = {};
    for (const [id, v] of Object.entries(s.nodes || {})) { if (isKeys(v)) nodes[id] = sortKeys(v); else errors.push(`nodes.${id} の形式が違います`); }

    const scenes = (s.scenes || []).map((x, i) => {
      if (typeof x.t !== 'number') errors.push(`scenes[${i}].t がありません`);
      return { t: x.t, name: x.name || `シーン${i + 1}`, phase: x.phase || '', focus: x.focus || null };
    }).sort((a, b) => a.t - b.t);
    if (!scenes.length) errors.push('scenes が1つもありません');
    scenes.forEach((x, i) => { x.end = i + 1 < scenes.length ? scenes[i + 1].t : duration; });

    const STEP = ['detect', 'propose', 'decide', 'apply'];
    const incidents = (s.incidents || []).map((x, i) => {
      const st = x.steps || {};
      const steps = STEP.map(k => +(st[k] ?? (k === 'decide' ? st.approve : undefined)));
      if (steps.some(v => !(v >= 0))) errors.push(`incidents[${i}].steps に detect / propose / decide / apply の秒数が必要です`);
      for (let j = 1; j < 4; j++) if (steps[j] < steps[j - 1]) warnings.push(`incidents[${i}] の steps が時刻順になっていません`);
      const p = x.proposal || {};
      return {
        id: x.id || 'inc' + (i + 1), label: x.label || '①②③④⑤⑥⑦⑧⑨'[i] || String(i + 1), title: x.title || '', steps,
        t: steps[0], decision: x.decision === 'reject' ? 'reject' : 'approve', chart: x.chart !== false,
        systems: x.systems || [],
        proposal: { title: p.title || x.title || '', line: p.line || '', src: p.src || '', conf: +p.conf || 0, memo: p.memo || '', targets: p.targets || {}, rejectNote: p.rejectNote || '' }
      };
    }).sort((a, b) => a.t - b.t);

    const speakers = Object.assign({}, SD.SPEAKERS);
    for (const [k, v] of Object.entries(s.speakers || {})) speakers[k] = Object.assign({ label: k, color: '#e9eef4', lane: null, voice: { pitch: 1, rate: 1, index: 0 } }, SD.SPEAKERS[k] || {}, v);
    const dialogue = (s.dialogue || []).map((d, i) => {
      if (typeof d.t !== 'number' || !d.text) errors.push(`dialogue[${i}] に t と text が必要です`);
      if (d.who && !speakers[d.who]) warnings.push(`dialogue[${i}].who "${d.who}" は speakers にありません`);
      return { t: d.t, who: speakers[d.who] ? d.who : 'narr', text: d.text || '', radio: d.radio ?? !!(speakers[d.who] || {}).radio, chime: !!d.chime, label: d.label };
    }).sort((a, b) => a.t - b.t);

    let events = (s.events || []).map(e => Array.isArray(e) ? { t: e[0], who: e[1], text: e[2] } : e).sort((a, b) => a.t - b.t);
    if (!events.length) events = dialogue.filter(d => speakers[d.who].lane).map(d => ({ t: d.t, who: speakers[d.who].lane, text: d.text }));
    if (!events.length || events[0].t > 0) events.unshift({ t: 0, who: 'sys', text: '準備完了' });

    if (errors.length) return { errors, warnings };
    const scn = {
      raw: s, meta: Object.assign({ flight: '', from: {}, to: {}, subtitle: '' }, meta, { duration }),
      sensors, states, nodes, scenes, incidents, dialogue, events, speakers,
      limits: Object.assign({}, SD.DEFAULT_LIMITS, s.limits || {}),
      planned: s.planned && isKeys(s.planned.alt) ? sortKeys(s.planned.alt) : null,
      chart: Object.assign({ markers: [], weather: [] }, s.chart || {}),
      alertNotes: s.alertNotes || {},
      aiIdle: Object.assign({ title: '自己診断 完了', line: '全システム正常 ・ 提案なし', src: '待機中：全データを監視しています' }, s.aiIdle || {})
    };
    const altKeys = sensors.alt ? sensors.alt.keys : [[0, 0]];
    scn.maxAlt = Math.max(10000, ...altKeys.map(k => k[1]), ...(scn.planned || []).map(k => k[1]));
    precomputeAlerts(scn);
    return { scn, errors, warnings };
  };

  // ---------------------------------------------------------------- sampling
  function raw(scn, id, t) {
    const c = scn.sensors[id];
    if (!c) return undefined;
    if (c.keys) return interpKeys(c.keys, t, WRAP[id]);
    const b = raw(scn, c.base, t);
    return (b ?? 0) * (c.scale ? interpKeys(c.scale, t) : 1) + interpKeys(c.add, t);
  }
  SD.raw = raw;

  SD.sample = function (scn, t, ov) {
    ov = ov || {};
    const has = id => ov[id] != null || scn.sensors[id] != null;
    const g = id => ov[id] != null ? ov[id] : raw(scn, id, t);
    const v = {};
    for (const s of SD.SENSORS) { const x = g(s.id); if (x != null) v[s.id] = x; }
    const altAt = tt => raw(scn, 'alt', tt) || 0;
    v.alt = v.alt ?? 0;
    const air = v.alt > 30;
    v.ias = v.ias ?? 0;
    if (v.gs == null) v.gs = v.ias * (1 + v.alt / 1000 * .02);
    v.tas = Math.round(v.ias * (1 + v.alt / 1000 * .02));
    v.mach = v.tas / (661 - Math.min(v.alt, 36000) / 1000 * 2.4);
    if (v.vs == null) { const d = (altAt(t + .5) - altAt(t - .5)); v.vs = clamp(d * 60 / 6, -4000, 4000); if (ov.alt != null) v.vs = 0; }
    if (v.hdg == null) v.hdg = 0;
    if (v.pitch == null) v.pitch = air ? clamp(2.5 + v.vs / 1000 * 2.2, -6, 16) : (v.ias > 120 && altAt(t + 2) > 20 ? 7 : 0);
    if (v.roll == null) {
      if (!air) v.roll = 0;
      else { const h0 = raw(scn, 'hdg', t - .5) ?? 0, h1 = raw(scn, 'hdg', t + .5) ?? 0; const d = ((h1 - h0) % 360 + 540) % 360 - 180; v.roll = clamp(d * 1.6, -25, 25); }
    }
    for (const n of [1, 2]) {
      if (v['n1_' + n] == null) v['n1_' + n] = 20;
      if (v['n2_' + n] == null) v['n2_' + n] = 60 + v['n1_' + n] * .4;
      if (v['egt_' + n] == null) v['egt_' + n] = 380 + v['n1_' + n] * 3.6;
      if (v['ff_' + n] == null) v['ff_' + n] = 250 + v['n1_' + n] * 28;
      if (v['gen_' + n] == null) v['gen_' + n] = v['n2_' + n] > scn.limits.n2Min ? 90 : 0;
    }
    for (const n of [1, 2, 3]) if (v['hyd_' + n] == null) v['hyd_' + n] = 3000;
    if (v.apu_gen == null) v.apu_gen = 0;
    if (!has('fuel_l') && !has('fuel_r')) { v.fuel_l = v.fuel_l ?? 12000; v.fuel_r = v.fuel_r ?? 12000; }
    v.fuel_l = v.fuel_l ?? 0; v.fuel_r = v.fuel_r ?? 0; v.fuel_c = v.fuel_c ?? 0;
    v.fob = v.fuel_l + v.fuel_r + v.fuel_c;
    const aoaBase = air ? clamp(2.4 + (v.ias < 230 ? (230 - v.ias) / 22 : 0), 0, 14) : 0;
    for (const n of [1, 2, 3]) if (v['aoa_' + n] == null) v['aoa_' + n] = aoaBase;
    v.wind_dir = v.wind_dir ?? 0; v.wind_spd = v.wind_spd ?? 0; v.xwind = v.xwind ?? 0;
    v.wx_dist = v.wx_dist ?? 999; v.wx_brg = v.wx_brg ?? 0; v.wx_level = Math.round(v.wx_level ?? 0);
    if (v.wx_brg > 180) v.wx_brg -= 360;
    v.ai_latency = v.ai_latency ?? 38;
    if (v.cab_alt == null) v.cab_alt = Math.min(8000, v.alt * .22);

    // discrete states
    const st = id => ov['$' + id] != null ? ov['$' + id] : stepAt(scn.states[id], t);
    const d = {
      authority: st('authority') || 'manual',
      fcu_alt: st('fcu_alt'), fcu_spd: st('fcu_spd'), fcu_hdg: st('fcu_hdg'), fcu_vs: st('fcu_vs'),
      thr_lim_1: st('thrust_limit_1'), thr_lim_2: st('thrust_limit_2'),
      apu: st('apu') || (v.apu_gen > 5 ? 'on' : 'off'),
      eta: st('eta') || 0, datalink: st('datalink') || 'ok', nav_wpt: st('nav_wpt') || '',
      fma_spd: st('fma_spd'), fma_vert: st('fma_vert'), fma_lat: st('fma_lat'), ap: st('ap'),
      seatbelt: st('seatbelt'), memo: st('memo'), tcas: st('tcas') || 'clear', windshear: !!st('windshear')
    };
    if (d.ap == null) d.ap = air && v.alt > 1500 && d.authority !== 'manual' ? 'AP1' : '';
    if (!d.fma_vert) d.fma_vert = !air ? (v.ias > 40 ? 'SRS' : '') : v.vs > 400 ? 'CLB' : v.vs < -400 ? (v.alt < 3000 ? 'G/S' : 'DES') : 'ALT CRZ';
    if (!d.fma_spd) d.fma_spd = !air ? (v.ias > 40 ? 'MAN TOGA' : '') : v.vs > 400 ? 'THR CLB' : v.vs < -400 ? 'THR IDLE' : 'SPEED';
    if (!d.fma_lat) d.fma_lat = !air ? (v.ias > 40 ? 'RWY' : '') : v.alt < 3000 && v.vs < -300 ? 'LOC' : 'NAV';
    return { t, v, d, air };
  };

  // ---------------------------------------------------------------- health + alerts
  // 24 monitored nodes. Each maps to a status: ok | caution | fail | isolated | off
  SD.NODES = ['fadec_1', 'fadec_2', 'fcc_1', 'fcc_2', 'fcc_3', 'adc_1', 'adc_2', 'adc_3', 'hyd_1', 'hyd_2', 'hyd_3', 'gen_1', 'gen_2', 'apu',
    'afdx_a', 'afdx_b', 'sw_fwd', 'sw_mid', 'sw_aft', 'irs_1', 'irs_2', 'irs_3', 'gnss', 'satcom'];

  SD.health = function (scn, smp) {
    const { v, d, air } = smp, L = scn.limits, st = {}, alerts = [];
    SD.NODES.forEach(n => st[n] = 'ok');
    const add = (code, level, title, extra) => alerts.push(Object.assign({ code, level, title }, extra || {}));
    const r0 = x => Math.round(x);
    // engines
    for (const n of [1, 2]) {
      const o = 3 - n, egt = v['egt_' + n], eo = v['egt_' + o];
      if (air && v['n2_' + n] < L.n2Min) { add(`ENG${n}_FAIL`, 'warning', `ENG ${n} FAIL`, { jp: `エンジン${n} 停止`, detail: `N2 ${v['n2_' + n].toFixed(1)}% ・ 片発で飛行中`, sys: [2], eng: n }); st['fadec_' + n] = 'fail'; st['gen_' + n] = 'off'; }
      else if (egt > L.egtMax) { add(`ENG${n}_OVHT`, 'warning', `ENG ${n} EGT OVER LIMIT`, { jp: `エンジン${n} 排気温度 超過`, detail: `EGT ${r0(egt)}°C ・ 上限 ${L.egtMax}°C`, sys: [2], eng: n }); st['fadec_' + n] = 'fail'; }
      else if (egt - eo > L.egtSplit && v['n1_' + n] <= v['n1_' + o] + 1 && v['n2_' + o] > L.n2Min) {
        add(`ENG${n}_EGT`, 'caution', `ENG ${n} EGT TREND`, { jp: `ENG ${n} 排気温度 上昇傾向`, detail: `ENG${o}比 +${r0(egt - eo)}°C ・ 上限まで ${r0(L.egtMax - egt)}°C`, sys: [2], eng: n });
        st['fadec_' + n] = 'caution';
      }
      if (d['thr_lim_' + n]) { if (st['fadec_' + n] === 'ok') st['fadec_' + n] = 'caution'; }
    }
    // AOA voting
    const aoa = [v.aoa_1, v.aoa_2, v.aoa_3], med = aoa.slice().sort((a, b) => a - b)[1];
    aoa.forEach((a, i) => {
      if (Math.abs(a - med) > L.aoaDisagree) {
        st['adc_' + (i + 1)] = 'fail'; st['fcc_' + (i + 1)] = 'isolated';
        add(`FCC${i + 1}_AOA`, 'caution', `FCC ${i + 1} AOA DISAGREE`, { jp: `FCC-${i + 1} 迎角センサ不一致`, detail: `${a.toFixed(1)}° / 他2系統 ${med.toFixed(1)}° ・ 投票から自動除外`, actions: [`· FCC ${i + 1} .... VOTED OUT`], sys: [4, 10] });
      }
    });
    // hydraulics
    for (const n of [1, 2, 3]) {
      const p = v['hyd_' + n];
      if (p < L.hydFail) { st['hyd_' + n] = 'fail'; add(`HYD${n}_FAIL`, 'caution', `HYD ${n} SYS FAIL`, { jp: `油圧 ${n}系統 喪失`, detail: `${r0(p)} psi ・ 残り系統で操縦可能`, actions: ['· LDG DIST ....... +18%'], sys: [1, 6] }); }
      else if (p < L.hydLow) { st['hyd_' + n] = 'caution'; add(`HYD${n}_LO`, 'caution', `HYD ${n} LO PR`, { jp: `油圧 ${n}系統 圧力低下`, detail: `${r0(p)} psi（正常 3000）・ 低下中`, sys: [1, 6] }); }
    }
    // electrics
    for (const n of [1, 2]) if (v['gen_' + n] < L.genMin && v['n2_' + n] > L.n2Min) { st['gen_' + n] = 'fail'; add(`GEN${n}_FAULT`, 'caution', `ELEC GEN ${n} FAULT`, { jp: `発電機 ${n} 故障`, detail: `出力 ${r0(v['gen_' + n])} kVA ・ 残りの発電機で給電中`, actions: d.apu === 'off' ? ['· APU ........... START'] : [], sys: [1] }); }
    if (d.apu === 'fail') st.apu = 'fail'; else if (d.apu === 'off') st.apu = 'off';
    // fuel
    const imb = v.fuel_l - v.fuel_r;
    if (Math.abs(imb) > L.fuelImbalance) add('FUEL_IMBAL', 'caution', 'FUEL IMBALANCE', { jp: '燃料の左右不均衡', detail: `左 ${(v.fuel_l / 1000).toFixed(1)} t ／ 右 ${(v.fuel_r / 1000).toFixed(1)} t ・ 差 ${(Math.abs(imb) / 1000).toFixed(1)} t`, actions: ['· FUEL X FEED ...... OPEN'], sys: [7] });
    if (v.fob < L.fuelLow) add('FUEL_LOW', 'warning', 'FUEL LO LEVEL', { jp: '燃料残量 低下', detail: `残り ${(v.fob / 1000).toFixed(1)} t`, sys: [7] });
    // weather / landing
    if (v.xwind > L.xwind) add('XWIND', 'caution', `LDG XWIND ${r0(v.xwind)}KT`, { jp: `着陸滑走路の横風 ${r0(v.xwind)}kt`, detail: `制限 ${L.xwind}kt を超過 ・ 滑走路の変更を検討`, sys: [10] });
    if (v.wx_level >= L.wxLevel && v.wx_dist < L.wxDist && Math.abs(v.wx_brg) < 45) add('WX_AHEAD', 'caution', `WX AHEAD ${r0(v.wx_dist)}KM`, { jp: `前方 ${r0(v.wx_dist)}km に積乱雲`, detail: `強度 ${v.wx_level}/3 ・ 相対方位 ${r0(v.wx_brg)}°`, sys: [10] });
    if (v.cab_alt > L.cabAlt) add('CAB_PR', 'warning', 'CAB PR EXCESS CAB ALT', { jp: '客室高度 異常上昇', detail: `客室高度 ${r0(v.cab_alt / 100) * 100} ft ・ 酸素マスク展開 ・ 降下が必要`, sys: [5] });
    if (d.tcas === 'ra_climb' || d.tcas === 'ra_descend') add('TCAS_RA', 'warning', `TCAS RA ${d.tcas === 'ra_climb' ? 'CLIMB' : 'DESCEND'}`, { jp: `TCAS 回避指示：${d.tcas === 'ra_climb' ? '上昇' : '降下'}`, detail: '接近機あり ・ 指示に従って操縦', sys: [5, 10] });
    else if (d.tcas === 'ta') add('TCAS_TA', 'advisory', 'TCAS TRAFFIC', { jp: 'TCAS 接近機の注意', detail: '周辺の機体が接近中 ・ 目視で確認', sys: [10] });
    if (d.windshear) add('WINDSHEAR', 'warning', 'WINDSHEAR', { jp: 'ウィンドシア', detail: '風が急変 ・ 着陸復行（ゴーアラウンド）', sys: [10] });
    if (d.datalink !== 'ok') { st.satcom = 'fail'; add('DATALINK', 'advisory', 'DATALINK LOST', { jp: 'データリンク 断', detail: '地上との通信が途切れています', sys: [9] }); }
    // scenario node overrides
    for (const [n, keys] of Object.entries(scn.nodes)) { const x = stepAt(keys, smp.t); if (x) st[n] = x; }
    // notes from the scenario replace the default texts
    alerts.forEach(a => { const n = scn.alertNotes[a.code]; if (n) { if (n.jp) a.jp = n.jp; if (n.detail) a.detail = n.detail; if (n.actions) a.actions = n.actions; } });
    const order = { warning: 0, caution: 1, advisory: 2 };
    alerts.sort((a, b) => order[a.level] - order[b.level]);
    const ok = SD.NODES.filter(n => st[n] === 'ok' || st[n] === 'off').length;
    const fccOk = [1, 2, 3].filter(i => st['fcc_' + i] === 'ok').length;
    return { nodes: st, alerts, ok, total: SD.NODES.length, fccOk };
  };

  function precomputeAlerts(scn) {
    const on = {}; scn.onsets = {};
    for (let t = 0; t <= scn.meta.duration; t += .5) {
      const h = SD.health(scn, SD.sample(scn, t));
      const now = new Set(h.alerts.map(a => a.code));
      now.forEach(c => { if (!(c in on)) { on[c] = t; (scn.onsets[c] = scn.onsets[c] || []).push([t, Infinity]); } });
      Object.keys(on).forEach(c => { if (!now.has(c)) { const l = scn.onsets[c]; l[l.length - 1][1] = t; delete on[c]; } });
    }
  }
  SD.onset = (scn, code, t) => { const l = scn.onsets[code] || []; for (const [a, b] of l) if (t >= a && t < b) return a; return t; };

  // ---------------------------------------------------------------- timeline helpers
  SD.sceneAt = (scn, t) => { let i = 0; scn.scenes.forEach((s, k) => { if (t >= s.t) i = k; }); return i; };
  SD.incidentStage = (inc, t) => inc.steps.filter(s => t >= s).length; // 0..4
  SD.pendingProposal = (scn, t) => scn.incidents.find(i => t >= i.steps[1] && t < i.steps[2]);
  SD.lastProposal = (scn, t) => scn.incidents.filter(i => t >= i.steps[2]).pop();
  SD.lastAt = (list, t) => { let r = list[0]; for (const e of list) if (t >= e.t) r = e; return r; };
  SD.fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  SD.fmtAlt = a => a >= 18000 ? 'FL' + String(Math.round(a / 100)).padStart(3, '0') : Math.round(a / 10) * 10 + ' ft';
})();
