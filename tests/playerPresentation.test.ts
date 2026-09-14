import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const playerCss = readFileSync(
  fileURLToPath(new URL('../src/renderer/src/features/playback/Player.css', import.meta.url)),
  'utf8',
)
const refinementCss = readFileSync(
  fileURLToPath(new URL('../src/renderer/src/features/playback/PlayerRefinement.css', import.meta.url)),
  'utf8',
)

describe('player presentation contracts', () => {
  it('keeps clickable subtitle targets stationary when chrome hides or reveals', () => {
    expect(refinementCss).not.toMatch(/\.chrome-hidden\s+\.subtitle-overlay\s*\{/)
    expect(playerCss).toMatch(/\.subtitle-overlay\s*\{[\s\S]*?bottom:\s*112px;/)
  })

  it('elevates the popup containing layer above player controls', () => {
    expect(playerCss).toMatch(/\.player-controls\s*\{[\s\S]*?z-index:\s*30;/)
    expect(refinementCss).toMatch(
      /\.subtitle-overlay:has\(\.translation-popup\)\s*\{[\s\S]*?z-index:\s*40;/,
    )
  })

  it('keeps the centered popup fixed within small viewports', () => {
    expect(refinementCss).toMatch(/\.translation-popup\s*\{[\s\S]*?position:\s*fixed;/)
    expect(refinementCss).toMatch(/max-height:\s*calc\(100vh - 36px\);/)
  })

  it('keeps the obsolete saved popup-position control out of the visible settings UI', () => {
    expect(refinementCss).toMatch(
      /\.translation-settings-grid\s*>\s*label:nth-of-type\(3\)\s*\{[\s\S]*?display:\s*none;/,
    )
  })
})
