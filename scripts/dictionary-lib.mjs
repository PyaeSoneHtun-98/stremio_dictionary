export const DICTIONARY_PARTS_OF_SPEECH = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'determiner',
  'modal',
  'auxiliary'
])

export const DICTIONARY_BATCH_SIZE = 500

export function normalizeDictionaryKey(value) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US')
}

export function validateDictionaryBatchSequence(fileNames) {
  for (const [index, fileName] of fileNames.entries()) {
    const expected = `dictionary_batch_${String(index + 1).padStart(3, '0')}.json`
    if (fileName !== expected) {
      throw new Error(
        `Dictionary batches must be contiguous from 001: expected ${expected}, found ${fileName}.`
      )
    }
  }
  return fileNames
}

export function validateDictionaryBatchFile(fileName, document, options = {}) {
  const { source = fileName } = options
  const match = /^dictionary_batch_(\d{3})\.json$/u.exec(fileName)
  if (!match) {
    throw new Error(`${source}: batch filename must match dictionary_batch_###.json.`)
  }

  validateDictionaryDocument(document, { source, requireBatch: true })

  const expectedBatch = Number(match[1])
  if (document.batch !== expectedBatch) {
    throw new Error(
      `${source}: filename declares batch ${expectedBatch}, but JSON declares batch ${document.batch}.`
    )
  }

  if (document.entries.length !== DICTIONARY_BATCH_SIZE) {
    throw new Error(
      `${source}: expected exactly ${DICTIONARY_BATCH_SIZE} entries, found ${document.entries.length}.`
    )
  }

  return document
}

export function validateDictionaryDocument(document, options = {}) {
  const { source = 'dictionary', requireBatch = false } = options

  if (!isPlainObject(document)) {
    throw new Error(`${source}: top-level value must be an object.`)
  }
  if (document.version !== 1) {
    throw new Error(`${source}: version must be 1.`)
  }
  if (requireBatch && (!Number.isInteger(document.batch) || document.batch < 1)) {
    throw new Error(`${source}: batch must be a positive integer.`)
  }
  if (!Array.isArray(document.entries)) {
    throw new Error(`${source}: entries must be an array.`)
  }

  const headwords = new Map()

  for (const [index, entry] of document.entries.entries()) {
    validateEntry(entry, `${source}: entries[${index}]`)

    const headwordKey = normalizeDictionaryKey(entry.word)
    const existing = headwords.get(headwordKey)
    if (existing) {
      throw new Error(`${source}: duplicate headword “${entry.word}”.`)
    }
    headwords.set(headwordKey, entry.word)
  }

  const formOwners = new Map()

  for (const entry of document.entries) {
    const headwordKey = normalizeDictionaryKey(entry.word)
    const localForms = new Set()

    for (const form of entry.forms) {
      const formKey = normalizeDictionaryKey(form)
      if (localForms.has(formKey)) {
        throw new Error(`${source}: “${entry.word}” contains duplicate form “${form}”.`)
      }
      localForms.add(formKey)

      if (formKey === headwordKey) {
        throw new Error(`${source}: “${entry.word}” must not include itself in forms.`)
      }

      // A real headword always wins over another entry's inflected form. This is common in
      // English (for example: warn -> warning, while warning is also its own headword).
      const exactHeadword = headwords.get(formKey)
      if (exactHeadword && exactHeadword !== entry.word) {
        continue
      }

      addFormOwner(formOwners, formKey, entry.word, source, form)
    }
  }

  return document
}

export function mergeDictionaryBatches(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error('At least one dictionary batch is required.')
  }

  const batches = new Set()
  const items = []

  for (const item of documents) {
    const source = item.source ?? `batch ${item.document?.batch ?? '?'}`
    const document = validateDictionaryDocument(item.document, { source, requireBatch: true })

    if (batches.has(document.batch)) {
      throw new Error(`Duplicate batch number ${document.batch}.`)
    }
    batches.add(document.batch)

    for (const entry of document.entries) {
      items.push({ entry, source })
    }
  }

  const headwords = new Map()

  for (const { entry, source } of items) {
    const headwordKey = normalizeDictionaryKey(entry.word)
    const existingHeadword = headwords.get(headwordKey)
    if (existingHeadword) {
      throw new Error(
        `Duplicate headword “${entry.word}” across ${existingHeadword.source} and ${source}.`
      )
    }
    headwords.set(headwordKey, { source, word: entry.word })
  }

  const formOwners = new Map()

  for (const { entry, source } of items) {
    for (const form of entry.forms) {
      const formKey = normalizeDictionaryKey(form)
      const exactHeadword = headwords.get(formKey)

      // Exact dictionary entries take precedence over forms, regardless of batch order.
      if (exactHeadword && exactHeadword.word !== entry.word) {
        continue
      }

      addFormOwner(formOwners, formKey, entry.word, source, form)
    }
  }

  const entries = items.map(({ entry }) => entry)
  entries.sort((left, right) => left.word.localeCompare(right.word, 'en-US'))

  return {
    version: 1,
    entries
  }
}

