# Windows 用。変更を検証して GitHub に push する（push 後は GitHub Actions が自動で公開）。
# 使い方:  powershell -ExecutionPolicy Bypass -File publish.ps1 "コミットメッセージ"
param([string]$Message = "デモを更新")
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
function Run($cmd, $argv) { & $cmd @argv; if ($LASTEXITCODE -ne 0) { throw "$cmd が失敗しました" } }
Write-Host "▶ シナリオを検証"; Run node @("tools/validate.mjs")
Write-Host "▶ builtin.js を作り直す"; Run python @("tools/bundle.py")
Run git @("add", "-A")
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Write-Host "変更はありません"; exit 0 }
Run git @("commit", "-m", $Message)
Run git @("pull", "--rebase", "origin", "main")
Run git @("push", "origin", "main")
Write-Host "✔ push しました。1〜2分後に公開されます（リポジトリの Settings → Pages に URL が出ます）"
