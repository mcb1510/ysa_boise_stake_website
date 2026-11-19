# YSA Boise Stake website

Static website ready for Cloudflare Pages. No build or dependencies are required.

## Files

- `dist/index.html`: landing page.
- `dist/calendar.html`: calendar markup.
- `dist/css/calendar.css`: approved calendar design.
- `dist/js/calendar.js`: calendar interaction and JSON loading.
- `dist/data/wards.json`: ward IDs, names, and colors.
- `dist/data/events.json`: editable calendar records.

## Local preview

Run `python3 -m http.server 8080 --directory dist` and visit http://localhost:8080. Use an HTTP server because the calendar fetches JSON files.

## Event data

The existing entries are demonstration data, marked `isSample: true`. Their end times are sample two-hour durations, not confirmed schedules. Replace them with confirmed records before launch.

Each event has a unique `id`, a `calendarId` matching wards.json, `title`, `date` (YYYY-MM-DD), `startTime` and `endTime` (24-hour HH:mm), `place`, and `description`. Times are Boise local time (America/Boise). Same-day events are supported; endTime must be later than startTime. An empty events array is valid. Keep the surrounding timezone/events object.

The calendar now uses full dates, so records do not repeat in other months. Today uses Boise time. Colors come from wards.json for event markers and details; filter styles remain in CSS to preserve the approved design.

## Cloudflare Pages

Connect the GitHub repository, choose no framework, leave the build command empty, and set the output directory to `dist` when deploying this checkout. The GitHub mirror currently places the contents of dist at the repository root: for that repository use `/` as the output directory instead. No secrets are needed for this static version.

JSON files on a static website are public. Do not include private contact information or credentials. Authentication, seven editor accounts, and shared updates are not implemented. Those can be added using Cloudflare Workers and D1 while retaining this interface.
