import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Garantir que HashRouter tem uma rota válida ao carregar
if (!window.location.hash || window.location.hash === '#') {
  window.location.hash = '#/dashboard';
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
