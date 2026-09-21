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

**State:** Codex found one P2 legacy-alias regression. The fix, automated regression coverage, and Windows manual alias retest are complete; final exact-head CI and Codex re-review remain.

### Source dataset

- Frozen version: `1.0.0`
- Source artifact: `PyaeSoneHtun-98/dictionary-dataset/dist/dictionary_v1.json`
- Frozen source artifact commit used for import: `20c7ce3f35f0138fb84ded6ac337b7be647e3d87`
- Frozen headwords: 30,000
- Stored forms: 15,864
- Burmese semantic meanings: 38,001
- Unique lookup keys: 45,817
- Expected artifact SHA-256: `fcdb26986ed62bfaa130732ed0e88cc2e30bbc7f964b4b16de47f809783ed325`
- Form-to-form collisions: 0
- Exact headword/form overlaps are intentional; exact headwords remain authoritative.

### Issue #32 implementation

- The exact frozen 30,000-entry artifact is vendored as the production runtime dictionary.
- Normal repository validation verifies the production artifact SHA-256 and 30,000-entry shape.
- A separate 16-entry structured core supplement preserves useful basic words intentionally absent from the frozen corpus:
  `bad`, `big`, `day`, `do`, `go`, `humiliating`, `love`, `man`, `new`, `no`, `run`, `say`, `see`, `thanks`, `wait`, `yes`.
- The old flat `legacyDictionary.ts` fallback and legacy lookup path are removed.
- A separate collision-checked compatibility table restores the 11 starter-dictionary aliases that were not present in the frozen corpus forms: `children`, `fathers`, `friends`, `lifespans`, `mothers`, `nights`, `signed`, `signing`, `sisters`, `times`, and `women`.
- Exact headwords are indexed before stored forms and compatibility aliases, preserving exact-headword precedence.
- Runtime local dictionary size is 30,016 structured entries: the frozen 30,000 corpus plus the 16-entry structured core supplement.
- Lookup remains fully offline.

### Automated validation

CI #242 passed on implementation head `9dd21a89bd6a8631486ad60d94aa0949536b14cb`:

- production dictionary SHA/source provenance verification passed;
- structured dictionary validator passed for 30,000 entries, 15,864 forms, and 38,001 Burmese meanings;
- 18 test files / 98 tests passed;
- production Electron build passed;
- Windows packaging passed;
- packaged install/upgrade/Stremio-handoff regression passed.

Automated regressions cover production corpus count, `chosen → choose`, exact-headword precedence using `warning`, structured-core `went → go`, unknown-word handling, target-language behavior, and all 11 restored legacy compatibility aliases.

### Manual Windows acceptance

Manual acceptance passed on Windows using the Issue #32 branch/build:

- app startup with the full production dictionary;
- local MKV structured Burmese lookup;
- multiple real subtitle-word lookups;
- inflected production lookup, including `proudest → proud`, with canonical headword, IPA, POS, and Burmese meanings;
- structured-core lookup such as `went → go`;
- clean unknown-word failure;
- installed/package upgrade to the Issue #32 build;
- Stremio `Play in Subtitle Bridge` launch with the upgraded installed app;
- structured Burmese lookup during Stremio playback.

No manual Issue #32 acceptance item remains pending.

### Codex P2 follow-up

Codex's first final review found one P2: removing the flat legacy fallback dropped 11 common aliases that master previously supported.

Resolution:
- added a separate collision-checked compatibility alias table outside the frozen 30k artifact;
- every compatibility target must exist as a structured headword;
- compatibility aliases cannot overwrite another headword's stored form;
- exact headwords still win over forms/compatibility aliases;
- added a regression test that resolves all 11 restored aliases to their expected canonical headwords;
- frozen production JSON remains byte-for-byte unchanged.

CI #247 passed on code head `15fed17c9816578bdc9cd936685129542ad74821`:
- production dictionary SHA verification passed;
- dictionary validation passed;
- 18 test files / 99 tests passed;
- production build passed;
- Windows packaging/install/upgrade/Stremio-handoff regression passed.

### P2 manual retest

Windows manual retest passed on another PC using the current Issue #32 branch/build:
- `children → child`;
- `signed → sign`;
- `women → woman`.

Each restored alias resolved through the normal structured popup path.

### Remaining gate

- Final exact-head CI after this manual-result documentation commit.
- Codex re-review of the P2 fix.
- Merge only if no P1/P2 blockers remain.

## Later work

Multi-word/phrasal-verb lookup, pronunciation audio/TTS, broader bilingual editorial review of the 30,000-entry dataset, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
