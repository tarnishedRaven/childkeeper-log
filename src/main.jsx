import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const CHUNK_RELOAD_KEY = 'chunk-reload-attempted'

function getErrorMessage(errorLike) {
  if (!errorLike) {
    return ''
  }

  if (typeof errorLike === 'string') {
    return errorLike
  }

  return String(errorLike.message || errorLike.reason?.message || errorLike.reason || '')
}

function isChunkLoadErrorMessage(message) {
  const normalized = String(message || '').toLowerCase()
  return (
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('importing a module script failed') ||
    normalized.includes('chunkloaderror') ||
    normalized.includes('loading chunk')
  )
}

function tryRecoverFromChunkLoadError(message) {
  if (!isChunkLoadErrorMessage(message)) {
    return
  }

  try {
    const hasReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === 'true'
    if (!hasReloaded) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true')
      window.location.reload()
    }
  } catch {
    // Ignore storage/reload edge cases.
  }
}

if (!import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    tryRecoverFromChunkLoadError(getErrorMessage(event.error || event.message))
  })

  window.addEventListener('unhandledrejection', (event) => {
    tryRecoverFromChunkLoadError(getErrorMessage(event.reason))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
