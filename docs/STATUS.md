# Project status

## Stable master

The standalone Windows MVP (Issues #1–#10), Stremio handoff (Issue #24, PR #25), and the subtitle-first player redesign (Issue #26, PR #27) are merged.

Stable capabilities include local MKV playback, FFmpeg text-subtitle extraction, clickable SRT/ASS/SSA dialogue, offline Burmese lookup, translation settings/cache, and the Windows portable package/current-user installer. mpv and FFmpeg remain external dependencies.

Stremio streams use mpv live subtitles. The opt-in Play in Subtitle Bridge helper, serialized single-instance handoff, strict helper validation, retained backups, atomic replacement, and structured diagnostics are stable. PR #25 passed CI #149 and manual Windows retesting before merge.

PR #27 modernized the player controls, subtitle safe area, centered translation card, panels, launcher, focus behavior, and control auto-hide flow without changing the native playback architecture. Manual Windows acceptance and the targeted post-review recheck passed, Codex found no remaining P1/P2 blockers, and final CI #167 passed before squash merge.

## Active work — Issue #28

**Issue:** Support structured offline dictionary entries and 30k-word dataset pipeline

**Branch:** `feat/issue-28-dictionary-v1`

**State:** Implementation complete and local Windows acceptance is nearly complete. The agreed dictionary v1 schema uses a single General American IPA pronunciation, inflected `forms`, meanings grouped by part of speech, and at most three concise Burmese semantic meanings per headword. The first generated 500-entry batch is being used as the real local acceptance dataset while the full approximately 30,000-headword dataset is produced separately.

### Dictionary v1 goals

- Replace the legacy flat local dictionary entry with structured headword data.
- Resolve clicked inflected forms back to the canonical headword.
- Return structured dictionary results through the existing translation/provider/IPC boundary.
- Show headword, IPA pronunciation, part-of-speech groups, and Burmese meanings in the translation card.
- Keep the local dictionary fully offline and near-instant through an in-memory lookup index.
- Add deterministic batch validation and merge/build tooling for the planned 30,000-word dataset.
- Reject duplicate headwords, conflicting forms, malformed entries, unsupported parts of speech, empty Burmese meanings, and entries exceeding the three-meaning limit.
- Permit legitimate headword-vs-form overlaps while giving an exact headword precedence at runtime.

### Dataset rules

- Single-word English headwords for v1.
- One General American IPA pronunciation per headword.
- Useful inflected forms only; the headword itself is not repeated in `forms`.
- Maximum three important Burmese semantic meanings per headword overall.
- Meanings with the same part of speech are grouped together.
- No examples, English definitions, synonyms, antonyms, etymology, separate UK pronunciation, or pronunciation audio in this issue.
- Multi-word phrasal verbs and context-aware sense disambiguation remain later work.

### Current validation

- Batch 001 builds successfully as 500 entries, 1,152 forms, and 735 Burmese meanings.
- `npm run dictionary:validate` passes on the merged 500-entry runtime dictionary.
- Local `npm run check` passes: 13 test files, 76 tests, TypeScript checks, dictionary validation, and the production Electron/Vite build.
- CI #171 and the Windows packaging regression passed earlier on the Issue #28 branch implementation.
- Manual local-MKV acceptance passed on Windows: the structured popup renders the canonical headword, General American IPA, grouped part of speech, and Burmese meanings correctly; inflected-form resolution, exact-headword precedence, multi-POS grouping, and unknown-word fallback were user-tested successfully.
- One Stremio live-subtitle lookup regression remains before final review and merge.

## Later work

Dictionary expansion beyond the first 30,000-headword set, multi-word/phrasal-verb lookup, pronunciation audio/TTS, subtitle delay/vertical-position/size controls, rich ASS/libass fidelity, external Stremio subtitle addons, watched-state synchronization, native upstream Stremio support, self-contained runtime redistribution, and broader Windows-environment acceptance remain separate work.
