import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const globalCss = readFileSync(
  fileURLToPath(new URL('../src/renderer/src/styles.css', import.meta.url)),
  'utf8',
)
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
    expect(polishedOverlaySource).toContain('className="translation-popup-position-setting"')
    expect(playerCss).toMatch(
      /\.translation-settings-grid \.translation-popup-position-setting\s*\{[\s\S]*?display:\s*none;/,
    )
  })

  it('keeps the Google translation view compact and integrated', () => {
    expect(polishedOverlaySource).toContain("{ value: 'google', label: 'Google Translate' }")
    expect(polishedOverlaySource).toContain('className="translation-google-section"')
    expect(polishedOverlaySource).toContain('className="translation-api-key-control"')
    expect(polishedOverlaySource).toContain('className="translation-inline-action"')
    expect(polishedOverlaySource).toContain('className="translation-text-action"')
    expect(polishedOverlaySource).toContain('Session cache <strong>{settings.cacheEntries}</strong>')
    expect(playerCss).toMatch(
      /\.translation-google-section\s*\{[\s\S]*?padding:\s*10px;[\s\S]*?border-radius:\s*12px;/,
    )
    expect(playerCss).toMatch(
      /\.translation-api-key-control\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto;/,
    )
    expect(playerCss).toMatch(
      /\.translation-inline-action\s*\{[\s\S]*?min-width:\s*56px;[\s\S]*?height:\s*36px;/,
    )
  })

  it('keeps visible translation settings content padded inside its card', () => {
    expect(playerCss).toMatch(
      /\.translation-settings-panel\s*\{[\s\S]*?padding:\s*14px;[\s\S]*?border-radius:\s*15px;/,
    )
    expect(playerCss).toMatch(
      /\.translation-settings-grid\s*\{[\s\S]*?gap:\s*10px;/,
    )
    expect(playerCss).not.toMatch(
      /\.translation-settings-panel\s*\{[^}]*padding:\s*0\s*;[^}]*\}/,
    )
  })

  it('keeps audio selection wired into the shared tracks panel without a pause gate', () => {
    expect(polishedOverlaySource).toContain('aria-label="Audio and subtitle tracks"')
    expect(polishedOverlaySource).toContain('ariaLabel="Audio track"')
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
    expect(polishedOverlaySource).toContain('ariaLabel="Audio track"')
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

  it('uses in-app dropdown menus instead of native visible selects', () => {
    expect(polishedOverlaySource).toContain('function AppSelect({')
    expect(polishedOverlaySource).toContain('className="app-select-trigger"')
    expect(polishedOverlaySource).toContain('className="app-select-menu"')
    expect(polishedOverlaySource).toContain('role="listbox"')
    expect(polishedOverlaySource).toContain('ariaLabel="Translation provider"')
    expect(polishedOverlaySource).toContain('ariaLabel="Target language"')
    expect(polishedOverlaySource).toContain('ariaLabel="Embedded subtitle track"')
    expect(polishedOverlaySource).toContain('ariaLabel="Audio track"')
    expect(playerCss).toMatch(
      /\.app-select-menu\s*\{[\s\S]*?background:[\s\S]*?rgb\(10 18 24 \/ 0\.94\);[\s\S]*?box-shadow:/,
    )
  })

  it('centers back, play-pause, and forward controls independently of side controls', () => {
    expect(polishedOverlaySource).toMatch(
      /className="playback-center-controls"[\s\S]*?name="back"[\s\S]*?className="icon-button play-button"[\s\S]*?name=\{playing \? 'pause' : 'play'\}[\s\S]*?name="forward"/,
    )
    expect(polishedOverlaySource).toContain('className="control-left-controls"')
    expect(polishedOverlaySource).toContain('className="control-right-controls"')
    expect(playerCss).toMatch(
      /\.control-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\);/,
    )
    expect(playerCss).toMatch(
      /\.playback-center-controls\s*\{[\s\S]*?justify-self:\s*center;/,
    )
  })

  it('keeps the main player chrome compact and floating', () => {
    expect(playerCss).toMatch(
      /\.player-controls\s*\{[\s\S]*?inset:\s*auto 12px 10px;[\s\S]*?padding:\s*9px 12px 8px;[\s\S]*?border-radius:\s*17px;[\s\S]*?backdrop-filter:\s*blur\(18px\)/,
    )
    expect(playerCss).toMatch(
      /\.overlay-topline\s*\{[\s\S]*?top:\s*12px;[\s\S]*?left:\s*14px;[\s\S]*?border-radius:\s*999px;[\s\S]*?backdrop-filter:\s*blur\(14px\)/,
    )
    expect(playerCss).toMatch(
      /\.icon-button,[\s\S]*?\.translation-popup-close\s*\{[\s\S]*?flex:\s*0 0 34px;[\s\S]*?width:\s*34px;[\s\S]*?height:\s*34px;/,
    )
    expect(playerCss).toMatch(
      /\.play-button\s*\{[\s\S]*?flex-basis:\s*42px;[\s\S]*?width:\s*42px;[\s\S]*?height:\s*42px;/,
    )
  })

  it('uses a lighter timeline and smaller volume footprint', () => {
    expect(playerCss).toMatch(
      /\.timeline-slider::-webkit-slider-runnable-track\s*\{[\s\S]*?height:\s*2px;/,
    )
    expect(playerCss).toMatch(
      /\.timeline-slider::-webkit-slider-thumb\s*\{[\s\S]*?height:\s*10px;[\s\S]*?width:\s*10px;/,
    )
    expect(playerCss).toMatch(
      /\.volume-control\s*\{[\s\S]*?gap:\s*7px;[\s\S]*?width:\s*96px;/,
    )
    expect(polishedOverlaySource).not.toContain('className="volume-value"')
  })

  it('uses modern glass popovers and card-style menu sections', () => {
    expect(playerCss).toMatch(
      /\.player-panel\s*\{[\s\S]*?width:\s*min\(336px,[\s\S]*?border-radius:\s*20px;[\s\S]*?backdrop-filter:\s*blur\(24px\)/,
    )
    expect(playerCss).toMatch(
      /\.compact-settings-menu\s*\{[\s\S]*?border-radius:\s*15px;[\s\S]*?background:\s*rgb\(255 255 255 \/ 0\.026\);/,
    )
    expect(playerCss).toMatch(
      /\.compact-tracks-section\s*\{[\s\S]*?border-radius:\s*14px;[\s\S]*?background:\s*rgb\(255 255 255 \/ 0\.026\);/,
    )
    expect(playerCss).toMatch(
      /\.playback-speed-menu\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\);/,
    )
    expect(playerCss).toMatch(
      /\.app-select-trigger\s*\{[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*11px;[\s\S]*?background:\s*rgb\(4 10 14 \/ 0\.42\);/,
    )
    expect(playerCss).toMatch(
      /\.app-select-menu\s*\{[\s\S]*?border-radius:\s*14px;[\s\S]*?backdrop-filter:\s*blur\(20px\)/,
    )
  })

  it('uses one thin app-colored scrollbar style across launcher and player surfaces', () => {
    expect(globalCss).toMatch(/\*::-webkit-scrollbar\s*\{[\s\S]*?width:\s*8px;[\s\S]*?height:\s*8px;/)
    expect(globalCss).toMatch(
      /\*::-webkit-scrollbar-thumb\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?background:\s*rgb\(126 168 150 \/ 0\.52\);/,
    )
    expect(globalCss).toMatch(
      /\*::-webkit-scrollbar-thumb:hover\s*\{[\s\S]*?background:\s*rgb\(181 230 209 \/ 0\.72\);/,
    )
    expect(globalCss).toContain('scrollbar-width: thin')
  })
})
