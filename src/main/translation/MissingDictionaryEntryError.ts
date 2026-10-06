export class MissingDictionaryEntryError extends Error {
  constructor() {
    super('No offline Burmese translation is available for this word yet.')
    this.name = 'MissingDictionaryEntryError'
  }
}
