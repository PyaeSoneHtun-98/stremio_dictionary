import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DesktopBridge, PlaybackSnapshot } from '../shared/media'

const desktopBridge: DesktopBridge = {
  platform: process.platform,
  media: {
    openVideo: () => ipcRenderer.invoke('media:open-video'),
    getState: () => ipcRenderer.invoke('media:get-state'),
    onState: (listener) => {
      const subscription = (_event: IpcRendererEvent, state: PlaybackSnapshot): void => listener(state)
      ipcRenderer.on('media:state', subscription)

      return () => ipcRenderer.removeListener('media:state', subscription)
    }
  }
}

contextBridge.exposeInMainWorld('desktop', Object.freeze(desktopBridge))
