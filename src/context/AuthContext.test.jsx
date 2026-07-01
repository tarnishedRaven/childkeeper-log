import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import * as authModule from 'firebase/auth'

vi.mock('firebase/auth')

// Test component
function TestComponent() {
  const { user, loading, error } = useAuth()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (user) return <div>User: {user.email}</div>
  return <div>No user</div>
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide user from auth state', async () => {
    const mockUser = { email: 'test@example.com', uid: '123' }
    authModule.onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(mockUser)
      return vi.fn()
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/User: test@example.com/)).toBeDefined()
    })
  })

  it('should show loading state initially', () => {
    authModule.onAuthStateChanged.mockImplementation((auth, callback) => {
      return vi.fn()
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('should show no user when not authenticated', async () => {
    authModule.onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null)
      return vi.fn()
    })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeDefined()
    })
  })

  it('should throw error if useAuth used outside AuthProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within AuthProvider')

    consoleSpy.mockRestore()
  })
})
