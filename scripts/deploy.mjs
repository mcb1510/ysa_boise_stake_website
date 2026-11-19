// Wrangler requires a real file for --secrets-file in Cloudflare Builds.
// Keep it outside the assets/repository, restrict permissions, and remove it.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const token = process.env.SETUP_TOKEN;
const args = ['--yes', 'wrangler', 'deploy'];
if (token) {
  if (token.length < 32) {
    console.error('SETUP_TOKEN must contain at least 32 characters.');
    process.exit(1);
  }
}
let directory;
let status = 1;
try {
  if (token) {
    directory = mkdtempSync(join(tmpdir(), 'stake-deploy-'));
    const path = join(directory, 'secrets.json');
    writeFileSync(path, JSON.stringify({ SETUP_TOKEN: token }), { mode: 0o600 });
    args.push('--secrets-file', path);
  }
  const result = spawnSync('npx', args, { stdio: 'inherit', env: process.env });
  if (result.error) console.error('Could not start the Cloudflare deployment.');
  else status = result.status ?? 1;
} catch {
  console.error('Could not prepare the Cloudflare deployment.');
} finally {
  if (directory) rmSync(directory, { recursive: true, force: true });
}
process.exit(status);
