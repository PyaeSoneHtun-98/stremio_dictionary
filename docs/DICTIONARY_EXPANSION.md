# Dictionary and phrase expansion — Issue #79

## Source and scope

Pinned upstream: [dictionary-dataset 3bce847](https://github.com/PyaeSoneHtun-98/dictionary-dataset/tree/3bce8474b301c89e0dd21b09588c063b7342397d).
This adds 5,000 heads beyond Issue #75's 5,000-word extension and 1,000 new phrases.
The frozen 30,000-word and 3,000-phrase base files remain byte-for-byte unchanged.
Upstream staging/candidate files and compressed exclusion indexes are not runtime payloads.

| Vendored file | Contents | SHA-256 |
| --- | --- | --- |
| `dictionary-extension.json` | Batches 061–080: 10,000 heads, 6,361 forms, 10,980 meanings | `2c0818ba6d5d835af2a28a5d2a98c0a96b6414d0af2c252bf9caf32a1bc16086` |
| `phrases-extension.json` | Batches 013–016: 1,000 phrases, 2,682 forms, 1,164 meanings | `26a932d88b8bda52638de7eaf2bc1adb78e0b36099250fa8523f550853ffbb85` |
| `dictionary-extension-corrections.json` | 19 explicit app replacements | `a12cd2cffe7da1ee3d43f7f8757b410df73dbfbf908bf4c199585adea8c9d145` |

Files live under `src/main/translation/data/`. Both extension payloads are vendored unchanged.
Upstream tests (38), deterministic artifact/metadata checks and manifest/index checks passed
at the pinned commit. Existing 5,000 extension entries were verified unchanged.

## Word reconciliation and editorial choices

The dataset excludes frozen keys but does not know the app's core supplement. New `go`, `run`
and `see` heads therefore require explicit reconciliation. Core overlap checks remain enabled;
an allowlisted overlap without a correction is also rejected.

The original 11 [Issue #75 corrections](DICTIONARY_EXTENSION.md) are retained unchanged.
Eight replacements add the following targeted fixes, each preserving the upstream forms:

| Word | Effective app correction |
| --- | --- |
| go | Restore `သွားသည်`, retain both noun senses, preserve `went`, `gone`, `going` and `goes`. |
| run | Keep the core running, operation and management senses; preserve `running`, `ran`, `runs`. |
| see | Include seeing, understanding and meeting; preserve `seeing`, `saw`, `seen`, `sees`. |
| can | Include modal `နိုင်သည်`, retain container and dismiss-from-job senses. |
| die | Add death verb alongside both nouns; include `died` and `dying`. |
| let | Add allow/permit alongside renting and the sports noun; include `letting`. |
| in | Add location preposition alongside both adjective senses. |
| lot | Add large amount alongside land and fate senses. |

The schema permits at most three Burmese meanings per entry. To prioritize ordinary subtitle
use, `can` drops the toilet sense and `see` drops the dating sense from the effective app layer;
`run` uses the core's three general glosses rather than duplicating synonymous upstream ones.
The raw upstream artifact still contains those original senses. These are targeted AI-authored
editorial decisions, not independent human bilingual sign-off or exhaustive corpus approval.

The result has **40,011 unique runtime headwords**: 30,000 base + 10,000 extension + 11 retained
core entries. Five core heads (`go`, `love`, `run`, `see`, `wait`) are reconciled. The net increase
over the previous 35,014 is 4,997, because three new upstream heads already existed in the core.
Canonical heads still take precedence over another entry's forms and compatibility aliases.

## Phrase matching

The base plus extension contain **4,000 canonical phrases**, **7,509 forms** and **11,509 stored
variants.** Index keys now use the same tokenizer as subtitle clicks. `go pear-shaped` and its
four forms therefore match as three subtitle tokens while retaining their canonical display
and report text. Distinct stored spellings under one owner can share a token key, for example
`bird's-eye view` / `bird's eye view`. Exact normalized stored duplicates remain invalid;
collisions between different owners fail closed. Stored variant counts are not a claim that
every spelling has a distinct normalized runtime key.

Longest-match-first and the renderer's bounded current-cue context remain unchanged. Each
variant must contain 2–5 actual subtitle tokens after normalization. No separated-object,
cross-cue, fuzzy matching or timing/extraction changes are introduced.

## Automated gates and report versions

`npm run check` verifies frozen hashes, extension/correction hashes, counts, schema and source
namespace disjointness. Provider tests validate combined composition, every source word key,
all frozen/core/compatibility keys, common-sense sentences, and all 11,509 phrase variants from
every clicked token through the real subtitle tokenizer and renderer context builder.
Dedicated tests cover hyphenated token spans, same-owner variants and cross-owner collisions.

Reports use `dictionaryVersion: "1.0-ext.061-080.2"` and
`phraseDictionaryVersion: "1.0-ext.013-016.1"`. These fit the existing bounded backend contract;
no reporting server or database change is required. Future payload/correction revisions must
update pins, provenance and corpus versions together.

## Acceptance status

Implementation is on `codex/issue-79-dictionary-expansion`, based on stable master,
in [Draft PR #80](https://github.com/PyaeSoneHtun-98/stremio_dictionary/pull/80).
Theme PR #78 remains separate. Local `npm run check` passed all 250 tests in 36 files,
corpus gates, lint/typechecks and production builds. CI #600 passed both `validate` and
`package-windows` at implementation head `4b55b5fdedd4cc08fe49674f47a2bb66f7908965`.
Local Windows build and both packaging scripts also passed in an isolated staging folder
to avoid replacing the running theme test app. Owner Windows acceptance and final review
remain pending; automated Windows installer tests are not actual owner playback acceptance.
No merge or release publication is authorized. Earlier Issue #75 Windows acceptance does not
establish acceptance of this expansion or the phrase normalization change.

Local pure Issue #79 artifacts (under `.vite/issue79-package-stage/release`):

- ZIP SHA-256: `fc807ad8efccdcf6185ebda126d10e32549903ee3eeceac9c21e2b05d8b1ba2a`.
- Setup SHA-256: `0dd0995486dcc064628b9baab595e1eb3a0be4be1c8e2266072d72858e4c2947`.

The separate `release/SubtitleBridge-dictionary-test-win-x64/Subtitle Bridge.exe` is a
local combined acceptance preview: this PR's app bundles plus only the neutral CSS from
PR #78 head `a0862ef67b41eae0a90a6d578b347a5f7164c876`. App bundles and all 16 copied existing
runtime files passed SHA-256 equality checks; the official reporting endpoint is present.
Pure ZIP/setup artifacts remain unchanged and do not contain that theme overlay or local
runtime copies. The running prior test app was preserved. Close it before opening the new
preview. `release/dictionary-expansion-acceptance.srt` provides 18 synthetic cues for external
subtitle acceptance; it is not packaged. Neither the preview nor fixture is committed.

Manual checklist for the new Windows test build:

1. Click `go`, `went`, `gone`, `run`, `ran`, `see`, `saw`, `seen`, `waited`, `going`, `running` and `seeing`.
2. Check `I can swim`, `I do not want to die`, `Let me explain`, `in the room`, and `a lot`.
3. Check new vocabulary such as `tailgater`, `surrogacy`, `outro` and `superhero`; verify IPA,
   POS groups, Burmese rendering and card scrolling.
4. Click each word in `went pear-shaped` and `bird's-eye view`; check that the original canonical
   phrase is displayed. Test ordinary phrases, longest-match behavior and word fallback too.
5. Submit an explicit word and phrase report; inspect corpus versions privately in the owner
   inbox and confirm normal success/retry feedback. Synthetic tests submit no real reports.
6. Repeat representative clicks using local/external subtitles and Stremio/network subtitles.

Automated provider/tokenizer tests are not actual playback or native Windows acceptance.
