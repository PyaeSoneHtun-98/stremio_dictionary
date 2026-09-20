import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const EXPECTED_SHA256 = 'fcdb26986ed62bfaa130732ed0e88cc2e30bbc7f964b4b16de47f809783ed325'
const EXPECTED_VERSION = 1
const EXPECTED_HEADWORDS = 30_000

const dictionaryPath = resolve('src/main/translation/data/dictionary.json')
const bytes = await readFile(dictionaryPath)
const actualSha256 = createHash('sha256').update(bytes).digest('hex')

if (actualSha256 !== EXPECTED_SHA256) {
  throw new Error(
    `Production dictionary SHA-256 mismatch: expected ${EXPECTED_SHA256}, got ${actualSha256}`
  )
}

const document = JSON.parse(bytes.toString('utf8'))
if (document.version !== EXPECTED_VERSION) {
  throw new Error(
    `Production dictionary version mismatch: expected ${EXPECTED_VERSION}, got ${document.version}`
  )
}

if (!Array.isArray(document.entries) || document.entries.length !== EXPECTED_HEADWORDS) {
  throw new Error(
    `Production dictionary entry count mismatch: expected ${EXPECTED_HEADWORDS}, got ${document.entries?.length}`
  )
}

console.log(
  `Production dictionary verified: v${EXPECTED_VERSION}, ${EXPECTED_HEADWORDS.toLocaleString('en-US')} headwords, SHA-256 ${EXPECTED_SHA256}`
)
