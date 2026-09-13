import { AppShell } from './components/AppShell'
import { PlaybackProof } from './features/playback/PlaybackProof'
import { PolishedOverlay } from './features/playback/PolishedOverlay'

export function App(): React.JSX.Element {
  if (new URLSearchParams(window.location.search).get('mode') === 'overlay')
    return <PolishedOverlay />
  return (
    <AppShell>
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">A little closer to every word</span>
        <h1 id="hero-title">
          Your movie.
          <br />
          <span>A new way to understand.</span>
        </h1>
        <p className="hero-copy">
          Watch, click a subtitle word, and discover its meaning in Burmese. Stay in the story.
        </p>
      </section>
      <PlaybackProof />
      <footer className="launcher-footer">
        <span>Made for curious viewers.</span>
        <span>English → Burmese · Offline dictionary</span>
      </footer>
    </AppShell>
  )
}
