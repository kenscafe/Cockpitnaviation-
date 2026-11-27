# シナリオの書き方（cockpit-demo-scenario/1）

シナリオは1つの JSON ファイルです。時刻はすべて「デモ開始からの秒数」で書きます。
完全な例は `scenarios/01_sky501-hnd-cts.json`、最小の例は `scenarios/09_template.json` です。

```json
{
  "format": "cockpit-demo-scenario/1",
  "meta":      { … },   // 必須：題名と長さ
  "scenes":    [ … ],   // 必須：シーンの区切り
  "sensors":   { … },   // センサー値の時系列（表示はここから決まる）
  "states":    { … },   // 権限モードなど、段階的に切り替わる値
  "incidents": [ … ],   // 検知 → 提案 → 判断 → 反映 の流れ
  "dialogue":  [ … ],   // 字幕と音声
  "events":    [ … ],   // 進行カードと連携タイムラインに出す短い出来事（省略可）
  "speakers":  { … },   // 話者の追加・変更（省略可）
  "limits":    { … },   // 注意・警告のしきい値（省略可）
  "alertNotes":{ … },   // 注意カードの文面の上書き（省略可）
  "planned":   { … },   // 当初の飛行計画（省略可）
  "chart":     { … },   // 進行カードの目印と気象（省略可）
  "aiIdle":    { … }    // 提案がないときの AI 画面の文面（省略可）
}
```

## meta（必須）

| キー | 内容 | 例 |
| --- | --- | --- |
| `id` | 保存時のファイル名に使う | `"sky501-hnd-cts"` |
| `title` | 画面上部とシナリオ一覧に出る題名（必須） | `"SKY 501 羽田 → 新千歳"` |
| `subtitle` | 題名の横の説明。省略すると長さとシーン数を自動で出す | |
| `flight` | 便名 | `"SKY 501"` |
| `from` / `to` | 出発地・到着地。`code`、`name`、`runway` | `{"code": "RJTT", "name": "羽田", "runway": "05"}` |
| `landing` | ダイバートなどで実際に降りた空港（進行カードの着陸地点に表示）。省略すると `to` | `{"code": "RJSS", "name": "仙台", "runway": "27"}` |
| `duration` | デモの長さ（秒、必須） | `300` |
| `description` | メモ（表示しない） | |

## scenes（必須）

```json
{ "t": 65, "name": "上昇中の二重故障", "phase": "上昇", "focus": { "panels": ["dash", "air"], "cards": [2, 3, 4] } }
```

- `t` からそのシーン。次のシーンの `t` まで続きます。← / → キーはシーンの頭へ移動します。
- `focus.panels`：シアンの枠で強調する画面。`"dash"`（ダッシュボード）、`"air"`（配置図）。
- `focus.cards`：配置図で明るく残すカードの番号（1 電源・油圧、2 エンジン、3 AI、4 飛行制御、5 コックピット、6 操縦翼面、7 燃料、8 データバス、9 データリンク、10 センサ群）。
  注意・警告が出ている系統のカードは自動で加わります（止めるときは `"auto": false`）。

## sensors（表示を決める値）

書き方は3通りです。

```json
"alt":   [[0, 0], [56, 0], [66, 1500], [126, 33000]],   // [秒, 値] の並び。間はなめらかに補間
"hyd_1": 3000,                                           // ずっと同じ値
"egt_2": { "base": "egt_1", "add": [[0, 4], [80, 34]] }   // 別のセンサー ＋ 差分（差分も時系列で書ける）
```

`base` を使うと「ENG2 は ENG1 と同じ動きで、80秒から 34°C 高い」のように、異常の部分だけを書けます。

