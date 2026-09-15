# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), and the subtitle-first player redesign (Issue #26, PR #27) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable. PR #25 passed CI #149 and manual Windows retesting before merge.

PR #27 modernized the player controls, subtitle safe area, centered translation card, panels, launcher, focus behavior, and control auto-hide flow without changing the native playback architecture. Manual Windows acceptance and the targeted post-review recheck passed, Codex found no remaining P1/P2 blockers, and final CI #167 passed before squash merge.

## Active work — Issue #28

**Issue:** Support structured offline dictionary entries and 30k-word dataset pipeline

**Branch:** `feat/issue-28-dictionary-v1`

**State:** Implementation and Windows acceptance are complete. The agreed dictionary v1 schema uses a single General American IPA pronunciation, inflected `forms`, meanings grouped by part of speech, and at most three concise Burmese semantic meanings per headword. The first generated 500-entry batch was used as the real local acceptance dataset while the full approximately 30,000-headword dataset is produced separately. PR #29 is in final review after resolving the two implementation P2 findings from Codex.

### Dictionary v1 goals

- Replace the primary local dictionary lookup with structured headword data while retaining the previous starter dictionary as a compatibility fallback until the full structured corpus supersedes it.
- Resolve clicked inflected forms back to the canonical headword.
- Return structured dictionary results through the existing translation/provider/IPC boundary.
- Show headword, IPA pronunciation, part-of-speech groups, and Burmese meanings in the translation card.
- Keep the local dictionary fully offline and near-instant through in-memory lookup indexes.
- Add deterministic batch validation and merge/build tooling for the planned 30,000-word dataset.
- Reject duplicate headwords, ambiguous form-vs-form collisions, malformed entries, unsupported parts of speech, empty Burmese meanings, entries exceeding the three-meaning limit, incorrectly numbered batch files, malformed batch-like JSON filenames, and batches that do not contain exactly 500 entries.
- Permit legitimate headword-vs-form overlaps while giving an exact headword precedence at runtime.

### Dataset rules

- Single-word English headwords for v1.
- One General American IPA pronunciation per headword.
- Useful inflected forms only; the headword itself is not repeated in `forms`.
- Maximum three important Burmese semantic meanings per headword overall.
- Meanings with the same part of speech are grouped together.
- Every `dictionary_batch_###.json` file must contain exactly 500 entries and its JSON `batch` value must match the filename.
- Batch filenames must be contiguous from `dictionary_batch_001.json`, and malformed batch-like JSON filenames are rejected rather than ignored.
- No examples, English definitions, synonyms, antonyms, etymology, separate UK pronunciation, or pronunciation audio in this issue.
- Multi-word phrasal verbs and context-aware sense disambiguation remain later work.

### Validation completed

- Batch 001 builds successfully as 500 entries, 1,152 forms, and 735 Burmese meanings.
- `npm run dictionary:validate` passes on the merged 500-entry runtime dictionary.
- Local `npm run check` passed with the full Batch 001 dataset before final review: 13 test files, 76 tests, TypeScript checks, dictionary validation, and the production Electron/Vite build.
- Manual local-MKV acceptance passed on Windows: the structured popup renders the canonical headword, General American IPA, grouped part of speech, and Burmese meanings correctly; inflected-form resolution, exact-headword precedence, multi-POS grouping, unknown-word fallback, and playback behavior were user-tested successfully.
- Manual Stremio regression acceptance passed: a live Stremio stream played with clickable English subtitles and successful structured Burmese dictionary lookup.
- Codex's initial final review found two P2 blockers: dictionary indexes were rebuilt per uncached lookup, and malformed batch-like filenames could be silently omitted. Both were fixed with regression coverage.
- Structured and legacy lookup indexes are now built once at module load and reused for lookups.
- Malformed batch-like JSON filenames are now rejected before filtering; contiguous numbering, filename/JSON batch matching, exact 500-entry size, collision checks, and exact-headword precedence remain enforced.
- CI #197 passed on implementation head `1b2e2825d7d44617bca1f0026aa4e360ba8cd091`, including the validation job and Windows package/install/Stremio regression job.
- Codex re-review confirmed the two original P2 blockers are resolved and found no P1 issues; the only remaining finding was this status-documentation correction.

## Later work

Dictionary expansion beyond the first 30,000-headword set, removal of the legacy fallback after structured coverage supersedes it, multi-word/phrasal-verb lookup, pronunciation audio/TTS, subtitle delay/vertical-position/size controls, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
