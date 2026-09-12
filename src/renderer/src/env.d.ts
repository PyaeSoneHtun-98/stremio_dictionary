/// <reference types="vite/client" />

import type { DesktopBridge } from '../../shared/media'

declare global {
  interface Window {
    desktop: DesktopBridge
  }
}

export {}
