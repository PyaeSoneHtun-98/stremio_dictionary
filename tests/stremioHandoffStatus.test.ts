import { describe, expect, it } from 'vitest'
import {
  developmentStremioStatus,
  packagedStremioStatus,
  unknownPackagedStremioStatus,
} from '../src/main/stremio/status'

describe('Stremio handoff status mapping', () => {
  it('requires Disable then Enable when verified and repair-needed targets are mixed', () => {
    expect(
      packagedStremioStatus({
        enabled: false,
        repairNeeded: true,
        recordedTargets: 2,
        patchedTargets: 2,
        verifiedTargets: 1,
      }),
    ).toEqual({
      state: 'repair',
      message:
        'One or more Stremio handoff targets need repair. Disable the existing patches first, then Enable again to rebuild the integration.',
      canEnable: false,
      canDisable: true,
    })
  })

  it('does not offer Enable directly for a repair state because the helper patches only one discovered target', () => {
    expect(
      packagedStremioStatus({
        enabled: false,
        repairNeeded: true,
        recordedTargets: 1,
        patchedTargets: 1,
        verifiedTargets: 0,
      }),
    ).toMatchObject({
      state: 'repair',
      canEnable: false,
      canDisable: true,
    })
  })

  it('disables only redundant actions for clean enabled and disabled states', () => {
    expect(
      packagedStremioStatus({
        enabled: true,
        repairNeeded: false,
        recordedTargets: 1,
        patchedTargets: 1,
        verifiedTargets: 1,
      }),
    ).toMatchObject({
      state: 'enabled',
      canEnable: false,
      canDisable: true,
    })

    expect(
      packagedStremioStatus({
        enabled: false,
        repairNeeded: false,
        recordedTargets: 0,
        patchedTargets: 0,
        verifiedTargets: 0,
      }),
    ).toMatchObject({
      state: 'disabled',
      canEnable: true,
      canDisable: false,
    })
  })

  it('reports development as read-only unknown rather than comparing against electron.exe', () => {
    expect(developmentStremioStatus()).toMatchObject({
      state: 'unknown',
      canEnable: false,
      canDisable: false,
    })
  })

  it('keeps recovery actions available when packaged status inspection fails', () => {
    expect(unknownPackagedStremioStatus()).toMatchObject({
      state: 'unknown',
      canEnable: true,
      canDisable: true,
    })
  })
})
