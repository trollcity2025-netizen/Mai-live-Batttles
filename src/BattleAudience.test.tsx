import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BattleAudience } from './BattleAudience'

interface Viewer {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
  bio: string | null
  stateCode: string | null
  connectedAt: string | null
  following: boolean
  followsYou: boolean
}

interface InvokeResult {
  data: { viewerCount: number; viewers: Viewer[] } | null
  error: { message: string } | null
}

const mockState = vi.hoisted(() => ({
  invokeResult: { data: { viewerCount: 0, viewers: [] as Viewer[] }, error: null } as InvokeResult,
  insertResult: { data: null, error: null },
  deleteResult: { data: null, error: null },
  singleResult: { data: { id: 'profile-1' }, error: null },
  listResult: { data: [], error: null },
}))

vi.mock('./lib/supabase', () => {
  const chain: any = {}
  chain.insert = vi.fn(() => Promise.resolve(mockState.insertResult))
  chain.delete = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(mockState.singleResult))
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => Promise.resolve(mockState.listResult))

  return {
    supabase: {
      functions: {
        invoke: vi.fn(() => Promise.resolve(mockState.invokeResult)),
      },
      from: vi.fn(() => chain),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
  }
})

const mockProfile = {
  id: 'profile-1',
  user_id: 'user-1',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  bio: null,
  gender: null,
  city: null,
  state_code: 'CA',
  role: 'user' as const,
  profile_complete: true,
  marketing_recording_consent: false,
}

describe('BattleAudience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.invokeResult = { data: { viewerCount: 0, viewers: [] }, error: null }
  })

  it('renders the audience section with a live indicator', () => {
    render(<BattleAudience battleId="battle-1" profile={mockProfile} />)
    const audience = screen.getByLabelText('Battle audience')
    expect(audience).toBeTruthy()
    expect(screen.getByText('watching')).toBeTruthy()
  })

  it('displays "No viewer profiles yet" when there are no viewers', async () => {
    render(<BattleAudience battleId="battle-1" profile={mockProfile} />)
    await waitFor(() => {
      expect(screen.getByText('No viewer profiles yet')).toBeTruthy()
    })
  })

  it('displays viewer count when viewers are present', async () => {
    mockState.invokeResult = {
      data: {
        viewerCount: 3,
        viewers: [
          { id: 'v1', displayName: 'Viewer One', username: 'viewer1', avatarUrl: null, bio: null, stateCode: 'TX', connectedAt: null, following: false, followsYou: false },
          { id: 'v2', displayName: 'Viewer Two', username: 'viewer2', avatarUrl: null, bio: null, stateCode: 'NY', connectedAt: null, following: false, followsYou: false },
          { id: 'v3', displayName: 'Viewer Three', username: 'viewer3', avatarUrl: null, bio: null, stateCode: 'FL', connectedAt: null, following: false, followsYou: false },
        ],
      },
      error: null,
    }

    render(<BattleAudience battleId="battle-1" profile={mockProfile} />)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy()
      expect(screen.getByText('watching')).toBeTruthy()
    })
  })

  it('displays an error indicator when viewers fail to load', async () => {
    mockState.invokeResult = {
      data: null,
      error: { message: 'Failed to load' },
    }

    render(<BattleAudience battleId="battle-1" profile={mockProfile} />)
    await waitFor(() => {
      expect(screen.getByText('Audience unavailable')).toBeTruthy()
    })
  })
})