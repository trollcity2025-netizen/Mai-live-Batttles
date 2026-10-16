import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

vi.mock('@stream-io/video-react-sdk', () => ({
  ParticipantView: ({ participant }: { participant: any }) => (
    <div
      data-testid="mock-participant-view"
      data-userid={String(participant?.userId)}
      data-sessionid={String(participant?.sessionId)}
    >
      {`video:${participant?.userId}`}
    </div>
  ),
  ParticipantsAudio: () => null,
  StreamVideo: ({ children }: { children: ReactElement }) => children,
  StreamCall: ({ children }: { children: ReactElement }) => children,
  useCallStateHooks: () => ({
    useParticipants: () => [],
    useRawParticipants: () => [],
  }),
}))

import { UniversalBattleArena } from './App'

type Fighter = {
  team: 'A' | 'B'
  stateCode: string | null
  name: string
  status: string
  avatarUrl?: string | null
}

const participant = (userId: string, sessionId: string): any => ({ userId, sessionId })

const assignments = (fighters: Record<string, Fighter>) => fighters

const renderArena = (props: {
  teamAssignments: Record<string, Fighter>
  format?: string
  participantsPerTeam?: number
  participantsByUserId?: Map<string, any>
  ownProfileId?: string
}) =>
  render(
    <UniversalBattleArena
      teamAssignments={props.teamAssignments}
      format={props.format ?? '1v1'}
      participantsPerTeam={props.participantsPerTeam ?? 1}
      mode="standard"
      ownProfileId={props.ownProfileId ?? 'user-a'}
      ownStateCode="TX"
      participantsByUserId={props.participantsByUserId ?? new Map()}
    />,
  )

describe('UniversalBattleArena dual video rendering', () => {
  it('renders both teams independently from the roster, never marking a rostered fighter absent', () => {
    const { container } = renderArena({
      teamAssignments: assignments({
        'user-a': { team: 'A', stateCode: null, name: 'Alpha', status: 'ready' },
        'user-b': { team: 'B', stateCode: null, name: 'Bravo', status: 'ready' },
      }),
      participantsByUserId: new Map([['user-b', participant('user-b', 's1')]]),
    })

    expect(container.querySelectorAll('.sdk-participant-card')).toHaveLength(2)
    expect(container).toHaveTextContent('Alpha')
    expect(container).toHaveTextContent('Bravo')
    expect(container.querySelector('[data-testid="mock-participant-view"]')?.getAttribute('data-userid')).toBe('user-b')
    expect(container).not.toHaveTextContent('Fighter 1 · Waiting')
  })

  it('shows a waiting box with the fighter name instead of "Waiting" when the RTC track has not arrived', () => {
    const { container } = renderArena({
      teamAssignments: assignments({
        'user-a': { team: 'A', stateCode: null, name: 'Alpha', status: 'ready' },
        'user-b': { team: 'B', stateCode: null, name: 'Bravo', status: 'ready' },
      }),
    })

    expect(container).toHaveTextContent('Bravo')
    expect(container.querySelector('.sdk-participant-video-pending')).toBeTruthy()
    expect(container).not.toHaveTextContent('Bravo · Waiting')
    expect(container).not.toHaveTextContent('Fighter 1 · Waiting')
  })

  it('shows "Fighter N · Waiting" only for completely empty unrostered slots', () => {
    const { container } = renderArena({
      teamAssignments: assignments({
        'user-a': { team: 'A', stateCode: null, name: 'Alpha', status: 'ready' },
      }),
    })

    expect(container).toHaveTextContent('Alpha')
    expect(container.querySelector('[data-testid="mock-participant-view"]')).toBeNull()
    expect(container).toHaveTextContent('Fighter 1 · Waiting')
  })

  it('displays a video track for each team when both participants are present', () => {
    const { container } = renderArena({
      teamAssignments: assignments({
        'user-a': { team: 'A', stateCode: null, name: 'Alpha', status: 'ready' },
        'user-b': { team: 'B', stateCode: null, name: 'Bravo', status: 'ready' },
      }),
      participantsByUserId: new Map([
        ['user-a', participant('user-a', 's1')],
        ['user-b', participant('user-b', 's2')],
      ]),
    })

    const views = container.querySelectorAll('[data-testid="mock-participant-view"]')
    expect(views).toHaveLength(2)
    expect(Array.from(views).map((v) => v.getAttribute('data-userid'))).toEqual(['user-a', 'user-b'])
  })

  it('remounts the participant card when the track session is replaced (reconnect / track replacement)', () => {
    const { container, rerender } = renderArena({
      teamAssignments: assignments({
        'user-a': { team: 'A', stateCode: null, name: 'Alpha', status: 'ready' },
        'user-b': { team: 'B', stateCode: null, name: 'Bravo', status: 'ready' },
      }),
      participantsByUserId: new Map([['user-b', participant('user-b', 's1')]]),
    })

    expect(container.querySelector('[data-testid="mock-participant-view"]')?.getAttribute('data-sessionid')).toBe('s1')

    rerender(
      <UniversalBattleArena
        teamAssignments={assignments({
          'user-a': { team: 'A', stateCode: null, name: 'Alpha', status: 'ready' },
          'user-b': { team: 'B', stateCode: null, name: 'Bravo', status: 'ready' },
        })}
        format="1v1"
        participantsPerTeam={1}
        mode="standard"
        ownProfileId="user-a"
        ownStateCode="TX"
        participantsByUserId={new Map([['user-b', participant('user-b', 's2')]])}
      />,
    )

    expect(container.querySelector('[data-testid="mock-participant-view"]')?.getAttribute('data-sessionid')).toBe('s2')
  })

  it('renders all slots for 6v6 with both teams independent', () => {
    const fighters: Record<string, Fighter> = {}
    for (let i = 0; i < 6; i++) {
      fighters[`a${i}`] = { team: 'A', stateCode: null, name: `A${i + 1}`, status: 'ready' }
      fighters[`b${i}`] = { team: 'B', stateCode: null, name: `B${i + 1}`, status: 'ready' }
    }
    const { container } = renderArena({
      teamAssignments: fighters,
      format: '6v6',
      participantsPerTeam: 6,
    })

    expect(container.querySelectorAll('.tile-team-a')).toHaveLength(6)
    expect(container.querySelectorAll('.tile-team-b')).toHaveLength(6)
    for (let i = 0; i < 6; i++) {
      expect(container).toHaveTextContent(`A${i + 1}`)
      expect(container).toHaveTextContent(`B${i + 1}`)
    }
  })
})
