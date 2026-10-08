import { app } from 'electron'
import { join } from 'node:path'

export function getAppIconPath(): string {
  return join(
    app.getAppPath(),
    'assets',
    'branding',
    process.platform === 'win32' ? 'subtitle-bridge-icon.ico' : 'subtitle-bridge-icon.png',
  )
}
