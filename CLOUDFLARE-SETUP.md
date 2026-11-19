# Activate the seven calendar accounts

The backend is implemented but needs a D1 binding before accounts work. Do not place passwords in JSON or GitHub. The public calendar reads `/api/events` once D1 is connected; it falls back to sample JSON only when the API is unavailable. A configured but empty database shows an empty calendar.

## Files and deployment layout

Local checkout uses `dist/` for static assets. The GitHub repository places those assets at its root. Copy `wrangler.example.jsonc` to `wrangler.jsonc`, replacing the database ID. On GitHub, change `assets.directory` to `./` (local checkout: `./dist`). When serving the GitHub root, add a `.assetsignore` excluding `worker/`, `migrations/`, `tests/`, `*.md`, and `wrangler*` so backend and setup files are not served as static assets. Keep `main` set to `worker/index.mjs` and `run_worker_first` set to `["/api/*"]`. Configure the existing Cloudflare project to deploy this Worker configuration rather than an assets-only deployment.

## D1 and initial Stake password

1. In Cloudflare, create a D1 database named `ysa-stake-calendar`.
2. Run `migrations/0001_calendar.sql` in its console. This creates seven accounts with no passwords, so none can sign in yet.
3. Bind that database to the Worker as `DB`, and set its database ID in the Wrangler configuration.
4. Add a strong random Worker secret named `SETUP_TOKEN`. Deploy the Worker with its assets and D1 binding.
5. Initialize the Stake password once with an HTTPS POST to `/api/setup`, using `Authorization: Bearer <SETUP_TOKEN>`, `Content-Type: application/json`, and body `{"password":"your unique password of at least 16 characters"}`. Use an API client that does not save request secrets. Never put this password or setup token in a committed file.
6. Delete `SETUP_TOKEN` from Cloudflare after initialization. The endpoint also refuses to overwrite an initialized Stake account.
7. Open `/admin.html`, sign in as `stake`, then use **Ward accounts** to set six different temporary passwords. Share each privately. Ward editors must change their temporary password before managing events.

## Permissions

Usernames: `stake`, `table-rock`, `north-linder`, `overland`, `owyhee`, `eagle-island`, `river-valley`. They cannot self-register or choose a role. Stake manages all events and resets ward passwords. Ward users manage only events assigned to their ward. Everyone can view public events. All passwords require 16–128 characters. Password resets invalidate existing sessions; login attempts are rate-limited. Sessions expire after eight hours.

## Verification

Run `node --test tests/accounts.test.mjs` with Node 22.13+ (SQLite support). Tests exercise the API against SQLite, including ward isolation, Stake overrides, forced password change, reset/session invalidation, invalid dates, cross-origin requests, and throttling. Run a final Cloudflare staging check after binding D1 before handing out credentials.

No live Cloudflare accounts, database, binding or passwords have been created by the source changes alone. The Cloudflare account owner must complete activation or connect an authenticated deployment tool.
