import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const directory = 'src/main/translation/data/'
const bytes = await readFile(`${directory}phrases-extension.json`)
const expectedHash = '26a932d88b8bda52638de7eaf2bc1adb78e0b36099250fa8523f550853ffbb85'
if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) {
  throw new Error('Pinned phrase extension SHA-256 mismatch.')
}
const extension = JSON.parse(bytes.toString('utf8'))
const base = JSON.parse(await readFile(`${directory}phrases.json`, 'utf8'))
if (extension.version !== 1 || extension.entries.length !== 1000) {
  throw new Error('Pinned phrase extension must contain 1,000 entries with schema version 1.')
}
const normalize = (key) => key.normalize('NFKC').trim().toLocaleLowerCase('en-US')
const keys = new Set(base.entries.flatMap((entry) => [entry.phrase, ...entry.forms]).map(normalize))
let forms = 0
let meanings = 0
for (const entry of extension.entries) {
  if (
    !['phrasal_verb', 'idiom', 'expression'].includes(entry.type) ||
    !Array.isArray(entry.forms) || !Array.isArray(entry.burmese) ||
    entry.burmese.length < 1 || entry.burmese.length > 3 ||
    entry.burmese.some((meaning) => typeof meaning !== 'string' || !meaning.trim())
  ) throw new Error('Invalid phrase extension entry.')
  for (const surface of [entry.phrase, ...entry.forms]) {
    const normalized = normalize(surface)
    const tokens = normalized.split(' ').length
    if (normalized !== surface || tokens < 2 || tokens > 5 || keys.has(normalized)) {
      throw new Error('Phrase extension has an invalid or duplicate base/extension key.')
    }
    keys.add(normalized)
  }
  forms += entry.forms.length
  meanings += entry.burmese.length
}
if (forms !== 2682 || meanings !== 1164 || keys.size !== 11509) {
  throw new Error('Pinned phrase extension counts do not match batches 013–016.')
}
console.log('Phrase extension verified: 1,000 phrases, 2,682 forms; frozen-base namespace disjoint.')
