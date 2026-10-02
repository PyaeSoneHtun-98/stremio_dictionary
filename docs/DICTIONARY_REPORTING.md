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
SUBTITLE_BRIDGE_REPORT_ENDPOINT=https://YOUR_PROJECT_REF.supabase.co/functions/v1/report-dictionary
```

For CI and official release builds, set the repository Actions variable
`SUBTITLE_BRIDGE_REPORT_ENDPOINT` to the same URL. Both workflows embed this at build time.
Rebuild/restart after changing it. Packaged builds do not depend on runtime environment variables.
Only an HTTPS `*.supabase.co/functions/v1/report-dictionary` URL without credentials, custom port,
query, or fragment is accepted. Missing/invalid configuration disables the icon and causes no
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

## Acceptance still needed before release

- Create the owner-managed Supabase project, apply its migration, and deploy the function.
- Configure the public endpoint in development and official build settings.
- Confirm real submissions appear in the private table, including canonical phrase/headword reports.
- Confirm failed/offline submissions offer retry and duplicate retries count only once.
- Test the icon in real Windows playback and at small window sizes; confirm clicking it does not
  toggle playback or dismiss the popup and keyboard focus/tooltip remain usable.
- Run exact-head CI and final review; this feature is not yet approved for merge/release.
