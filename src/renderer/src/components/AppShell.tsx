import type { PropsWithChildren } from 'react'
import appIcon from '../../../../assets/branding/subtitle-bridge-icon.svg'
import { appMeta } from '../../../shared/appMeta'

export function AppShell({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img className="brand-mark" src={appIcon} width="32" height="32" alt="" />
          <span>
            <strong>Subtitle Bridge</strong>
            <small>Interactive subtitle player</small>
          </span>
        </div>

        <div className="app-header-meta">
          <span className="desktop-ready">
            <span aria-hidden="true" />
            Ready
          </span>
          <span className="version-badge">v{appMeta.version}</span>
        </div>
      </header>
      <main id="top">{children}</main>
    </div>
  )
}
