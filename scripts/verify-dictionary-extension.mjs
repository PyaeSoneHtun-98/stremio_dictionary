import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  dictionaryStats,
  normalizeDictionaryKey,
  validateDictionaryDocument,
} from './dictionary-lib.mjs'

const directory = 'src/main/translation/data/'
const expectedExtensionHash = '53b42c8c45a5bf0e956deed2d1764d0b40381edf88e141c5591461522b45f8cd'
const expectedCorrectionHash = '8861989797ef5855acdffcc55245f508a260889548af69cb87efa445d486726f'
const bytes = await readFile(`${directory}dictionary-extension.json`)
if (createHash('sha256').update(bytes).digest('hex') !== expectedExtensionHash) {
  throw new Error('Pinned dictionary extension SHA-256 mismatch.')
}
const extension = validateDictionaryDocument(JSON.parse(bytes.toString('utf8')))
const stats = dictionaryStats(extension)
if (stats.entries !== 5000 || stats.forms !== 3783 || stats.meanings !== 5329) {
  throw new Error('Pinned dictionary extension counts do not match batches 061–070.')
}
const base = JSON.parse(await readFile(`${directory}dictionary.json`, 'utf8'))
const baseKeys = new Set(
  base.entries.flatMap((entry) => [entry.word, ...entry.forms]).map(normalizeDictionaryKey),
)
for (const entry of extension.entries) {
  if ([entry.word, ...entry.forms].some((key) => baseKeys.has(normalizeDictionaryKey(key)))) {
    throw new Error('Dictionary extension overlaps the frozen base lookup namespace.')
  }
}
const correctionBytes = await readFile(`${directory}dictionary-extension-corrections.json`)
if (createHash('sha256').update(correctionBytes).digest('hex') !== expectedCorrectionHash) {
  throw new Error(
    'Reviewed dictionary corrections SHA-256 mismatch; update the corpus revision after review.',
  )
}
const corrections = validateDictionaryDocument(JSON.parse(correctionBytes.toString('utf8')))
const correctionMap = new Map(corrections.entries.map((entry) => [entry.word, entry]))
const rawByWord = new Map(extension.entries.map((entry) => [entry.word, entry]))
for (const correction of corrections.entries) {
  const original = rawByWord.get(correction.word)
  if (!original || original.forms.some((form) => !correction.forms.includes(form))) {
    throw new Error(
      'Extension corrections must target existing entries and preserve original forms.',
    )
  }
}
validateDictionaryDocument({
  version: 1,
  entries: [
    ...base.entries,
    ...extension.entries.map((entry) => correctionMap.get(entry.word) ?? entry),
  ],
})
console.log(
  'Dictionary extension verified: 5,000 headwords; frozen-base namespace disjoint; corrections validated.',
)
