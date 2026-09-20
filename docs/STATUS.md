# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), subtitle-first player redesign (Issue #26, PR #27), structured offline dictionary v1 pipeline (Issue #28, PR #29), and external subtitle/control work (Issue #30, PR #31) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, drag-and-drop external SRT/ASS/SSA subtitles, subtitle delay/size/position controls, structured offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable.

PR #29 established the structured dictionary v1 schema, JSON-backed lookup, form-to-headword resolution, grouped POS/Burmese rendering, deterministic batch tooling, and exact-headword precedence over stored forms. It intentionally kept a temporary flat legacy fallback while the full corpus was still incomplete.

PR #31 added external subtitle drag/drop and subtitle timing/appearance controls. Manual Windows acceptance passed, both Codex P2 findings were resolved, final CI #231 passed on the reviewed head, and Issue #30 closed when PR #31 was squash merged.

## Active work — Issue #32

**Issue:** Import finalized 30,000-word Dictionary v1.0

**Branch:** `feat/issue-32-production-dictionary`

**State:** Integration started from stable master. The finalized dataset is frozen in `PyaeSoneHtun-98/dictionary-dataset` and will replace the tiny runtime development dictionary.

### Source dataset

- Frozen version: `1.0.0`
- Source artifact: `PyaeSoneHtun-98/dictionary-dataset/dist/dictionary_v1.json`
- Frozen headwords: 30,000
- Stored forms: 15,864
- Burmese semantic meanings: 38,001
- Unique lookup keys: 45,817
- Expected artifact SHA-256: `fcdb26986ed62bfaa130732ed0e88cc2e30bbc7f964b4b16de47f809783ed325`
- Form-to-form collisions: 0
- Exact headword/form overlaps are intentional; exact headwords remain authoritative.

### Issue #32 goals

- Vendor the frozen 30,000-entry artifact as the production runtime dictionary.
- Verify the imported artifact against the frozen SHA/source provenance.
- Preserve current structured popup behavior and exact-headword precedence.
- Add a small structured core supplement for the 16 useful legacy-only words:
  `bad`, `big`, `day`, `do`, `go`, `humiliating`, `love`, `man`, `new`, `no`, `run`, `say`, `see`, `thanks`, `wait`, `yes`.
- Remove the old flat `legacyDictionary.ts` fallback once equivalent structured coverage is present.
- Add regression tests for corpus size, representative inflections, structured-core coverage, and exact-headword precedence.
- Keep normal dictionary lookup fully offline.
- Validate practical startup/lookup behavior with the full corpus.

### Pending validation

- Automated `npm run check`.
- Windows local-MKV lookup regression with several real dictionary words.
- One inflected lookup resolving to its canonical headword.
- One structured-core lookup such as `went → go`.
- Unknown-word failure remains clean.
- One Stremio live-subtitle Burmese lookup regression.
- Codex final review and any required P1/P2 fixes.

## Later work

Multi-word/phrasal-verb lookup, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry dataset, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
