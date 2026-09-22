import { AppShell } from './components/AppShell'
import { PlaybackProof } from './features/playback/PlaybackProof'
import { PolishedOverlay } from './features/playback/PolishedOverlay'
import { SubtitleToolsOverlay } from './features/playback/SubtitleToolsOverlay'

export function App(): React.JSX.Element {
  if (new URLSearchParams(window.location.search).get('mode') === 'overlay') {
    return (
      <>
        <PolishedOverlay />
        <SubtitleToolsOverlay />
      </>
    )
  }

  return (
    <AppShell>
      <section className="launcher-hero" aria-labelledby="launcher-title">
        <div>
          <span className="eyebrow">Subtitle-first video player</span>
          <h1 id="launcher-title">Watch the story. Understand the words.</h1>
          <p>
            Open a video or send a stream from Stremio. Click English subtitle words and phrases
            for instant Burmese meanings without leaving the player.
          </p>
        </div>
        <div className="launcher-capabilities" aria-label="Subtitle Bridge capabilities">
          <span>30K word dictionary</span>
          <span>3K phrase dictionary</span>
          <span>Offline lookup</span>
        </div>
      </section>

      <PlaybackProof />

      <footer className="launcher-footer">
        <span>Subtitle Bridge</span>
        <span>English → Burmese · Windows</span>
      </footer>
    </AppShell>
  )
}
