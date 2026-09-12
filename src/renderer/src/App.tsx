import { AppShell } from './components/AppShell'
import { featureAreas } from './features'

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
          <button type="button" className="primary-action" disabled>
            Open video
          </button>
          <span className="build-note">Playback arrives in Issue #2.</span>
        </div>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div>
          <span className="eyebrow">Issue #1</span>
          <h2 id="foundation-title">Foundation ready for the media pipeline</h2>
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
