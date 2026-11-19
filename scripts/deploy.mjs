// Cloudflare Builds runs on Linux. Pass secrets through stdin, never command
// arguments, repository files, or logs. Without a setup token, ordinary deploys
// preserve existing runtime secrets.
import { spawnSync } from 'node:child_process';

const token = process.env.SETUP_TOKEN;
const args = ['--yes', 'wrangler', 'deploy'];
if (token) {
  if (token.length < 32) {
    console.error('SETUP_TOKEN must contain at least 32 characters.');
    process.exit(1);
  }
  args.push('--secrets-file', '/dev/stdin');
}
const result = spawnSync('npx', args, {
  input: token ? JSON.stringify({ SETUP_TOKEN: token }) : undefined,
  stdio: [token ? 'pipe' : 'inherit', 'inherit', 'inherit'],
  env: process.env
});
if (result.error) {
  console.error('Could not start the Cloudflare deployment.');
  process.exit(1);
}
process.exit(result.status ?? 1);
