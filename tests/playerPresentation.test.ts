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
const subtitleToolsCss = readFileSync(
  fileURLToPath(
    new URL('../src/renderer/src/features/playback/SubtitleToolsOverlay.css', import.meta.url),
  ),
  'utf8',
)

describe('player presentation contracts', () => {
  it('moves subtitles lower when player chrome hides while preserving the saved offset', () => {
    expect(subtitleToolsCss).toMatch(
      /\.overlay-probe \.subtitle-overlay\s*\{[\s\S]*?bottom:\s*calc\(112px \+ var\(--subtitle-position-offset, 0px\)\);[\s\S]*?transition:\s*bottom 180ms ease;/,
    )
    expect(subtitleToolsCss).toMatch(
      /\.overlay-probe\.chrome-hidden \.subtitle-overlay\s*\{[\s\S]*?bottom:\s*calc\(32px \+ var\(--subtitle-position-offset, 0px\)\);/,
    )
    expect(subtitleToolsCss).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.overlay-probe\.chrome-hidden \.subtitle-overlay\s*\{[\s\S]*?bottom:\s*calc\(24px \+ var\(--subtitle-position-offset, 0px\)\);/,
    )
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

  it('keeps visible top chrome hit-testable while disabling it when chrome is hidden', () => {
    expect(playerCss).toMatch(/\.overlay-topline\s*\{[\s\S]*?pointer-events:\s*auto;/)
    expect(playerCss).toMatch(
      /\.chrome-hidden \.player-controls,[\s\S]*?\.chrome-hidden \.overlay-topline\s*\{[\s\S]*?pointer-events:\s*none;/,
    )
  })

  it('keeps the obsolete saved popup-position control out of the visible settings UI', () => {
    expect(refinementCss).toMatch(
      /\.translation-settings-grid\s*>\s*label:nth-of-type\(3\)\s*\{[\s\S]*?display:\s*none;/,
    )
  })
})
