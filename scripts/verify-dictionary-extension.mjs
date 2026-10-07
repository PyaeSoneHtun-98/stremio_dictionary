import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  dictionaryStats,
  normalizeDictionaryKey,
  validateDictionaryDocument,
} from './dictionary-lib.mjs'

const directory = 'src/main/translation/data/'
const expectedExtensionHash = '2c0818ba6d5d835af2a28a5d2a98c0a96b6414d0af2c252bf9caf32a1bc16086'
const expectedCorrectionHash = 'a12cd2cffe7da1ee3d43f7f8757b410df73dbfbf908bf4c199585adea8c9d145'
const bytes = await readFile(`${directory}dictionary-extension.json`)
if (createHash('sha256').update(bytes).digest('hex') !== expectedExtensionHash) {
  throw new Error('Pinned dictionary extension SHA-256 mismatch.')
}
const extension = validateDictionaryDocument(JSON.parse(bytes.toString('utf8')))
const stats = dictionaryStats(extension)
if (stats.entries !== 10000 || stats.forms !== 6361 || stats.meanings !== 10980) {
  throw new Error('Pinned dictionary extension counts do not match batches 061–080.')
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
  'Dictionary extension verified: 10,000 headwords; frozen-base namespace disjoint; corrections validated.',
)
