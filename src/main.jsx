import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/common.css'
import './styles/archive/index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'

const base = import.meta.env.BASE_URL
document.documentElement.style.setProperty('--banner-desktop', `url('${base}banner-desktop.webp')`)
document.documentElement.style.setProperty('--banner-tablet', `url('${base}banner-tablet.webp')`)
document.documentElement.style.setProperty('--banner-phone', `url('${base}banner-phone.webp')`)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
    <App />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
