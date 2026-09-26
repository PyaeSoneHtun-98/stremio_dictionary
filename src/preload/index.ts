import { contextBridge, ipcRenderer, type IpcRendererEvent, webUtils } from 'electron'
import type { DesktopBridge, PlaybackSnapshot } from '../shared/media'
import type { UpdateSnapshot } from '../shared/update'

const desktopBridge: DesktopBridge = {
  platform: process.platform,
  media: {
    openVideo: () => ipcRenderer.invoke('media:open-video'),
    openVideoPath: (filePath) => ipcRenderer.invoke('media:open-video-path', filePath),
    getPathForFile: (file) =>
      webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]),
    openExternalSubtitle: () => ipcRenderer.invoke('media:open-external-subtitle'),
    loadExternalSubtitlePath: (filePath) =>
      ipcRenderer.invoke('media:load-external-subtitle-path', filePath),
    getState: () => ipcRenderer.invoke('media:get-state'),
    getDoubleClickInterval: () => ipcRenderer.invoke('media:get-double-click-interval'),
    setPaused: (paused) => ipcRenderer.invoke('media:set-paused', paused),
    seek: (seconds) => ipcRenderer.invoke('media:seek', seconds),
    setVolume: (volume) => ipcRenderer.invoke('media:set-volume', volume),
    setSpeed: (speed) => ipcRenderer.invoke('media:set-speed', speed),
    setSubtitleDelay: (seconds) => ipcRenderer.invoke('media:set-subtitle-delay', seconds),
    selectSubtitleTrack: (trackId) => ipcRenderer.invoke('media:select-subtitle-track', trackId),
    getSubtitlePreferences: () => ipcRenderer.invoke('media:get-subtitle-preferences'),
    updateSubtitlePreferences: (update) =>
      ipcRenderer.invoke('media:update-subtitle-preferences', update),
    toggleFullscreen: () => ipcRenderer.invoke('media:toggle-fullscreen'),
    onState: (listener) => {
      const subscription = (_event: IpcRendererEvent, state: PlaybackSnapshot): void => listener(state)
      ipcRenderer.on('media:state', subscription)

      return () => ipcRenderer.removeListener('media:state', subscription)
    }
  },
  update: {
    getState: () => ipcRenderer.invoke('update:get-state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onState: (listener) => {
      const subscription = (_event: IpcRendererEvent, state: UpdateSnapshot): void => listener(state)
      ipcRenderer.on('update:state', subscription)
      return () => ipcRenderer.removeListener('update:state', subscription)
    }
  },
  stremio: {
    getHandoffStatus: () => ipcRenderer.invoke('stremio:get-handoff-status'),
    enableHandoff: () => ipcRenderer.invoke('stremio:enable-handoff'),
    disableHandoff: () => ipcRenderer.invoke('stremio:disable-handoff')
  },
  translation: {
    translateWord: (request) => ipcRenderer.invoke('translation:translate-word', request),
    getSettings: () => ipcRenderer.invoke('translation:get-settings'),
    updateSettings: (update) => ipcRenderer.invoke('translation:update-settings', update),
    clearCache: () => ipcRenderer.invoke('translation:clear-cache')
  }
}

contextBridge.exposeInMainWorld('desktop', Object.freeze(desktopBridge))
