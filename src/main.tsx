import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Antes do app: define qual nota (v1/v2) vale para cada dia.
import './lib/scoring-activation'
import './index.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
