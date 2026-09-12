import { AppShell } from './components/AppShell'
import { featureAreas } from './features'
import { PlaybackProof } from './features/playback/PlaybackProof'

export function App(): React.JSX.Element {
  return (
    <AppShell>
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">Windows desktop MVP</span>
        <h1 id="hero-title">Understand the word without leaving the movie.</h1>
        <p className="hero-copy">
          Subtitle Bridge will turn embedded English subtitle words into quick Burmese lookups while
          the video keeps its place.
        </p>
        <div className="hero-actions">
          <span className="build-note">
            Issue #2 is validating the media pipeline before the polished player UI is built.
          </span>
        </div>
      </section>

      <PlaybackProof />

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <span className="eyebrow">MVP architecture</span>
          <h2 id="foundation-title">Media first, then interactive subtitles and translation</h2>
        </div>
        <div className="runtime-pill" title="Provided through the secure preload bridge">
          Runtime: {window.desktop.platform}
        </div>
      </section>

      <div className="feature-grid">
        {featureAreas.map((feature) => (
          <article className="feature-card" key={feature.id}>
            <span className="feature-status">{feature.status}</span>
            <h3>{feature.label}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </div>
    </AppShell>
  )
}