export function dictionaryStats(document) {
  let forms = 0
  let meanings = 0

  for (const entry of document.entries) {
    forms += entry.forms.length
    meanings += entry.meanings.reduce((total, meaning) => total + meaning.burmese.length, 0)
  }

  return {
    entries: document.entries.length,
    forms,
    meanings
  }
}

function validateEntry(entry, source) {
  if (!isPlainObject(entry)) {
    throw new Error(`${source}: entry must be an object.`)
  }

  requireNonEmptySingleWord(entry.word, `${source}.word`)

  if (typeof entry.pronunciation !== 'string' || !entry.pronunciation.trim()) {
    throw new Error(`${source}: pronunciation must be a non-empty string.`)
  }
  if (!/^\/.+\/$/.test(entry.pronunciation.trim())) {
    throw new Error(`${source}: pronunciation must use slash-delimited IPA.`)
  }

  if (!Array.isArray(entry.forms)) {
    throw new Error(`${source}: forms must be an array.`)
  }
  for (const [formIndex, form] of entry.forms.entries()) {
    requireNonEmptySingleWord(form, `${source}.forms[${formIndex}]`)
  }

  if (!Array.isArray(entry.meanings) || entry.meanings.length === 0) {
    throw new Error(`${source}: meanings must contain at least one part-of-speech group.`)
  }

  const partsOfSpeech = new Set()
  let semanticMeaningCount = 0

  for (const [meaningIndex, meaning] of entry.meanings.entries()) {
    const meaningSource = `${source}.meanings[${meaningIndex}]`
    if (!isPlainObject(meaning)) {
      throw new Error(`${meaningSource}: meaning must be an object.`)
    }
    if (!DICTIONARY_PARTS_OF_SPEECH.has(meaning.partOfSpeech)) {
      throw new Error(`${meaningSource}: unsupported partOfSpeech “${meaning.partOfSpeech}”.`)
    }
    if (partsOfSpeech.has(meaning.partOfSpeech)) {
      throw new Error(
        `${source}: duplicate partOfSpeech “${meaning.partOfSpeech}”; group same-POS meanings together.`
      )
    }
    partsOfSpeech.add(meaning.partOfSpeech)

    if (!Array.isArray(meaning.burmese) || meaning.burmese.length === 0) {
      throw new Error(`${meaningSource}: burmese must contain at least one meaning.`)
    }

    const localMeanings = new Set()
    for (const [burmeseIndex, burmese] of meaning.burmese.entries()) {
      if (typeof burmese !== 'string' || !burmese.trim()) {
        throw new Error(`${meaningSource}.burmese[${burmeseIndex}]: value must be non-empty.`)
      }
      const normalized = burmese.normalize('NFKC').trim()
      if (localMeanings.has(normalized)) {
        throw new Error(`${meaningSource}: duplicate Burmese meaning “${burmese}”.`)
      }
      localMeanings.add(normalized)
      semanticMeaningCount += 1
    }
  }

  if (semanticMeaningCount > 3) {
    throw new Error(`${source}: maximum 3 Burmese semantic meanings are allowed per headword.`)
  }
}

function requireNonEmptySingleWord(value, source) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${source}: value must be a non-empty string.`)
  }
  if (/\s/u.test(value.trim())) {
    throw new Error(`${source}: v1 supports single-word entries/forms only.`)
  }
}

function addFormOwner(formOwners, key, headword, source, displayKey = key) {
  const existing = formOwners.get(key)
  if (existing && existing.headword !== headword) {
    throw new Error(
      `Form collision for “${displayKey}”: form of “${existing.headword}” (${existing.source}) conflicts with form of “${headword}” (${source}).`
    )
  }
  formOwners.set(key, { headword, source })
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
