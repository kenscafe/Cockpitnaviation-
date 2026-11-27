/* Captions + speech. Lines come from scenario.dialogue; voices from scenario.speakers.
   With voice on, the clock waits for a line to finish before the next one starts.
   Engines: 'file' plays the pre-rendered clip in dialogue[].audio (voice/…, made by tools/voice_render.py)
   and falls back to Claude / browser speech for lines without one. */
(function () {
  const SD = window.SkyDemo;
  const $ = id => document.getElementById(id);
  const btn = $('voiceBtn'), sel = $('voiceEngine'), stat = $('voiceStat'), cap = document.querySelector('.caption');
  const capWho = $('capWho'), capTxt = $('capTxt');
  const CL = { narr: ['buttery', 1], capt: ['rounded', .95], fo: ['airy', 1.05], ai: ['glassy', .98], atc: ['airy', 1.15] };
  let scn = null, on = false, tts = null, cur = -1, speaking = false, held = false, token = 0;
  const app = () => SD.App;

  // ---------- radio + chime (Web Audio)
  let ac = null, hiss = null, nbuf = null;
  const audio = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); return ac; };
  const noise = () => { if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = ac.createBufferSource(); s.buffer = nbuf; return s; };
  const band = (f, q) => { const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; };
  function burst(dur, vol) { if (!audio()) return; const s = noise(), b = band(1700, .8), g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(b).connect(g).connect(ac.destination); s.start(t); s.stop(t + dur + .05); }
  function click() { if (!audio()) return; const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = 'square'; o.frequency.value = 2400; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .03); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .05); }
  function startHiss() { if (!audio() || hiss) return; const s = noise(), b = band(2200, .6), g = ac.createGain(); s.loop = true; g.gain.value = .018; s.connect(b).connect(g).connect(ac.destination); s.start(); hiss = { s, g }; }
  function stopHiss() { if (hiss) { try { hiss.g.gain.setTargetAtTime(0, ac.currentTime, .03); hiss.s.stop(ac.currentTime + .15); } catch (e) {} hiss = null; } }
  function chime() { if (!audio()) return; const t = ac.currentTime; [880, 1320].forEach(f => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + 1.2); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1.3); }); }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- speech engines
  // Browser voices: rank the Japanese voices (neural / online ones first) and give each speaker
  // the best voice of its gender, a different one per speaker where the device has enough.
  let jaVoices = [], assign = {};
  const FEMALE = /nanami|ayumi|haruka|mayu|shiori|aoi|kyoko|o-?ren|mizuki|sayaka|female|女性|google 日本語/i;
  const MALE = /keita|ichiro|daichi|naoki|otoya|hattori|takumi|\bmale|男性/i;
  const vGender = v => FEMALE.test(v.name) ? 'f' : MALE.test(v.name) ? 'm' : '';
  const vScore = v => (/natural|neural|online|premium|enhanced|siri/i.test(v.name) ? 40 : 0) + (/google/i.test(v.name) ? 20 : 0) + (/microsoft/i.test(v.name) ? 10 : 0) + (v.default ? 2 : 0);
  const loadVoices = () => { try { jaVoices = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang)).sort((a, b) => vScore(b) - vScore(a)); assign = {}; } catch (e) {} };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  const ORDER = ['ai', 'capt', 'fo', 'narr', 'atc', 'cabin', 'gpws'];
  function voiceFor(who) {
    if (!jaVoices.length) return null;
    if (!assign._done) {
      const used = new Map();
      const ids = Object.keys(scn.speakers).filter(k => !scn.speakers[k].silent).sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99);
      for (const k of ids) {
        const g = ((scn.speakers[k].voice || {}).gender || '').toLowerCase();
        const fit = jaVoices.filter(v => !g || !vGender(v) || vGender(v) === g);
        const pool = fit.length ? fit : jaVoices;
        const v = pool.find(x => !used.has(x)) || pool[0];
        used.set(v, (used.get(v) || 0) + 1);
        assign[k] = { v, shared: used.get(v) > 1, mismatch: !!g && !!vGender(v) && vGender(v) !== g, g };
      }
      assign._done = true;
    }
    return assign[who] || { v: jaVoices[0] };
  }
  function sayBrowser(c) {
    return new Promise(res => {
      const vc = (scn.speakers[c.who] || {}).voice || {};
      const a = voiceFor(c.who);
      let pitch = vc.pitch ?? 1;
      if (a && (a.mismatch || a.shared)) pitch *= a.g === 'm' ? .82 : a.g === 'f' ? 1.2 : 1;   // same voice twice: keep speakers apart
      const u = new SpeechSynthesisUtterance(c.text); u.lang = 'ja-JP'; u.pitch = Math.max(0, Math.min(2, pitch)); u.rate = vc.rate ?? 1;
      if (a) u.voice = a.v;
      const done = () => { clearTimeout(tm); res(); };
      const tm = setTimeout(done, c.text.length * 280 + 4000);
      u.onend = done; u.onerror = done; speechSynthesis.speak(u);
    });
  }
  function sayClaude(c) {
    const vc = (scn.speakers[c.who] || {}).voice || {};
    const [voice, rate] = CL[c.who] || [vc.claude || 'buttery', vc.rate || 1];
    return tts.speak(c.text, { voice, rate, language: 'ja' }).catch(e => {
      const code = e && e.code;
      if (code === 'not_granted' || code === 'unavailable') turnOff(code === 'not_granted' ? '読み上げがこのページでオフになっています' : 'いまは読み上げを使えません');
      else if (code === 'no_gesture') turnOff('もう一度「音声 オン」を押してください');
      else if (code === 'rate_limited') turnOff('読み上げの上限に達しました。少し待ってから再開してください');
    });
  }
  let clip = null;
  function sayFile(c) {
    return new Promise(res => {
      const el = new Audio(c.audio); clip = el;
      const done = ok => { clearTimeout(tm); if (clip === el) clip = null; res(ok); };
      const tm = setTimeout(() => done(true), 30000);
      el.onended = () => done(true); el.onerror = () => done(false);
      el.play().catch(() => done(false));
    });
  }
  const fallback = c => (tts && !optC.disabled ? sayClaude(c) : sayBrowser(c));
  async function speakLine(i, my) {
    const c = scn.dialogue[i];
    if (!c || (scn.speakers[c.who] || {}).silent) return;
    if (c.chime) { chime(); await wait(900); }
    if (c.radio) { click(); burst(.14, .16); await wait(180); if (my !== token) return; startHiss(); }
    try {
      if (sel.value === 'file' && c.audio && await sayFile(c)) {}
      else if (my === token) await (sel.value === 'claude' && tts ? sayClaude(c) : sel.value === 'browser' ? sayBrowser(c) : fallback(c));
    }
    finally { if (c.radio) { stopHiss(); burst(.22, .14); click(); } }
    await wait(250);
  }

  function show(i) {
    const c = scn.dialogue[i];
    if (!c) { capTxt.textContent = ''; capWho.textContent = ''; capWho.style.color = ''; return; }
    const sp = scn.speakers[c.who] || {};
    capTxt.textContent = c.text; capWho.textContent = c.label || sp.label || c.who; capWho.className = 'spk'; capWho.style.color = sp.color || '';
  }
  function say(i) {
    const my = ++token; speaking = true; cap.classList.add('live');
    speakLine(i, my).catch(() => {}).finally(() => {
      if (my !== token) return;
      speaking = false; cap.classList.remove('live');
      if (held) { held = false; app().play(); }
    });
  }
  function stopSpeech() {
    token++; speaking = false; cap.classList.remove('live'); stopHiss();
    if (clip) { try { clip.pause(); } catch (e) {} clip = null; }
    if (tts && sel.value === 'claude') tts.stop().catch(() => {});
    try { speechSynthesis.cancel(); } catch (e) {}
  }
  const idxAt = t => { let r = -1; scn.dialogue.forEach((d, i) => { if (t >= d.t) r = i; }); return r; };

  function update(t) {
    const idx = idxAt(t);
    if (on) {
      if (idx === cur) return;
      if (idx === cur + 1 && speaking) { if (!held) { held = true; app().pause(true); } return; }
      if (idx !== cur + 1) { stopSpeech(); if (held) { held = false; app().play(); } }
      cur = idx; show(idx); if (idx >= 0) say(idx);
      return;
    }
    if (idx !== cur) { cur = idx; show(idx); }
  }
  function setScenario(s) { stopSpeech(); held = false; scn = s; cur = -2; assign = {}; }
  function turnOn() {
    audio();
    on = true; btn.setAttribute('aria-pressed', 'true'); btn.textContent = '音声 オン'; stat.textContent = '1×で再生し、セリフが終わるまで次の場面を待ちます';
    app().setSpeed(1);
    cur = idxAt(app().time()); show(cur); if (cur >= 0) say(cur);
    app().play();
  }
  function turnOff(msg) {
    on = false; btn.setAttribute('aria-pressed', 'false'); btn.textContent = '音声 オフ'; stat.textContent = msg || '';
    stopSpeech(); if (held) { held = false; app().play(); }
  }
  btn.addEventListener('click', () => on ? turnOff() : turnOn());
  sel.addEventListener('change', () => { if (on) { stopSpeech(); if (cur >= 0) say(cur); } });

  const hasBrowser = 'speechSynthesis' in window;
  const optC = sel.querySelector('[value="claude"]'), optB = sel.querySelector('[value="browser"]');
  optC.disabled = true; optB.disabled = !hasBrowser;
  sel.value = 'file';
  if (window.claude && window.claude.use) {
    window.claude.use('tts').then(t => {
      if (!t) return;
      tts = t; optC.disabled = false;
      tts.onState(({ state, reason }) => { if (state === 'idle' && reason === 'viewer_stopped' && on) turnOff('読み上げを止めました'); });
    }).catch(() => {});
  }

  SD.Voice = { update, setScenario, isOn: () => on, stop: () => { if (on) turnOff(); } };
})();
