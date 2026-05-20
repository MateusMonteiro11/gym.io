import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'

import { AuthProvider } from './contexts/AuthContext'
import { UiProvider } from './contexts/UiContext'

import './styles/index.css'

ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <UiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiProvider>
  </React.StrictMode>
)