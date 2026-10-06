# Dictionary extension — Issue #75

## Pinned data and release scope

The app loads the frozen Dictionary v1.0 plus **5,000** extension headwords from batches
061–070. This is the currently completed dataset, not a 10,000-word addition.

Source: [dictionary-dataset commit 7be581c](https://github.com/PyaeSoneHtun-98/dictionary-dataset/tree/7be581cc925e8c097cf89efdf973b1f65a62da66).

The upstream `dist/dictionary_extension.json` is vendored byte-for-byte as
`src/main/translation/data/dictionary-extension.json`:

- SHA-256: `53b42c8c45a5bf0e956deed2d1764d0b40381edf88e141c5591461522b45f8cd`
- schema version: 1
- canonical entries: 5,000
- stored forms: 3,783
- Burmese meanings: 5,329
- source lookup keys: 8,783, disjoint from frozen v1

The frozen dictionary and phrase files/hashes stay unchanged. The upstream extension is
AI-authored and structurally audited, with targeted editorial repairs; exhaustive independent
bilingual review and a complete General American IPA audit have not been performed.

## App reconciliation

The upstream exclusion index knows the frozen corpus, but does not include the app's core
supplement or compatibility aliases. Simply appending all entries would throw for duplicate
`love` and `wait` headwords. Dropping those core entries without enrichment would also lose
the `waited` lookup and `wait`'s verb meaning.

`dictionary-extension-corrections.json` supplies 11 explicit replacement entries:

| Entry | Reviewed runtime change |
| --- | --- |
| going | Keep departure noun; add ordinary go verb sense; restore IPA stress. |
| love | Retain noun and verb senses; supersede duplicate core headword. |
| loved | Keep adjective; add past love verb sense; correct IPA vowel. |
| loving | Keep adjective; add love verb sense; correct IPA vowel. |
| running | Replace football-only noun gloss with the three existing general run verb senses; correct IPA vowel. |
| saying | Keep proverb/expression noun; add ordinary say verb sense; restore IPA stress. |
| seeing | Keep perception noun; add ordinary see verb sense; restore IPA stress. |
| signed | Keep adjective; include signing a document as a verb sense. |
| signing | Keep sign-language noun; include signing a document as a verb sense. |
| wait | Keep waiting-time noun; restore core verb meaning and `waited` form. |
| waiting | Keep waiting noun; restore ordinary wait verb meaning. |

The correction asset is separate from both upstream artifacts. SHA-256:
`8861989797ef5855acdffcc55245f508a260889548af69cb87efa445d486726f`.
All original extension forms are preserved; `waited` adds one runtime form.
Every corrected entry still obeys the maximum of three Burmese meanings.
These are targeted app corrections, not a claim of exhaustive editorial approval.

Composition in `localDictionary.ts` loads the base, applies the explicit corrections to the
extension, and retains the 14 nonoverlapping core entries. A newly introduced core overlap
fails instead of being silently removed. Duplicate/missing correction targets also fail.
There are **35,014 unique runtime headwords**, a net addition of 4,998 over the former
30,016 because `love` and `wait` were already available. Exact canonical headwords still win
over forms/aliases; phrase-first matching remains unchanged.

## Verification and reporting

`npm run check` verifies the pinned base, extension and correction digests, source counts,
base/extension disjointness, correction targets/form preservation and combined schema.
Behavioral tests validate the complete runtime dictionary including core forms, resolve all
8,783 source keys after real subtitle tokenization, preserve frozen/core/alias lookup coverage,
check every overlap's ordinary meaning, and exercise all 7,827 phrase variants.

Reports use `dictionaryVersion: "1.0-ext.061-070.1"`: frozen base v1.0, extension batches
061–070 and app corrections revision 1. This fits the existing backend version contract
without additional fields or server changes. `phraseDictionaryVersion` remains `1.0.0`.
Future data/correction changes must update the pins, tests, provenance and corpus revision.

## Windows acceptance checklist

Local `npm run check` passed all 241 tests, both typechecks, corpus checks and builds.
The large pinned JSON assets are checked by explicit schema/digest gates rather than Biome's
default one-megabyte file limit.

The owner reported **passed** for the prepared Windows portable build at
`e78189376d389c7cc2e8e7887503fe8363fe67cd`, in response to the requested new/corrected
word lookup, phrase/rendering, report action and Stremio lookup checks. The optional authored
external SRT fixture covers representative words during the first 42 seconds. Local packaging
and both jobs of CI #594 passed at this head. This is owner-reported acceptance; no per-codec
inventory, database-version inspection or exhaustive bilingual/IPA approval is claimed.

The acceptance checklist remains available for future dataset updates:

1. Click new vocabulary such as `deepfake`, `gamified`, `decluttered`, `deplatformed`, and `weatherized`.
2. Check `wait`, `waited`, `waiting`, `love`, `loved`, `loving`, `going`, `running`, `saying`,
   `seeing`, `signed`, and `signing` in ordinary subtitle contexts.
3. Confirm Burmese meanings, IPA and POS groups render and scroll correctly.
4. Confirm phrase matching (for example `ran out of`) and old words/inflections still work.
5. Report an extension entry and verify successful receipt with the combined dictionary version.
6. Repeat word clicks with local/external subtitles and a Stremio/network subtitle source.

Automated provider/tokenizer checks are not recorded as real media or owner acceptance.
