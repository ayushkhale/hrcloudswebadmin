import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import api from './api'

// Route helper to only allow authenticated users
function ProtectedRoute({ children }) {
  const hasAccessToken = !!api.accessToken
  const hasFallbackToken = !!localStorage.getItem('fallback_refresh_token')
  const hasStoredUser = !!localStorage.getItem('user')

  if (!hasAccessToken && !hasFallbackToken && !hasStoredUser) {
    return <Navigate to="/login" replace />
  }
  return children
}

// Route helper to prevent authenticated users from re-visiting login
function PublicRoute({ children }) {
  const hasAccessToken = !!api.accessToken
  const hasFallbackToken = !!localStorage.getItem('fallback_refresh_token')
  const hasStoredUser = !!localStorage.getItem('user')

  if (hasAccessToken || hasFallbackToken || hasStoredUser) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function App() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      try {
        await api.checkSessionPersistence()
      } catch (e) {
        console.error('Failed to restore session on boot:', e)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const handleAuthLogout = () => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    window.addEventListener('auth-logout', handleAuthLogout)
    return () => {
      window.removeEventListener('auth-logout', handleAuthLogout)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f5fc]">
        <div className="w-10 h-10 border-4 border-[#9333ea]/20 border-t-[#9333ea] rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-[#22143a] uppercase tracking-wider">
          Restoring your session...
        </p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
