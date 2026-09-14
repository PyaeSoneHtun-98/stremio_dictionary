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

Validate the currently built runtime dictionary with:

```bash
npm run dictionary:validate
```

When batch files are present, merge and validate them with:

```bash
npm run dictionary:build
```

The build command validates every batch, rejects duplicate headwords and lookup-form collisions across batches, sorts headwords deterministically, and writes the merged runtime dataset to `src/main/translation/data/dictionary.json`.

Do not manually concatenate batch JSON files.
