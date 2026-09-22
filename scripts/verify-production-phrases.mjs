import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const EXPECTED_SHA256 = '951a8bbe54824cf76728393791607798f878a062b19eca63e572278ba8f62926'
const EXPECTED_VERSION = 1
const EXPECTED_PHRASES = 3_000
const EXPECTED_FORMS = 4_827
const EXPECTED_LOOKUP_KEYS = 7_827
const EXPECTED_MEANINGS = 4_092
const ALLOWED_TYPES = new Set(['phrasal_verb', 'idiom', 'expression'])

const phrasePath = resolve('src/main/translation/data/phrases.json')
const bytes = await readFile(phrasePath)
const actualSha256 = createHash('sha256').update(bytes).digest('hex')

if (actualSha256 !== EXPECTED_SHA256) {
  throw new Error(
    `Production phrase dictionary SHA-256 mismatch: expected ${EXPECTED_SHA256}, got ${actualSha256}`
  )
}

const document = JSON.parse(bytes.toString('utf8'))
if (document.version !== EXPECTED_VERSION) {
  throw new Error(
    `Production phrase dictionary version mismatch: expected ${EXPECTED_VERSION}, got ${document.version}`
  )
}

if (!Array.isArray(document.entries) || document.entries.length !== EXPECTED_PHRASES) {
  throw new Error(
    `Production phrase count mismatch: expected ${EXPECTED_PHRASES}, got ${document.entries?.length}`
  )
}

let storedForms = 0
let meanings = 0
const lookupKeys = new Set()

for (const [index, entry] of document.entries.entries()) {
  const where = `entry ${index + 1}`
  if (
    !entry ||
    typeof entry !== 'object' ||
    typeof entry.phrase !== 'string' ||
    !Array.isArray(entry.forms) ||
    !Array.isArray(entry.burmese) ||
    !ALLOWED_TYPES.has(entry.type)
  ) {
    throw new Error(`Invalid production phrase schema at ${where}`)
  }

  if (entry.burmese.length < 1 || entry.burmese.length > 3) {
    throw new Error(`Invalid Burmese meaning count at ${where}: ${entry.phrase}`)
  }

  for (const meaning of entry.burmese) {
    if (typeof meaning !== 'string' || !meaning.trim()) {
      throw new Error(`Empty Burmese meaning at ${where}: ${entry.phrase}`)
    }
  }

  meanings += entry.burmese.length
  storedForms += entry.forms.length

  for (const surface of [entry.phrase, ...entry.forms]) {
    if (typeof surface !== 'string') {
      throw new Error(`Invalid phrase surface at ${where}: ${entry.phrase}`)
    }

    const normalized = normalizeKey(surface)
    const tokenCount = normalized.split(' ').length
    if (tokenCount < 2 || tokenCount > 5) {
      throw new Error(
        `Production phrase surface must contain 2-5 tokens at ${where}: ${surface}`
      )
    }

    if (lookupKeys.has(normalized)) {
      throw new Error(`Duplicate production phrase lookup key: ${normalized}`)
    }
    lookupKeys.add(normalized)
  }
}

if (storedForms !== EXPECTED_FORMS) {
  throw new Error(
    `Production phrase form count mismatch: expected ${EXPECTED_FORMS}, got ${storedForms}`
  )
}

if (lookupKeys.size !== EXPECTED_LOOKUP_KEYS) {
  throw new Error(
    `Production phrase lookup-key count mismatch: expected ${EXPECTED_LOOKUP_KEYS}, got ${lookupKeys.size}`
  )
}

if (meanings !== EXPECTED_MEANINGS) {
  throw new Error(
    `Production phrase meaning count mismatch: expected ${EXPECTED_MEANINGS}, got ${meanings}`
  )
}

console.log(
  `Production phrase dictionary verified: v${EXPECTED_VERSION}, ${EXPECTED_PHRASES.toLocaleString('en-US')} phrases, ${EXPECTED_FORMS.toLocaleString('en-US')} forms, ${EXPECTED_LOOKUP_KEYS.toLocaleString('en-US')} lookup keys, SHA-256 ${EXPECTED_SHA256}`
)

function normalizeKey(value) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').split(/\s+/).join(' ')
}
