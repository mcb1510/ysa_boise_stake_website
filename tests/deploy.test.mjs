import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

for (const code of [0, 1]) test(`secret handoff and cleanup on deploy exit ${code}`, () => {
 const directory = mkdtempSync(join(tmpdir(), 'stake-deploy-test-'));
 try {
  const capture = join(directory, 'capture.json');
  const mock = `#!${process.execPath}\nconst fs=require('fs');const args=process.argv.slice(2);const file=args[args.indexOf('--secrets-file')+1];fs.writeFileSync(process.env.CAPTURE,JSON.stringify({file,mode:fs.statSync(file).mode&511,data:JSON.parse(fs.readFileSync(file,'utf8'))}));process.exit(${code});\n`;
  writeFileSync(join(directory, 'npx'), mock, {mode:0o700});
  const token = 'test-only-key-'.repeat(4);
  const result = spawnSync(process.execPath, ['scripts/deploy.mjs'], {cwd:resolve('.'),env:{...process.env,SETUP_TOKEN:token,CAPTURE:capture,PATH:directory+':'+process.env.PATH},encoding:'utf8'});
  assert.equal(result.status,code);
  const actual = JSON.parse(readFileSync(capture,'utf8'));
  assert.equal(actual.mode,0o600);assert.equal(actual.data.SETUP_TOKEN,token);
  assert.equal(existsSync(actual.file),false);
  assert.ok(!actual.file.startsWith(resolve('.')+'/'));
  assert.ok(!(result.stdout+result.stderr).includes(token));
 } finally { rmSync(directory,{recursive:true,force:true}); }
});
