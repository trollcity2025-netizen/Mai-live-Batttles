import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'
import { InAppNotifications } from './InAppNotifications'

interface NotificationItem {
  id: string
  title: string
  body: string
  href: string
  created_at: string
  read_at: string | null
}

interface LimitResult {
  data: NotificationItem[] | null
  error: { message: string } | null
}

interface IsResult {
  count: number
  error: { message: string } | null
  data: null
}

interface UpdateResult {
  data: null
  error: { message: string } | null
}

const mockState = vi.hoisted(() => ({
  limitResult: { data: [] as NotificationItem[], error: null } as LimitResult,
  isResult: { count: 0, error: null, data: null } as IsResult,
  updateResult: { data: null, error: null } as UpdateResult,
}))

vi.mock('./lib/supabase', () => {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve(mockState.limitResult))
  chain.is = vi.fn(() => Promise.resolve(mockState.isResult))
  chain.update = vi.fn(() => Promise.resolve(mockState.updateResult))

  return {
    supabase: {
      from: vi.fn(() => chain),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
  }
})

const renderWithRouter = (ui: React.ReactNode) => render(<BrowserRouter>{ui}</BrowserRouter>)

describe('InAppNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.limitResult = { data: [], error: null }
    mockState.isResult = { count: 0, error: null, data: null }
    mockState.updateResult = { data: null, error: null }
  })

  it('renders the notification bell button', () => {
    renderWithRouter(<InAppNotifications profileId="profile-123" />)
    const bell = screen.getByRole('button', { name: /notifications/i })
    expect(bell).toBeTruthy()
  })

  it('opens the notification dropdown when the bell is clicked', async () => {
    const user = userEvent.setup()
    renderWithRouter(<InAppNotifications profileId="profile-123" />)
    const bell = screen.getByRole('button', { name: /notifications/i })
    await user.click(bell)
    expect(screen.getByText('Notifications')).toBeTruthy()
  })

  it('displays "No notifications yet" when there are no notifications', async () => {
    renderWithRouter(<InAppNotifications profileId="profile-123" />)
    const bell = screen.getByRole('button', { name: /notifications/i })
    await userEvent.setup().click(bell)
    await waitFor(() => {
      expect(screen.getByText('No notifications yet.')).toBeTruthy()
    })
  })

  it('displays the unread count badge when there are unread notifications', async () => {
    mockState.limitResult = {
      data: [
        { id: '1', title: 'Test', body: 'Test body', href: '/profile', created_at: '2026-01-01T00:00:00Z', read_at: null },
      ],
      error: null,
    }
    mockState.isResult = { count: 1, error: null, data: null }

    renderWithRouter(<InAppNotifications profileId="profile-123" />)
    await waitFor(() => {
      const badge = screen.getByText('1')
      expect(badge).toBeTruthy()
    })
  })

  it('displays an error message when notifications fail to load', async () => {
    mockState.limitResult = { data: null, error: { message: 'Network error' } }

    renderWithRouter(<InAppNotifications profileId="profile-123" />)
    const bell = screen.getByRole('button', { name: /notifications/i })
    await userEvent.setup().click(bell)
    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeTruthy()
    })
  })
})