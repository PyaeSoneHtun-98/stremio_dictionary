# Dictionary batches

Place generated dictionary source files in this directory using zero-padded names:

```text
dictionary_batch_001.json
dictionary_batch_002.json
...
dictionary_batch_060.json
```

Each file must use the agreed v1 batch shape:

```json
{
  "version": 1,
  "batch": 1,
  "entries": []
}
```

Each batch must contain exactly 500 entries, and the JSON `batch` number must match the filename. For example, `dictionary_batch_023.json` must contain `"batch": 23`.

Validate the currently built runtime dictionary with:

```bash
npm run dictionary:validate
```

When batch files are present, merge and validate them with:

```bash
npm run dictionary:build
```

The build command validates every batch, rejects duplicate headwords and ambiguous form-vs-form collisions across batches, sorts headwords deterministically, and writes the merged runtime dataset to `src/main/translation/data/dictionary.json`. A legitimate exact headword is allowed to overlap another entry's inflected form; the exact headword takes precedence at lookup time.

Do not manually concatenate batch JSON files.
