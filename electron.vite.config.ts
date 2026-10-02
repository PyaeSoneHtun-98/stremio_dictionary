import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.SUBTITLE_BRIDGE_REPORT_ENDPOINT': JSON.stringify(
        process.env.SUBTITLE_BRIDGE_REPORT_ENDPOINT ??
          loadEnv(mode, process.cwd(), 'SUBTITLE_BRIDGE_').SUBTITLE_BRIDGE_REPORT_ENDPOINT ??
          '',
      ),
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
}))
