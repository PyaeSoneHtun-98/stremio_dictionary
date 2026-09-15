import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  dictionaryStats,
  mergeDictionaryBatches,
  validateDictionaryBatchFile,
  validateDictionaryDocument
} from './dictionary-lib.mjs'

const [, , command, ...args] = process.argv

try {
  if (command === 'validate') {
    await validateFile(args[0] ?? 'src/main/translation/data/dictionary.json')
  } else if (command === 'build') {
    await buildDictionary(
      args[0] ?? 'dictionary/batches',
      args[1] ?? 'src/main/translation/data/dictionary.json'
    )
  } else {
    throw new Error(
      'Usage: node scripts/dictionary-tool.mjs <validate [file] | build [batch-dir] [output-file]>'
    )
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

async function validateFile(filePath) {
  const document = await readJson(filePath)
  validateDictionaryDocument(document, { source: filePath, requireBatch: false })
  const stats = dictionaryStats(document)

  console.log('Subtitle Bridge dictionary validation: PASS')
  console.log(`File: ${filePath}`)
  console.log(`Entries: ${stats.entries}`)
  console.log(`Forms: ${stats.forms}`)
  console.log(`Burmese meanings: ${stats.meanings}`)
}

async function buildDictionary(batchDirectory, outputFile) {
  const names = (await readdir(batchDirectory))
    .filter((name) => /^dictionary_batch_\d{3}\.json$/u.test(name))
    .sort((left, right) => left.localeCompare(right, 'en-US'))

  if (names.length === 0) {
    throw new Error(`No dictionary_batch_###.json files found in ${batchDirectory}.`)
  }

  const documents = []
  for (const name of names) {
    const source = path.join(batchDirectory, name)
    const document = await readJson(source)
    validateDictionaryBatchFile(name, document, { source })
    documents.push({ source, document })
  }

  const merged = mergeDictionaryBatches(documents)
  const stats = dictionaryStats(merged)

  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

  console.log('Subtitle Bridge dictionary build: PASS')
  console.log(`Batches: ${names.length}`)
  console.log(`Entries: ${stats.entries}`)
  console.log(`Forms: ${stats.forms}`)
  console.log(`Burmese meanings: ${stats.meanings}`)
  console.log(`Output: ${outputFile}`)
}

async function readJson(filePath) {
  let text
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    throw new Error(`Unable to read ${filePath}: ${error instanceof Error ? error.message : error}`)
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : error}`)
  }
}