| 名前 | 内容 | 単位 | 省略時 |
| --- | --- | --- | --- |
| `alt` | 高度 | ft | 0 |
| `ias` | 指示対気速度 | kt | 0 |
| `gs` | 対地速度 | kt | 速度と高度から概算 |
| `hdg` | 機首方位（359→0 をまたいでも正しく補間） | ° | 0 |
| `pitch` / `roll` | 姿勢 | ° | 昇降率・旋回率から自動 |
| `vs` | 昇降率 | fpm | 高度の変化から自動 |
| `n1_1` `n1_2` | エンジン N1 | % | 20 |
| `n2_1` `n2_2` | エンジン N2 | % | N1 から概算 |
| `egt_1` `egt_2` | 排気温度 | °C | N1 から概算 |
| `ff_1` `ff_2` | 燃料流量 | kg/h | N1 から概算 |
| `fuel_l` `fuel_r` `fuel_c` | 左翼・右翼・中央タンク | kg | 左右 12,000 |
| `hyd_1` `hyd_2` `hyd_3` | 油圧 | psi | 3000 |
| `gen_1` `gen_2` | 発電機出力 | kVA | エンジン作動中は 90 |
| `apu_gen` | APU 発電機出力 | kVA | 0 |
| `aoa_1` `aoa_2` `aoa_3` | 迎角センサ（3系統で多数決） | ° | 速度から概算（3系統一致） |
| `wind_dir` `wind_spd` | 風向・風速 | °, kt | 0 |
| `xwind` | 着陸予定滑走路の横風成分 | kt | 0 |
| `wx_dist` `wx_brg` `wx_level` | 前方の積乱雲の距離・相対方位（左がマイナス）・強度 0〜3 | km, °, - | なし |
| `cab_alt` | 客室高度（与圧） | ft | 機体高度の22%（最大 8,000） |
| `ai_latency` | AI の応答遅延 | ms | 38 |

## 注意・警告の判定（limits で調整）

| 判定 | 条件 | 既定値 |
| --- | --- | --- |
| `ENGn_EGT` 注意 | もう一方より EGT が `egtSplit` 以上高く、N1 は同じか低い | 25°C |
| `ENGn_OVHT` 警告 | EGT が `egtMax` を超える | 950°C |
| `ENGn_FAIL` 警告 | 飛行中に N2 が `n2Min` 未満 | 50% |
| `FCCn_AOA` 注意 | 迎角センサの1系統が中央値から `aoaDisagree` 以上ずれる → その FCC を多数決から除外 | 2.0° |
| `HYDn_LO` / `HYDn_FAIL` 注意 | 油圧が `hydLow` / `hydFail` 未満 | 2200 / 500 psi |
| `GENn_FAULT` 注意 | エンジン作動中に発電機出力が `genMin` 未満 | 10 kVA |
| `FUEL_IMBAL` 注意 | 左右タンクの差が `fuelImbalance` を超える | 1500 kg |
| `FUEL_LOW` 警告 | 総燃料が `fuelLow` 未満 | 3000 kg |
| `XWIND` 注意 | 横風が `xwind` を超える | 20 kt |
| `WX_AHEAD` 注意 | 強度 `wxLevel` 以上の積乱雲が前方 ±45° 以内、`wxDist` 未満 | 2 / 100 km |
| `CAB_PR` 警告 | 客室高度が `cabAlt` を超える | 9550 ft |
| `TCAS_TA` 情報 / `TCAS_RA` 警告 | `states.tcas` が `"ta"` / `"ra_climb"`・`"ra_descend"`（PFD に TRAFFIC / CLIMB, CLIMB を表示） | |
| `WINDSHEAR` 警告 | `states.windshear` が `true`（PFD に WINDSHEAR を表示） | |
| `DATALINK` 情報 | `states.datalink` が `"lost"` | |

注意カードの文面を変えたいときは `alertNotes` に書きます。

```json
"alertNotes": { "HYD2_LO": { "jp": "油圧2系統 圧力低下", "detail": "毎分約900psiで低下中", "actions": ["· HYD 2 PUMP .... OFF"] } }
```

## states（段階的に切り替わる値）

