# GitHub への push と公開

`main` ブランチに push すると、GitHub Actions（`.github/workflows/pages.yml`）が次を自動で行います。

1. `scenarios/*.json` をすべて検証（`node tools/validate.mjs`。ブラウザと同じ `js/core.js` の判定）
2. `scenarios/builtin.js` を作り直す（`python3 tools/bundle.py`）
3. GitHub Pages に公開し、配布用 `cockpit-demo-platform.zip` も同じ場所に置く

シナリオに誤りがあると公開は止まり、Actions のログに日本語でどこが違うか出ます。プルリクエストでは検証だけ行い、公開はしません。

## 最初の1回だけ

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
2. 手元に取ってくる：`git clone https://github.com/<ユーザー名>/<リポジトリ名>.git`

無料プランで Pages を使うにはリポジトリを public にする必要があります。

## 更新するとき

シナリオやコードを書き換えたら、リポジトリのフォルダで次を実行します。

| 環境 | コマンド |
| --- | --- |
| Mac / Linux | `./publish.sh "SKY 900 のシナリオを追加"` |
| Windows | `powershell -ExecutionPolicy Bypass -File publish.ps1 "SKY 900 のシナリオを追加"` |

スクリプトは、検証 → builtin.js の作り直し → commit → pull --rebase → push を順に行います。Node.js・Python 3・Git が必要です。
push から1〜2分で公開ページが更新されます（`https://<ユーザー名>.github.io/<リポジトリ名>/`）。

GitHub の画面から JSON をアップロードしたり直接編集したりしても、同じように自動で検証・公開されます。手動で公開し直したいときは Actions タブの「検証して GitHub Pages に公開」→ **Run workflow**。
