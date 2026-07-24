import React from 'react'
import ReactDOM from 'react-dom/client'

/** Версия сборки (меняет хэш бандла — сброс кэша ассетов) */
console.info('Tetik build 2026-07-24.2')
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import { FavProvider } from './lib/favs'
import './lib/i18n'
import './styles/index.css'

// тема: сохранённая или системная
const savedTheme = localStorage.getItem('tetik-theme')
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.dataset.theme = 'dark'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FavProvider>
          <App />
        </FavProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
