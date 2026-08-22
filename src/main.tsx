import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyAppearance, rememberedAppearance } from './app/themes'
import './styles/tokens.css'
import './styles/base.css'
import './styles/primitives.css'
import './styles/print.css'

// Before the first paint, so a dark theme never flashes the default paper.
applyAppearance(rememberedAppearance())

const container = document.getElementById('root')
if (!container) throw new Error('MealHelp could not find its mount point.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
