# コックピット デモプラットフォーム

[![検証して GitHub Pages に公開](https://github.com/kenscafe/Cockpitnaviation-/actions/workflows/pages.yml/badge.svg)](https://github.com/kenscafe/Cockpitnaviation-/actions/workflows/pages.yml)

ソフトウェア制御の旅客機を題材に、コックピットのダッシュボードと、エンジン・飛行制御などの分散システム、AI、パイロットの連携を見せるデモです。
**シナリオ（JSONファイル）を読み込んで再生**します。ダッシュボードの表示は、シナリオに書いたセンサー値から毎フレーム計算されます。

**▶ デモを開く：https://kenscafe.github.io/Cockpitnaviation-/**
（オフライン用の zip：https://kenscafe.github.io/Cockpitnaviation-/cockpit-demo-platform.zip ）

## 起動方法

### Web で見る

1. 上の「デモを開く」のURLをブラウザで開きます。
2. 画面右上の「SCENARIO」からシナリオを選びます。最初は「SKY 501 羽田 → 新千歳」が流れます。
3. 本番では、字幕帯の右にある「音声 オン」を押してください。1倍速に切り替わり、セリフが読み上げられます。声は最初「収録音声（同梱）」で、どのパソコンでも同じ声が流れます。「ブラウザ音声」に切り替えると、そのパソコンに入っている日本語の声のうち品質の良いものを話者ごとに選んで読み上げます。

### オフラインで見る

インターネット接続も、インストールも、サーバーも要りません。

1. 上の zip をダウンロードして展開します（またはこのリポジトリを clone します）。
2. `index.html` をブラウザで開きます（ダブルクリック、またはブラウザにドラッグ）。
3. あとは Web で見るときと同じです。

推奨ブラウザは Google Chrome または Microsoft Edge の最新版です。

## 同梱シナリオ

| シナリオ | 長さ | 内容 |
| --- | --- | --- |
| SKY 501 羽田 → 新千歳 | 5:00 | 元のデモをシナリオ形式に移したもの。滑走路変更、ENG2 の EGT 上昇と FCC-2 の自動切り離し、積乱雲の回避、横風による滑走路変更 |
| SKY 214 関西 → 那覇 | 4:30 | 新しいサンプル。油圧2系統の喪失、燃料の左右不均衡、台風の外縁でのダイバート案を**機長が却下**、降下中の発電機1の故障と APU 始動 |
| SKY 330 伊丹 → 羽田（関西へ着陸） | 3:30 | 離陸直後のバードストライクで ENG1 が停止。片発で関西へ向かい、過重量着陸を判断し、片発で進入する |
| SKY 812 新千歳 → 福岡（仙台へダイバート） | 3:30 | 巡航中に客室の与圧が抜けて緊急降下。仙台へダイバートし、降下中に TCAS の回避指示（上昇）を受ける |
| SKY 605 福岡 → 羽田（ウィンドシアで着陸復行） | 3:40 | 降下中の積乱雲を回避。最終進入でウィンドシアに遭い着陸復行、横風の弱い滑走路22へ再進入。代替空港へ向かう燃料の判断点を決める |
| 新しいシナリオ（ひな形） | 1:30 | 自作用の最小構成。巡航中に ENG1 の EGT が上がり、AI が推力制限を提案する |

## シナリオを読み込む

次のどれでも読み込めます。読み込んだファイルはブラウザに記憶され、次からは「SCENARIO」の「読み込んだファイル」に並びます。

- 「ファイルを開く…」を押して JSON を選ぶ
- JSON ファイルを画面のどこかにドラッグ＆ドロップする
- 書式に誤りがあると、画面上部にどこが違うかを日本語で表示します
- 読み込むと、すぐに頭から再生が始まります。音声オンのときは音声付きで続けて再生します

「JSONで保存」を押すと、いま再生中のシナリオを JSON ファイルとして書き出せます。同梱シナリオを書き出して、それを元に書き換えるのが手早い作り方です。

## 表示はセンサー値で決まる

シナリオには「何秒に何を表示するか」ではなく、「何秒にセンサーがどんな値か」を書きます。ダッシュボードはその値から表示を決めます。

| センサー値 | 変わる表示 |
| --- | --- |
| 高度・速度・方位・昇降率 | PFD の姿勢指示器と速度／高度／方位テープ、ND のコンパス、垂直表示、フライト進行カード |
| N1・N2・EGT・燃料流量 | EWD のエンジン計器。片方のエンジンだけ EGT が 25°C 以上高いと「EGT TREND」の注意になり、計器と配置図が黄色に変わる |
| 迎角センサ 3系統 | 1系統だけ 2° 以上ずれると、その系統の FCC が多数決から外れ、SYSTEM MESH と配置図の FCC が「除外中」になる |
| 油圧 3系統 | 2,200psi 未満で「LO PR」、500psi 未満で「SYS FAIL」 |
| 発電機・APU 発電機 | 出力 10kVA 未満で「GEN FAULT」。APU が給電すると「APU AVAIL」 |
| 左右の燃料タンク | 差が 1.5t を超えると「FUEL IMBALANCE」。配置図の燃料タンクの濃さは残量に比例 |
| 横風・前方の積乱雲 | 横風 20kt 超、または前方 100km 以内の強い積乱雲で注意。ND に気象エコーを描く |
| 客室高度 | 9,550ft を超えると「CAB PR」の警告 |
| TCAS・ウィンドシア（状態） | PFD に TRAFFIC / CLIMB, CLIMB / WINDSHEAR を表示し、警告を出す |

注意・警告が出ると、マスターコーション（警告）灯、EWD の警告リスト、AI 画面の注意カード、システム健全性の数、配置図の該当カードがまとめて変わります。しきい値はシナリオの `limits` で変えられます。

## センサー値モニター

画面の一番下の「センサー値モニター」を開くと、いまのセンサー値が並びます。スライダーを動かすとその値が「固定」され、シナリオより優先されます。たとえば巡航中に「油圧 2系統」を 0 にすると、その場で警告が出て表示が変わります。プレゼン中に「もしこうなったら」を見せるのに使えます。「固定をすべて解除」で元に戻ります。

## 操作

| 操作 | 内容 |
| --- | --- |
| Space | 再生／停止 |
| ← / → | 前のシーン／次のシーンの頭へ移動 |
| V | 音声のオン／オフ |
| F | 全画面表示の切り替え |
| 下段のスライダー | 再生位置を自由に移動 |
| 1× / 4× / 16× | 再生速度（音声オンのときは1×に固定） |

## 自分のシナリオを作る

書き方は [docs/SCENARIO_FORMAT.md](docs/SCENARIO_FORMAT.md) にまとめています。いちばん簡単なのは `scenarios/09_template.json` をコピーして書き換え、画面にドロップする方法です。

作ったシナリオを「同梱シナリオ」に加えたいときは、`scenarios/` に JSON を置いて `python3 tools/bundle.py` を実行してください。`scenarios/builtin.js` が作り直されます（ブラウザは `file://` から JSON を直接読めないため、同梱分だけこの JS にまとめています）。

## 更新と公開（自動）

`main` ブランチに push すると、GitHub Actions が次を自動で行い、1〜2分で上のURLが更新されます。

1. `scenarios/*.json` をすべて検証（誤りがあれば公開を止め、ログにどこが違うかを日本語で出す）
2. `scenarios/builtin.js` と、画面の「使い方 ?」で開くページ（`readme.html`）を作り直す
3. GitHub Pages に公開し、配布用 zip も置く

| やり方 | 手順 |
| --- | --- |
| 手元から（Mac / Linux） | `./publish.sh "SKY 900 のシナリオを追加"` |
| 手元から（Windows） | `powershell -ExecutionPolicy Bypass -File publish.ps1 "SKY 900 のシナリオを追加"` |
| GitHub の画面から | `scenarios/` で JSON をアップロード、または直接編集してコミット |

スクリプトは 検証 → builtin.js の作り直し → commit → push を一度に行います（Node.js・Python 3・Git が必要）。プルリクエストでは検証だけ行い、公開はしません。詳しくは [docs/PUBLISHING.md](docs/PUBLISHING.md)。

## ファイル構成

```
.
├── index.html              画面（ダッシュボード・配置図・字幕・進行カード）
├── readme.html             画面右上「使い方 ?」で開くページ（README.md から tools/build_docs.py で生成）
├── js/
│   ├── core.js             シナリオの読み込みと検証、センサー値の補間、健全性と警告の判定
│   ├── dashboard.js        ダッシュボードと配置図の描画（センサー値と判定結果から描く）
│   ├── flightcard.js       フライト進行カード
│   ├── voice.js            字幕と音声
│   └── app.js              シナリオの選択・読み込み、再生の時計、センサー値モニター
├── scenarios/
│   ├── 01_sky501-hnd-cts.json
│   ├── 02_sky214-kix-oka.json
│   ├── 03_sky330-itm-birdstrike.json
│   ├── 04_sky812-cts-depress-tcas.json
│   ├── 05_sky605-fuk-hnd-goaround.json
│   ├── 09_template.json
│   └── builtin.js          同梱シナリオをまとめたもの（tools/bundle.py で生成）
├── voice/                  セリフごとの収録音声（tools/voice_render.py で生成。CREDITS.md に声のライセンス）
├── docs/SCENARIO_FORMAT.md シナリオの書き方
├── tools/bundle.py         builtin.js の作り直し（収録音声のあるセリフに audio を付ける）
├── tools/voice_render.py   セリフの音声を作る（Open JTalk、または Google Cloud Text-to-Speech）
├── tools/build_docs.py     readme.html と docs/*.html の作り直し
├── tools/validate.mjs      シナリオ JSON の検証（Node.js）
├── publish.sh / publish.ps1  検証して GitHub に push
├── .github/workflows/pages.yml  push 時に検証して Pages に公開
├── docs/PUBLISHING.md      公開の手順
└── assets/fonts/           英字フォント（Chakra Petch / JetBrains Mono, SIL Open Font License）
```

数値・地名・交信文はすべて演出用の架空のものです。
