import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="Subtitle Bridge home">
          <span className="brand-mark" aria-hidden="true">
            SB
          </span>
          <span>
            <strong>Subtitle Bridge</strong>
            <small>Watch. Understand. Remember.</small>
          </span>
        </a>
        <span className="version-badge">Your personal cinema</span>
      </header>
      <main id="top">{children}</main>
    </div>
  )
}
