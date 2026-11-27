#!/usr/bin/env bash
# 変更を検証して GitHub に push する。push すると GitHub Actions が自動で Pages に公開する。
# 使い方:  ./publish.sh "コミットメッセージ"
set -euo pipefail
cd "$(dirname "$0")"
msg="${1:-デモを更新}"
echo "▶ シナリオを検証"; node tools/validate.mjs
echo "▶ builtin.js を作り直す"; python3 tools/bundle.py
echo "▶ 使い方ページを作り直す"; python3 tools/build_docs.py
git add -A
if git diff --cached --quiet; then echo "変更はありません"; exit 0; fi
git commit -m "$msg"
git pull --rebase origin main
git push origin main
url=$(git remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)([^/]+)/([^/.]+)(\.git)?#https://\2.github.io/\3/#')
echo "✔ push しました。1〜2分後に公開されます: $url"
