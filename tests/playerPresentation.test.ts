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
const polishedOverlaySource = readFileSync(
  fileURLToPath(
    new URL('../src/renderer/src/features/playback/PolishedOverlay.tsx', import.meta.url),
  ),
  'utf8',
)
const subtitleToolsSource = readFileSync(
  fileURLToPath(
    new URL('../src/renderer/src/features/playback/SubtitleToolsOverlay.tsx', import.meta.url),
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
      /@media \(max-width: 720px\)[\s\S]*?\.overlay-probe \.subtitle-overlay\s*\{[\s\S]*?bottom:\s*calc\(104px \+ var\(--subtitle-position-offset, 0px\)\);/,
    )
    expect(subtitleToolsCss).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.overlay-probe\.chrome-hidden \.subtitle-overlay\s*\{[\s\S]*?bottom:\s*calc\(24px \+ var\(--subtitle-position-offset, 0px\)\);/,
    )
    expect(subtitleToolsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.overlay-probe \.subtitle-overlay\s*\{[\s\S]*?transition:\s*none;/,
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

  it('keeps audio selection wired into the shared tracks panel without a pause gate', () => {
    expect(polishedOverlaySource).toContain('aria-label="Audio and subtitle tracks"')
    expect(polishedOverlaySource).toContain('aria-label="Audio track"')
    expect(polishedOverlaySource).toContain('window.desktop.media.selectAudioTrack(trackId)')
    expect(polishedOverlaySource).toContain(
      'const canChangeAudioTrack = canControl && audioTracks.length > 0',
    )
  })

  it('keeps the CC panel compact and expands subtitle settings only on demand', () => {
    expect(subtitleToolsSource).not.toContain('subtitle-tools-toggle')
    expect(subtitleToolsSource).not.toContain('Subtitle controls')
    expect(polishedOverlaySource).toContain("' compact-tracks-panel'")
    expect(polishedOverlaySource).toContain('Choose subtitle file')
    expect(polishedOverlaySource).toContain('Subtitle settings')
    expect(polishedOverlaySource).toContain('aria-expanded={subtitleSettingsOpen}')
    expect(polishedOverlaySource).toContain('{subtitleSettingsOpen ? (')
    expect(polishedOverlaySource).toContain('aria-label="Decrease subtitle delay"')
    expect(polishedOverlaySource).toContain('aria-label="Increase subtitle delay"')
    expect(polishedOverlaySource).toContain('aria-label="Decrease subtitle size"')
    expect(polishedOverlaySource).toContain('aria-label="Increase subtitle size"')
    expect(polishedOverlaySource).toContain('aria-label="Move subtitles lower"')
    expect(polishedOverlaySource).toContain('aria-label="Move subtitles higher"')
    expect(polishedOverlaySource).toContain('aria-label="Subtitle delay"')
    expect(polishedOverlaySource).toContain('aria-label="Subtitle font size"')
    expect(polishedOverlaySource).toContain('aria-label="Subtitle vertical position"')
    expect(polishedOverlaySource).not.toContain('type="range"\n                          min={-20}')
    expect(polishedOverlaySource).toContain('aria-label="Audio track"')
    expect(polishedOverlaySource).not.toContain(
      'Text subtitles are clickable. Image subtitles are listed as unsupported.',
    )
  })

  it('uses the keyboard icon for tracks and removes the standalone shortcuts button', () => {
    expect(polishedOverlaySource).toMatch(
      /aria-label="Audio and subtitle tracks"[\s\S]*?<PlayerIcon name="keyboard" \/>/,
    )
    expect(polishedOverlaySource).not.toContain("panel === 'help'")
    expect(polishedOverlaySource).not.toContain("togglePanel('help'")
    expect(polishedOverlaySource).not.toContain('className="icon-button help-button"')
  })

  it('keeps playback speed and keyboard shortcuts as collapsible settings rows', () => {
    expect(polishedOverlaySource).toContain('aria-label="Settings"')
    expect(polishedOverlaySource).toContain('<span>Playback speed</span>')
    expect(polishedOverlaySource).toContain("settingsSection === 'speed'")
    expect(polishedOverlaySource).toContain('className="playback-speed-menu"')
    expect(polishedOverlaySource).toContain('<span>Keyboard shortcuts</span>')
    expect(polishedOverlaySource).toContain("settingsSection === 'shortcuts'")
    expect(polishedOverlaySource).toContain('className="shortcut-list compact-shortcut-list"')
    expect(polishedOverlaySource).not.toContain('className="speed-control"')
  })
})
