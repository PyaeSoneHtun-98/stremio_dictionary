import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { Data, Format, NtExecutable, NtExecutableResource, Resource } from 'resedit'

function readResources(executablePath) {
  const executable = NtExecutable.from(readFileSync(executablePath), { ignoreCert: true })
  return { executable, resources: NtExecutableResource.from(executable) }
}

function digest(data) {
  return data === null ? null : createHash('sha256').update(Buffer.from(data)).digest('hex')
}

function otherResourceDigests(entries) {
  return entries
    .filter((entry) => entry.type !== 3 && entry.type !== 14)
    .map((entry) => ({
      type: entry.type,
      id: entry.id,
      lang: entry.lang,
      codepage: entry.codepage,
      digest: digest(entry.bin),
    }))
}

export function embedWindowsIcon(executablePath, iconPath) {
  const { executable, resources } = readResources(executablePath)
  const icons = Data.IconFile.from(readFileSync(iconPath)).icons.map((item) => item.data)
  const groups = Resource.IconGroupEntry.fromEntries(resources.entries)
  assert.ok(groups.length > 0, 'The base executable must contain an icon group.')
  const otherResources = otherResourceDigests(resources.entries)
  const sections = executable
    .getAllSections()
    .filter((section) => section.info.name !== '.rsrc')
    .map((section) => ({
      name: section.info.name,
      virtualAddress: section.info.virtualAddress,
      digest: digest(section.data),
    }))
  const machine = executable.newHeader.fileHeader.machine
  const entryPoint = executable.newHeader.optionalHeader.addressOfEntryPoint
  const resourceEntry = Format.ImageDirectoryEntry.Resource
  const resourceSize = executable.getSectionByEntry(resourceEntry).info.virtualSize

  // Replace every existing language/group so Windows cannot fall back to Electron artwork.
  for (const group of groups) {
    Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icons)
  }
  // Fit within the original allocation and retain its virtual size as well as its raw size.
  // Otherwise a smaller icon can move the following .reloc section despite allowShrink=false.
  resources.outputResource(executable, true, false)
  const generatedResource = executable.getSectionByEntry(resourceEntry)
  executable.setSectionByEntry(resourceEntry, {
    info: { ...generatedResource.info, virtualSize: resourceSize },
    data: generatedResource.data,
  })
  const output = Buffer.from(executable.generate())
  const rewritten = NtExecutable.from(output)
  const rewrittenResources = NtExecutableResource.from(rewritten)
  assert.deepEqual(
    otherResourceDigests(rewrittenResources.entries),
    otherResources,
    'Icon embedding must preserve manifests, version information and other resources.',
  )
  for (const section of sections) {
    const actual = rewritten.getAllSections().find((item) => item.info.name === section.name)
    assert.ok(actual, 'Icon embedding removed an executable section.')
    assert.equal(actual.info.virtualAddress, section.virtualAddress)
    assert.equal(
      digest(actual.data),
      section.digest,
      'Icon embedding changed a non-resource section.',
    )
  }
  assert.equal(rewritten.newHeader.fileHeader.machine, machine)
  assert.equal(rewritten.newHeader.optionalHeader.addressOfEntryPoint, entryPoint)
  writeFileSync(executablePath, output)
  assertEmbeddedWindowsIcon(executablePath, iconPath)
}

export function assertEmbeddedWindowsIcon(executablePath, iconPath) {
  const { resources } = readResources(executablePath)
  const expected = Data.IconFile.from(readFileSync(iconPath)).icons
  assert.deepEqual(
    expected.map((item) => item.data.width || 256),
    [16, 24, 32, 48, 64, 128, 256],
  )
  const groups = Resource.IconGroupEntry.fromEntries(resources.entries)
  assert.ok(groups.length > 0, 'Executable has no icon resource group.')
  for (const group of groups) {
    assert.equal(group.icons.length, expected.length, 'Executable is missing approved icon frames.')
    for (let index = 0; index < expected.length; index++) {
      const frame = group.icons[index]
      const wanted = expected[index].data
      assert.ok(wanted.isRaw(), 'Approved ICO frames must be lossless PNG data.')
      assert.equal(frame.width || 256, wanted.width || 256)
      assert.equal(frame.height || 256, wanted.height || 256)
      assert.equal(frame.bitCount, wanted.bitCount)
      const entry = resources.entries.find(
        (item) => item.type === 3 && item.id === frame.iconID && item.lang === group.lang,
      )
      assert.ok(entry, 'Icon group refers to a missing resource.')
      assert.deepEqual(
        Buffer.from(entry.bin),
        Buffer.from(wanted.bin),
        'Embedded icon differs from approved artwork.',
      )
    }
  }
}
