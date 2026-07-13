import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import InstallAppPrompt from './components/InstallAppPrompt'

const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Families = lazy(() => import('./pages/Families'))
const FamilyLogs = lazy(() => import('./pages/FamilyLogs'))
const LogHours = lazy(() => import('./pages/LogHours'))
const Invoices = lazy(() => import('./pages/Invoices'))

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-figma-base" aria-hidden="true" />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

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
        </Suspense>
        <InstallAppPrompt />
        <PwaUpdatePrompt />
      </AuthProvider>
    </Router>
  )
}

export default App