`[[秒, 値], …]` で書きます。次の時刻まで同じ値が続きます。`null` は「表示しない」です。

| 名前 | 内容 | 値の例 |
| --- | --- | --- |
| `authority` | 権限モード | `"manual"` `"assist"` `"auto"` |
| `fcu_alt` `fcu_spd` `fcu_hdg` `fcu_vs` | オートパイロットの設定値（FCU と PFD の目標表示） | `33000` |
| `thrust_limit_1` `thrust_limit_2` | 推力制限（N1 計器にシアンの線） | `85` |
| `apu` | APU の状態 | `"off"` `"starting"` `"on"` `"fail"` |
| `datalink` | データリンク | `"ok"` `"lost"` |
| `eta` | 定刻比（分） | `4` |
| `nav_wpt` | ND に出す次の地点名 | `"KOVAL"` |
| `tcas` | TCAS の状態 | `"clear"` `"ta"` `"ra_climb"` `"ra_descend"` |
| `windshear` | ウィンドシアの検知 | `true` `false` |
| `fma_spd` `fma_vert` `fma_lat` `ap` | PFD 上部の表示を上書き（省略時は飛行状態から自動） | `"ALT CRZ"` |
| `memo` | EWD のメモ欄に1行追加 | `"SEAT BELTS"` |

`nodes` に `{"satcom": [[0, "ok"], [120, "fail"]]}` のように書くと、24個の監視対象（`fadec_1`、`fcc_2`、`irs_3`、`satcom` など）の状態を直接指定できます。

## incidents（検知 → 提案 → 判断 → 反映）

```json
{
  "id": "eng2-fcc2",
  "title": "ENG2 EGT上昇 · FCC-2切離し",
  "steps": { "detect": 80, "propose": 83, "decide": 98, "apply": 101 },
  "decision": "approve",
  "systems": [2, 3, 4],
  "chart": true,
  "proposal": {
    "title": "ENG2 推力85%制限 ・ FL330へ",
    "line": "到着 +4分 ・ 燃料は十分",
    "src": "根拠：EGT傾向 ／ 類似事例",
    "conf": 0.9,
    "memo": "ENG2 LIM / FL330",
    "targets": { "alt": 33000 },
    "rejectNote": ""
  }
}
```

- `propose` から `decide` までの間、AI 画面に提案カード（シアン）が出て、EWD に「PENDING CREW ACK」、連携タイムラインに「検討中」が出ます。
- `decision` を `"reject"` にすると、判断のステップが「却下」になり、カードには `rejectNote` が出ます。
- `targets` に `alt`（高度）、`spd`（速度）、`hdg`（方位）、`route`（`"left"` / `"right"`）を書くと、承認待ちの間だけ FCU・PFD・ND・垂直表示に「AI案」として重ねて表示します。
- `chart: false` にすると進行カードに印を出しません（整備レポートのような後処理向け）。
- 異常そのもの（EGT 上昇など）は `sensors` に書きます。incidents は人と AI のやりとりだけを表します。

## dialogue（字幕と音声）

```json
{ "t": 80, "who": "ai", "text": "エンジン2の排気温度が上昇傾向です。", "chime": true }
```

| キー | 内容 |
| --- | --- |
| `who` | 話者。`narr` ナレーター、`capt` 機長、`fo` 副操縦士、`ai` AI、`atc` 管制、`sys` 機体システム（字幕のみ） |
| `radio` | 無線の音（カチッ＋ノイズ）を付ける。`atc` は自動で付く |
| `chime` | 読み上げの前にチャイムを鳴らす |
| `audio` | 収録した音声ファイルのパス（省略可）。同梱シナリオでは `tools/bundle.py` が自動で付けます |

音声オンのときは、セリフが終わるまで次のセリフの時刻で時計が止まって待ちます。

### 自然な会話にするコツ

