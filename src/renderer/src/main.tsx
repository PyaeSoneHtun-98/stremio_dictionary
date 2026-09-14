import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import './features/playback/PlayerRefinement.css'

const root = document.getElementById('root')
const mode = new URLSearchParams(window.location.search).get('mode')

if (mode === 'overlay') {
  document.documentElement.classList.add('overlay-mode')
}

if (!root) {
  throw new Error('Root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
