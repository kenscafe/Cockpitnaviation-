/* 日本語 / English.
   - SD.lang: 'ja' | 'en'. URL ?lang=en > localStorage 'cockpitDemo.lang'（紹介ページと共通）> 'ja'
   - SD.L(ja, en): コードの中の文言を言語で選ぶ
   - SD.t(text): 画面に出す直前の文言を英語にする（シナリオの i18n.en → 下の UI 辞書の順に完全一致で探す。無ければそのまま）
   - SD.localize(raw): シナリオ JSON の文字列を raw.i18n.en の対訳で置き換えた写しを返す（英語のときだけ）
   - 静的な HTML の文言は、読み込み時と切り替え時に辞書で置き換える（元の日本語は覚えておき、戻すときに使う） */
(function () {
  const SD = window.SkyDemo = window.SkyDemo || {};
  const KEY = 'cockpitDemo.lang';
  const JA = /[぀-ヿ㐀-鿿]/;
  let lang = 'ja';
  try { const q = new URL(location.href).searchParams.get('lang'); if (q === 'en' || q === 'ja') lang = q; else { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'ja') lang = s; } } catch (e) {}
  SD.lang = lang;
  SD.L = (ja, en) => SD.lang === 'en' ? en : ja;

  // ---------- UI 辞書（日本語 → English）
  const UI = {
    // header / bar
    'コックピット デモプラットフォーム': 'Cockpit Demo Platform',
    'SKY 501 シミュレーションデモ': 'SKY 501 simulation demo',
    'シナリオを選ぶ': 'Choose a scenario',
    'ファイルを開く…': 'Open file…',
    'いま再生中のシナリオをJSONファイルとして保存': 'Save the current scenario as a JSON file',
    'JSONで保存': 'Save JSON',
    'デモ画面の見方を約2分の動画で紹介（別タブで開きます）': 'A 2-minute video tour of the demo screen (opens in a new tab)',
    '説明動画 ▶': 'Tour video ▶',
    '使い方・シナリオの書き方・更新と公開（別タブで開きます）': 'How to use, write scenarios, update and publish (Japanese, opens in a new tab)',
    '使い方 ?': 'Help ?',
    '正常': 'Normal',
    'AIの提案（承認待ち）': 'AI proposal (awaiting approval)',
    '注意': 'Caution',
    '警告': 'Warning',
    '管制': 'ATC',
    'いま注目する画面': 'Display in focus',
    'Space 再生/停止 ・ ← → シーン移動 ・ V 音声 ・ F 全画面 ・ JSONを画面にドロップで読み込み': 'Space play/pause · ← → scene · V voice · F full screen · drop a JSON file to load',
    '同梱シナリオ': 'Built-in scenarios',
    '読み込んだファイル': 'Loaded files',
    '閉じる': 'Close',
    '日本語 / English': '日本語 / English',
    // dashboard
    'コックピット・ダッシュボード': 'Cockpit dashboard',
    'コックピット・ダッシュボードのコンセプト図': 'Cockpit dashboard concept',
    '上段にオートパイロット操作パネル、その下に6面の大型ディスプレイ。左上は姿勢と航法、中央上はエンジンと警告、右上はAIコパイロット、左下は連携タイムライン、中央下は分散システムの接続図、右下は権限モードとシステム健全性。': 'Autopilot control panel on top, six large displays below. Top left: attitude and navigation. Top center: engines and alerts. Top right: AI co-pilot. Bottom left: teamwork timeline. Bottom center: distributed systems mesh. Bottom right: authority mode and system health.',
    'PFD · 主飛行表示': 'PFD · Primary flight',
    'ND · 航法': 'ND · Navigation',
    'EWD · エンジン／警告': 'EWD · Engines / alerts',
    '右席アシスタント': 'Right-seat assistant',
    '信頼度': 'Confidence',
    '承認': 'Approve',
    '却下': 'Reject',
    '承認済': 'Approved',
    '却下済': 'Rejected',
    '注意事項なし ・ 全センサ値は正常範囲': 'No cautions · all sensor values in range',
    '監視中のデータ': 'Data monitored',
    '推論': 'Inference',
    'AI 応答遅延': 'AI latency',
    '機上・オフライン': 'Onboard · offline',
    'AI ディスプレイ': 'AI display',
    '連携タイムライン': 'Teamwork timeline',
    'パイロット': 'Pilots',
    'AIコパイロット': 'AI co-pilot',
    '機体システム': 'Aircraft systems',
    '検知': 'Detect',
    '提案': 'Propose',
    '反映': 'Apply',
    '事象': 'Event',
    '承認待ち': 'Pending',
    '検討中': 'Reviewing',
    '情報の受け渡し': 'Handoff',
    '分散システム連携': 'Distributed systems mesh',
    '表示': 'Display',
    'テレメトリ': 'Telemetry',
    '機長 · 最終権限': 'Captain · final authority',
    '助言 · 監視': 'Advise · monitor',
    '提案 · 警告': 'Propose · alert',
    '承認 · 指示': 'Approve · command',
    'FCC ×3 · 三重冗長': 'FCC ×3 · triple redundant',
    '操縦指令': 'Commands',
    '承認後のみ': 'After approval',
    '承認範囲で実行': 'Acts within approval',
    'A/B 二重化': 'A/B redundant',
    '指令': 'Command',
    'AIの提案': 'AI proposal',
    'データの流れ': 'Data flow',
    '承認ゲート': 'Approval gate',
    '権限モード': 'Authority mode',
    '手動': 'Manual',
    'アシスト': 'Assist',
    '自動': 'Auto',
    'AIは表示のみ': 'AI displays only',
    'AIが提案・人が承認': 'AI proposes, people approve',
    '定型操作をAIが実行': 'AI runs routine actions',
    '監視のみ': 'Monitor only',
    '最終決定権は常にパイロット': 'The pilot always has the final say',
    'AIは提案・監視・実行補助を担当。飛行制御への指令は、': 'AI proposes, monitors and assists. Commands to flight control',
    'パイロットの承認と FCC の多数決を通ったものだけが実行される。': 'run only after pilot approval and an FCC majority vote.',
    'システム健全性': 'System health',
    'データリンク': 'Datalink',
    '注意・警告': 'Cautions · warnings',
    '注意・警告なし': 'No cautions or warnings',
    '除外中': 'Voted out',
    '故障': 'Failed',
    '停止': 'Off',
    'MONITOR · 機上推論': 'MONITOR · onboard inference',
    'ADVISORY · 機上推論': 'ADVISORY · onboard inference',
    'AUTO · 承認範囲で実行': 'AUTO · within approval',
    'FADEC 正常': 'FADEC normal',
    'FADEC ×2 正常': 'FADEC ×2 normal',
    'FADEC 停止': 'FADEC off',
    'EGT 超過': 'EGT over limit',
    'SATCOM 断': 'SATCOM lost',
    '発電機 ×2': 'Generators ×2',
    'TCAS RA 回避中': 'TCAS RA in progress',
    'ウィンドシア検知': 'Windshear detected',
    'TCAS 接近機': 'TCAS traffic',
    '気象レーダー 積乱雲を探知': 'Weather radar: storm detected',
    'センサ 全系統一致': 'Sensors · all agree',
    // layout (system map)
    '機体システム配置図': 'Aircraft system layout',
    '機首を右に向けた機体の上面図。機首にコックピットとアビオニクス室（飛行制御コンピュータ3台、AIモジュール）、胴体を貫くデータバス、主翼にエンジンと燃料タンク、尾部にAPUと昇降舵・方向舵。四隅の説明カードが番号で各機能を指す。': 'Top view of the aircraft, nose to the right. Cockpit and avionics bay in the nose (3 flight control computers, AI module), a data bus along the fuselage, engines and fuel tanks on the wings, APU, elevator and rudder at the tail. Numbered cards in the corners point to each function.',
    '補助翼': 'Aileron',
    'スポイラー': 'Spoiler',
    '昇降舵': 'Elevator',
    '方向舵': 'Rudder',
    '分散システム配置図': 'Distributed system layout',
    'センサー値に応じて各機能の色と状態が変わります': 'Colors and states follow the sensor values',
    'データバス': 'Data bus',
    'ネットワークスイッチ': 'Network switch',
    '翼面の制御ユニット': 'Control surface unit',
    '発電機': 'Gen',
    '油圧ポンプ': 'Hyd pump',
    '電源・油圧・APU': 'Power · hydraulics · APU',
    'エンジン駆動の発電機×2と油圧ポンプ。': 'Two engine-driven generators and pumps.',
    '尾部の APU は地上と非常時の予備電源。': 'The tail APU is backup power.',
    '油圧3系統・3000psi で翼面を動かす。': '3 hydraulic systems at 3000 psi.',
    'エンジンと FADEC': 'Engines and FADEC',
    '各エンジンに専用の制御コンピュータ。': 'Each engine has its own control computer.',
    '推力をデジタル制御し、回転数や温度を': 'It controls thrust digitally and streams',
    '絶えずバスへ送り出す。': 'speed and temperature to the bus.',
    'AI モジュール': 'AI module',
    '全センサのデータを読んで': 'Reads data from all sensors',
    '提案と監視を行う。': 'to propose and monitor.',
    '飛行制御への指令は': 'Commands reach flight control',
    '承認ゲートを通った時だけ。': 'only through the approval gate.',
    '飛行制御 FCC×3': 'Flight control FCC×3',
    '3台が同じ計算をして': 'Three run the same computation',
    '多数決で出力を決める。': 'and a majority vote sets output.',
    '全3系統が一致して': 'All 3 channels agree',
    '正常に制御中。': 'and control is normal.',
    'コックピット': 'Cockpit',
    'パイロット2名と': 'Two pilots and',
    '6面ディスプレイ。': 'six displays.',
    '最終決定権は常に': 'The final say always',
    'パイロットにある。': 'rests with the pilots.',
    '操縦翼面': 'Control surfaces',
    '補助翼・スポイラー・昇降舵・方向舵。': 'Ailerons, spoilers, elevator, rudder.',
    '各アクチュエータのそばに制御ユニット': 'Control units (REU) are placed',
    '（REU）を分散して置く。': 'next to each actuator.',
    '燃料タンク': 'Fuel tanks',
    '主翼と胴体中央のタンク。': 'Wing and center fuselage tanks.',
    '残量と重心を常に計算し、': 'Quantity and CG are always computed',
    'AI の上昇提案の根拠にも使われる。': 'and back the AI climb proposals.',
    'データバス AFDX': 'Data bus AFDX',
    'A/B 二重化の機内': 'A redundant A/B onboard',
    'ネットワーク。前・中・後': 'network. Front, mid and aft',
    'のスイッチで全機能を': 'switches connect',
    'つないでいる。': 'every function.',
    '衛星経由で地上と通信。': 'Talks to the ground via satellite.',
    '整備ログと AI の判断': 'Sends maintenance logs and',
    '記録を地上へ送る。': 'AI decision records down.',
    'GNSS で位置も受信。': 'Also receives GNSS position.',
    'センサ群': 'Sensors',
    'ピトー管・迎角センサ・': 'Pitot tubes, AOA sensors,',
    '慣性基準装置×3・': '3 inertial reference units,',
    '気象レーダー。複数系統': 'weather radar. Channels are',
    'を突き合わせて検証。': 'cross-checked.',
    // caption / voice
    'ナレーター': 'Narrator',
    '機長': 'Captain',
    '副操縦士': 'First officer',
    '客室乗務員': 'Cabin crew',
    '警報音声': 'Alert voice',
    '声': 'Voice',
    '収録音声（同梱）': 'Recorded voice (Japanese only)',
    'Claude音声（claude.ai上のみ）': 'Claude voice (claude.ai only)',
    'ブラウザ音声': 'Browser voice',
    '音声 オフ': 'Voice off',
    '音声 オン': 'Voice on',
    // flight card
    '飛行プロファイル。横軸はデモの経過時間、縦軸は高度。インシデント地点に番号付きの印。': 'Flight profile. Horizontal axis is demo time, vertical axis is altitude. Numbered marks show incidents.',
    'ETA 定刻比': 'ETA vs sched.',
    '±0 分': '±0 min',
    '▶ 再生': '▶ Play',
    '❚❚ 停止': '❚❚ Pause',
    'デモの経過時間': 'Demo time',
    // sensor monitor
    'センサー値モニター': 'Sensor monitor',
    'いまの値と、手で値を変えて表示の変化を確かめる「固定」スイッチ': 'Live values, plus “hold” switches to change a value by hand and watch the displays react',
    '固定をすべて解除': 'Release all holds',
    '「固定」にした値はシナリオより優先されます。例：ENG2 EGT を上げる、油圧2系統を0にする、迎角センサ1つだけをずらす。': 'Held values override the scenario. Try raising ENG2 EGT, setting hydraulic system 2 to 0, or offsetting just one AOA sensor.',
    'シナリオのJSONファイルをここにドロップ': 'Drop a scenario JSON file here',
    '固定': 'Hold',
    '状態': 'State',
    'なし': 'None',
    '断': 'Lost',
    'TA 接近機': 'TA traffic',
    'RA 上昇': 'RA climb',
    'RA 降下': 'RA descend',
    'ウィンドシア': 'Windshear',
    '飛行': 'Flight', 'エンジン': 'Engines', '燃料': 'Fuel', '油圧・電源': 'Hydraulics · power', 'センサ': 'Sensors', '気象': 'Weather', '与圧': 'Pressurization', 'AI': 'AI',
    '高度': 'Altitude', '指示対気速度': 'Indicated airspeed', '対地速度': 'Ground speed', '機首方位': 'Heading', 'ピッチ': 'Pitch', 'ロール': 'Roll', '昇降率': 'Vertical speed',
    'ENG1 燃料流量': 'ENG1 fuel flow', 'ENG2 燃料流量': 'ENG2 fuel flow', '左翼タンク': 'Left wing tank', '右翼タンク': 'Right wing tank', '中央タンク': 'Center tank',
    '油圧 1系統': 'Hydraulic sys 1', '油圧 2系統': 'Hydraulic sys 2', '油圧 3系統': 'Hydraulic sys 3', '発電機 1': 'Generator 1', '発電機 2': 'Generator 2', 'APU 発電機': 'APU generator',
    '迎角センサ 1': 'AOA sensor 1', '迎角センサ 2': 'AOA sensor 2', '迎角センサ 3': 'AOA sensor 3', '風向': 'Wind direction', '風速': 'Wind speed', '着陸滑走路の横風': 'Landing crosswind',
    '前方の積乱雲 距離': 'Storm cell distance ahead', '積乱雲 相対方位': 'Storm cell bearing', '積乱雲 強度': 'Storm cell intensity', '客室高度': 'Cabin altitude',
    // airports (flight card / scenario defaults)
    '羽田': 'Haneda', '新千歳': 'New Chitose', '関西': 'Kansai', '那覇': 'Naha', '伊丹': 'Itami', '福岡': 'Fukuoka', '仙台': 'Sendai'
  };

  // 数字入りなど、完全一致で引けない文言
  const RX = [
    [/^場面：(.+)　・　センサー値に応じて各機能の色と状態が変わります$/, (m, a) => `Scene: ${tr(a)}  ·  colors and states follow the sensor values`],
    [/^(.+) · コックピット デモ$/, (m, a) => `${tr(a)} · Cockpit demo`],
    [/^(\d+) (.+)$/, (m, n, a) => { const x = tr(a); return x === a ? m : `${n} ${x}`; }],
    [/^([①-⑨]) (.+)$/, (m, n, a) => { const x = tr(a); return x === a ? m : `${n} ${x}`; }],
    [/^([A-Z]{4}) (.+?)( · RWY .+)?$/, (m, c, a, r) => { const x = tr(a); return x === a ? m : `${c} ${x}${r || ''}`; }],
    [/^(.+) →$/, (m, a) => { const x = tr(a); return x === a ? m : `${x} →`; }],
    [/^当初計画 (.+)$/, (m, a) => `Planned ${a}`],
    [/^シーン(\d+)$/, (m, n) => `Scene ${n}`]
  ];

  let scnMap = {};
  SD.setScenarioDict = m => { scnMap = m || {}; };
  function tr(s) {
    if (SD.lang !== 'en' || typeof s !== 'string' || !JA.test(s)) return s;
    const k = s.trim();
    const hit = scnMap[k] ?? UI[k];
    if (hit != null) return k === s ? hit : s.replace(k, hit);
    for (const [re, f] of RX) if (re.test(k)) { const r = k.replace(re, f); if (r !== k) return r; }
    return s;
  }
  SD.t = tr;

  SD.localize = raw => {
    const map = raw && raw.i18n && raw.i18n.en;
    if (SD.lang !== 'en' || !map) return raw;
    const walk = o => typeof o === 'string' ? (map[o.trim()] ?? o) : Array.isArray(o) ? o.map(walk) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'i18n' || k === 'audio' ? v : walk(v)])) : o;
    return walk(raw);
  };

  // ---------- 静的な HTML の置き換え
  const origText = new WeakMap(), origAttr = new WeakMap();
  const ATTRS = ['title', 'aria-label', 'placeholder', 'label'];
  function apply(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) {
        const p = n.parentNode; if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) continue;
        const o = origText.get(n);
        if (o && n.nodeValue !== o.out) { origText.delete(n); }
        const ja = origText.has(n) ? origText.get(n).ja : n.nodeValue;
        if (!JA.test(ja)) continue;
        const out = SD.lang === 'en' ? tr(ja) : ja;
        if (out !== n.nodeValue) n.nodeValue = out;
        origText.set(n, { ja, out });
      } else {
        let saved = origAttr.get(n);
        for (const a of ATTRS) {
          const v = n.getAttribute && n.getAttribute(a); if (v == null) continue;
          const ja = saved && saved[a] && saved[a].out === v ? saved[a].ja : v;
          if (!JA.test(ja)) continue;
          const out = SD.lang === 'en' ? tr(ja) : ja;
          if (out !== v) n.setAttribute(a, out);
          if (!saved) origAttr.set(n, saved = {});
          saved[a] = { ja, out };
        }
      }
    }
  }
  SD.applyStatic = () => apply(document.body);
  const hooks = [];
  SD.onLang = f => hooks.push(f);
  SD.setLang = l => {
    if (l !== 'ja' && l !== 'en') return;
    SD.lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    try { const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u); } catch (e) {}
    document.documentElement.lang = l;
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
    const story = document.getElementById('storyLink'); if (story) story.href = 'story/index.html?lang=' + l;
    hooks.forEach(f => { try { f(l); } catch (e) { console.error(e); } });
    apply(document.body);
  };
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lang]'); if (b) SD.setLang(b.dataset.lang); });
})();
