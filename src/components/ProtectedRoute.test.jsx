import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import * as authContext from '../context/AuthContext'

vi.mock('../context/AuthContext')

function TestComponent() {
  return <div>Protected Content</div>
}

describe('ProtectedRoute', () => {
  it('should show loading spinner while loading', () => {
    authContext.useAuth.mockReturnValue({
      user: null,
      loading: true,
    })

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    )

    // Check for the loading spinner div
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('should redirect to login if not authenticated', () => {
    authContext.useAuth.mockReturnValue({
      user: null,
      loading: false,
    })

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    )

    // Should redirect, not show content
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('should render children if authenticated', () => {
    authContext.useAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      loading: false,
    })

    render(
      <BrowserRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </BrowserRouter>
    )

    expect(screen.getByText('Protected Content')).toBeDefined()
  })
})
