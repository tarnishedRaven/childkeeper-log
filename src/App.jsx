import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Families from './pages/Families'
import FamilyLogs from './pages/FamilyLogs'
import LogHours from './pages/LogHours'
import Invoices from './pages/Invoices'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import InstallAppPrompt from './components/InstallAppPrompt'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/families"
            element={
              <ProtectedRoute>
                <Families />
              </ProtectedRoute>
            }
          />
          <Route
            path="/families/:familyId/logs"
            element={
              <ProtectedRoute>
                <FamilyLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/log-hours"
            element={
              <ProtectedRoute>
                <LogHours />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route path="/reports" element={<Navigate to="/invoices" replace />} />

          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
        <InstallAppPrompt />
        <PwaUpdatePrompt />
      </AuthProvider>
    </Router>
  )
}

export default App
