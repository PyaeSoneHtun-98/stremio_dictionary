# Dictionary reporting

Issue #71 adds an icon-only flag beside the translation card's close button.

- A genuine dictionary miss submits the normalized lookup word with category `missing`.
- A displayed dictionary entry submits its canonical headword with category `incorrect`.
- A detected phrase submits its canonical phrase with category `incorrect`.
- Loading and general translation errors have no report button.
- No explanation form or automatic lookup telemetry is used.
- Tooltip/accessible-label states cover sending, reported, retry, rate limiting, and an unconfigured service.

## Separation and deployment

The Supabase function, migration, private database logic, tests, and owner setup guide live in the
separate project `D:\Projects\subtitle-report-service`. They are not packaged with the player.
The player only knows the versioned HTTPS request contract described below.

After deploying that project, set the public URL in `.env.local` for development:

```dotenv
SUBTITLE_BRIDGE_REPORT_ENDPOINT=https://subtitle-report-service.vercel.app/api/report-dictionary
```

The main-process client uses Electron's Chromium `net.fetch` network stack. Requests still omit
cookies, reject redirects, validate the fixed approved endpoint, and use bounded timeouts/responses.
The renderer has no general network API. An isolated Windows probe reproduced intermittent Node
fetch connection resets while Electron networking reached the same Vercel endpoint.

For CI and official release builds, set the repository Actions variable
`SUBTITLE_BRIDGE_REPORT_ENDPOINT` to the same URL. Both workflows embed this at build time.
Rebuild/restart after changing it. Packaged builds do not depend on runtime environment variables.
Approved routes are the exact official Vercel hostname/path above or a direct
`https://PROJECT_REF.supabase.co/functions/v1/report-dictionary` URL. Other Vercel deployments,
admin routes, credentials, custom ports, queries, and fragments are rejected.
Missing/invalid configuration disables the icon and causes no
network activity. No Supabase SDK, public key, service key, database password, or login goes in the app.

## Request contract

An explicit click calls a narrow preload method. The main process validates `term` and `category`,
then sends this JSON to the configured endpoint with `POST`:

```json
{
  "requestId": "12345678-1234-4123-8123-123456789abc",
  "term": "give up",
  "category": "incorrect",
  "targetLanguage": "my",
  "appVersion": "1.0.6",
  "dictionaryVersion": "1.0",
  "phraseDictionaryVersion": "1.0.0"
}
```

Versions are derived by the main process, not accepted from the renderer. Terms are bounded to 120
characters and five tokens. Extra fields and path/URL/control-character inputs are rejected.
Successful receipt is HTTP 202 with `{ "ok": true }`; 429 means retry later, and other failures
allow retry. Network and response parsing have a ten-second deadline. Redirects and cookies are
disabled. Responses are bounded and never rendered as provider error text.

Concurrent clicks for the same term/category share one request. Failed retries reuse the same
random request ID; the backend retains retry receipts for seven days. A confirmed report is
remembered for the app session. The main process permits at most 100 distinct report keys per
session, and aborts pending requests on shutdown. There is no persistent offline queue.

## Privacy and behavior

Reporting is an explicit user submission of the chosen term. The tooltip states that the term is
sent to the developer. It does not send subtitle context, the original clicked token for an existing
entry, translations, media paths, stream URLs, credentials, or user/device identifiers. A random
request ID exists only for retry deduplication. Terms and requests never enter app diagnostics.
Lookup remains fully offline; reporting failures do not change playback, subtitles, selection, or
automatic-pause settings.

## Separate owner interface

[The owner dashboard](https://subtitle-report-service.vercel.app) is hosted in the separate backend
project. It supports word/phrase search, type/status filters, grouped counts, pagination, and manual
review statuses. Report reads and status changes require the configured owner's verified Supabase
Auth identity; server keys stay in Vercel's private environment. The browser does not contact Supabase
directly. Owner setup is documented in `D:\Projects\subtitle-report-service\VERCEL_SETUP.md`.

The Vercel reporting relay uses the same seven-field body and receipt UUID. The existing Supabase
function still owns validation, private storage, deduplication, and quota. Vercel is an additional
hosting processor, with no additional identity fields in reports.

## Acceptance still needed before release

- Owner project `axcpqizzmjwdwwpdaggf` is linked, the migration is applied, and the function is
  deployed. The development endpoint is configured; official build configuration remains pending.
- The direct Supabase hostname remains unreachable on the tested network. On 2026-10-05 the exact
  Vercel production endpoint was verified without VPN: health/dashboard HTTP 200, reporting GET
  HTTP 405, two identical synthetic-report POSTs HTTP 202, and live database receipt/count of 1.
- Owner Auth user/UID and private server key are configured. On 2026-10-05 the owner confirmed
  real dashboard login, report browsing, and status saving. Anonymous/invalid-session denial was
  checked live; valid non-owner denial is covered automatically but still needs live acceptance.
- After the Electron transport fix and a full development-app restart, the owner confirmed the
  report flag shows `Reported`. This confirms the failed submission flow works; it does not replace
  the remaining acceptance checks below.
- Confirm real submissions appear in the private table, including canonical phrase/headword reports.
- Confirm failed/offline submissions offer retry and duplicate retries count only once.
- Test the icon in real Windows playback and at small window sizes; confirm clicking it does not
  toggle playback or dismiss the popup and keyboard focus/tooltip remain usable.
- CI #583 passed validate at code head `5818bcab4f6bf99c83c1f5df5af2255d188fa126`;
  Windows packaging remains blocked by the pinned FFmpeg download HTTP 404 (Issue #73).
  Obtain green final-head CI and final review; this feature is not yet approved for merge/release.
