#!/usr/bin/env node
// scenarios/*.json を js/core.js の読み込み処理で検証する（ブラウザと同じ判定）。
// 使い方: node tools/validate.mjs   エラーがあれば終了コード 1
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'), ctx);
const SD = ctx.SkyDemo; let bad = 0;
for (const f of fs.readdirSync(path.join(root, 'scenarios')).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()) {
  const r = SD.load(fs.readFileSync(path.join(root, 'scenarios', f), 'utf8'));
  const errs = r.errors || [], warns = r.warnings || [];
  if (errs.length) { bad++; console.log(`NG  ${f}`); errs.forEach(e => console.log(`    エラー: ${e}`)); }
  else console.log(`OK  ${f}`);
  warns.forEach(w => console.log(`    注意: ${w}`));
}
if (bad) { console.log(`\n${bad} 件のシナリオにエラーがあります`); process.exit(1); }
console.log('\nすべてのシナリオを読み込めました');
