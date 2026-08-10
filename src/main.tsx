import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/primitives.css'
import './styles/print.css'

const container = document.getElementById('root')
if (!container) throw new Error('MealHelp could not find its mount point.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