- 1つのセリフは短く、1〜2文にします。長い説明は AI の2つのセリフに分けます。
- 管制の指示には、副操縦士が要点を繰り返して最後に便名を付ける「復唱」を入れます（`"radio": true`）。
- 機長と副操縦士の間には「チェック」「了解」「承認」などの短い返事を入れます。離陸の「80ノット → チェック → V1 → ローテート」のような呼称も、1つずつ別のセリフにします。
- セリフの時刻は詰めて書いてかまいません。音声オンでは前のセリフが終わるまで次を待つので、重なりません。

### 収録音声（声を同梱する）

`python3 tools/voice_render.py` を実行すると、セリフごとの音声を `voice/<meta.id>/` に mp3 で作ります。続けて `python3 tools/bundle.py` を実行すると、同梱シナリオのセリフに `audio` が付き、「声」の選択が「収録音声（同梱）」のとき、その音声を再生します。オフラインでも同じ声で流れます。音声ファイルがないセリフ（読み込んだ JSON など）は、ブラウザの音声で読み上げます。

- セリフを書き換えたら、もう一度 `voice_render.py` を実行します。変わったセリフだけ作り直し、使われなくなったファイルは消えます。
- 既定は Open JTalk（オフライン）です。`--engine google` で Google Cloud Text-to-Speech（環境変数 `GOOGLE_TTS_API_KEY`）を使えます。
- 話者ごとの声は `tools/voice_render.py` の `VOICES` が既定値です。シナリオの `speakers.<id>.voice.render.jtalk` / `.google` で上書きできます。

## speakers（話者の追加）

```json
"speakers": { "cabin": { "label": "客室乗務員", "color": "#c9b6f2", "voice": { "pitch": 1.3, "rate": 1.05, "index": 0 } } }
```

`voice.gender` に `"f"`（女性）か `"m"`（男性）を書くと、ブラウザ音声のとき、その性別の声のうち一番品質の良いもの（Natural / Neural / Online などの名前の声を優先）を話者ごとに別々に割り当てます。`voice.pitch` と `voice.rate` は声の高さと速さで、1 が標準です。`voice.index` は性別が分からない声しかないときの予備です。`lane` に `"pilot"` `"ai"` `"sys"` `"atc"` を書くと、`events` を省略したときにそのレーンへ出来事として並びます。

## events（短い出来事、省略可）

```json
"events": [[80, "sys", "ENG2 EGT 注意域 · FCC-2 を自動除外"], [83, "ai", "AI：推力制限を提案"]]
```

2番目は `sys` `ai` `pilot` `atc` のどれかです。進行カードの下段と、ダッシュボードの連携タイムラインに出ます。省略すると dialogue から自動で作ります。

## planned / chart / aiIdle（省略可）

```json
"planned": { "alt": [[56, 0], [132, 37000], [260, 0]] },
"chart": {
  "markers": [[56, "V1 · ROTATE"], [260, "接地 +10分"]],
  "weather": [{ "t": 150, "alt": 36000, "label": "積乱雲 · 左へ迂回" }]
},
"aiIdle": { "title": "出発前の自己診断　完了", "line": "10機能 正常", "src": "待機中" }
```

## うまく動かないとき

- 読み込み時に、足りない項目や形式の誤りを画面上部に日本語で表示します。
- センサー名の書き間違いは「表示に使われないセンサー名です」と注意が出ます（読み込みは続きます）。
- 画面の「センサー値モニター」で、いまの値と出ている注意・警告を確かめられます。

## 英語の対訳（任意）

画面を English に切り替えたときの文言は、シナリオの最上位に `i18n.en` として「日本語 → 英語」の対訳を書きます。キーはシナリオ内の文字列とまったく同じにします（前後の空白は無視）。対訳が無い文言は日本語のまま表示されます。

```json
"i18n": {
  "en": {
    "SKY 900 羽田 → 福岡": "SKY 900 Haneda → Fukuoka",
    "巡航": "Cruise",
    "エンジン1の排気温度が上がっています。": "Engine 1 exhaust temperature is rising."
  }
}
```
