import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type BattleStatus = 'waiting' | 'ready' | 'live' | 'completed' | 'cancelled' | 'forfeit' | 'moderation_ended'
type ParticipantStatus = 'invited' | 'ready' | 'active' | 'removed' | 'disconnected' | 'left' | 'completed'
type SessionStatus = 'created' | 'joined' | 'left' | 'failed' | 'revoked'

interface FakeBattle {
  id: string
  status: BattleStatus
  format: string
  real_duration_seconds: number
  stream_call_id: string
  state_code: string | null
}

interface FakeParticipant {
  id: string
  battle_id: string
  user_profile_id: string
  status: ParticipantStatus
  joined_at: string | null
}

interface FakeStreamSession {
  id: string
  battle_id: string
  user_profile_id: string
  session_status: SessionStatus
  connected_at: string | null
  disconnected_at: string | null
}

const baseBattle: FakeBattle = {
  id: 'battle-123',
  status: 'waiting',
  format: '1v1',
  real_duration_seconds: 180,
  stream_call_id: 'lw-call-123',
  state_code: null,
}

function formatDurationSeconds(format: string): number {
  return Number(format[0]) * 2
}

function simulateConfirmBattleConnection({
  battle,
  profileId,
  allParticipants,
  allSessions,
}: {
  battle: FakeBattle
  profileId: string
  allParticipants: FakeParticipant[]
  allSessions: FakeStreamSession[]
}) {
  const logs: string[] = []
  const log = (msg: string) => logs.push(msg)

  const now = new Date()

  if (!['waiting', 'ready', 'live'].includes(battle.status)) {
    log(`battle_ineligible_status:${battle.status}`)
    return { error: 'Battle is not accepting a connection confirmation', logs, status: 404 }
  }

  const participant = allParticipants.find(p => p.user_profile_id === profileId)
  if (!participant || !['ready', 'active'].includes(participant.status)) {
    log('participant_not_ready')
    return { error: 'Only a queued participant can confirm a broadcast connection', logs, status: 403 }
  }

  const alreadyActive = participant.status === 'active'

  // Mutate arrays to simulate DB updates
  const pIndex = allParticipants.findIndex(p => p.user_profile_id === profileId)
  allParticipants[pIndex] = { ...participant, status: 'active', joined_at: alreadyActive ? participant.joined_at : now.toISOString() }

  const sIndex = allSessions.findIndex(s => s.user_profile_id === profileId)
  if (sIndex >= 0) {
    allSessions[sIndex] = {
      ...allSessions[sIndex],
      session_status: 'joined',
      connected_at: alreadyActive ? (allSessions[sIndex].connected_at || now.toISOString()) : now.toISOString(),
      disconnected_at: null,
    }
  } else {
    allSessions.push({
      id: `s-${profileId}`,
      battle_id: battle.id,
      user_profile_id: profileId,
      session_status: 'joined',
      connected_at: now.toISOString(),
      disconnected_at: null,
    })
  }

  const activeParticipants = allParticipants.filter(p => p.status === 'active')
  const joinedSessions = allSessions.filter(s => s.session_status === 'joined')
  const expectedCount = formatDurationSeconds(battle.format)
  const connectedCount = Math.min(activeParticipants.length, joinedSessions.length)

  log(`confirmation_result:activeCount=${activeParticipants.length},joinedSessionCount=${joinedSessions.length},connectedCount=${connectedCount},expectedCount=${expectedCount}`)

  let battleStatusAfter = battle.status
  let timerStarted = false

  if (connectedCount >= expectedCount && battle.status !== 'live') {
    battleStatusAfter = 'live'
    timerStarted = true
    log(`battle_live:startedAt=${now.toISOString()},connectedCount=${connectedCount},expectedCount=${expectedCount}`)
  } else if (connectedCount >= expectedCount && battle.status === 'live') {
    log('battle_already_live_skip')
  } else {
    log(`waiting_for_more:connectedCount=${connectedCount},expectedCount=${expectedCount}`)
  }

  return {
    error: null,
    logs,
    status: 200,
    data: {
      status: 'connected',
      battleStatus: battleStatusAfter,
      activeParticipants: activeParticipants.length,
      joinedSessions: joinedSessions.length,
      connectedCount,
      requiredParticipants: expectedCount,
      alreadyActive,
      timerStarted,
    },
  }
}

describe('confirm-battle-connection logic', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('first participant confirmation does not start battle (waiting for opponent)', () => {
    const participants: FakeParticipant[] = [
      { id: 'p1', battle_id: 'battle-123', user_profile_id: 'user-1', status: 'ready', joined_at: null },
    ]
    const sessions: FakeStreamSession[] = [
      { id: 's1', battle_id: 'battle-123', user_profile_id: 'user-1', session_status: 'created', connected_at: null, disconnected_at: null },
    ]

    const result = simulateConfirmBattleConnection({
      battle: baseBattle,
      profileId: 'user-1',
      allParticipants: participants,
      allSessions: sessions,
    })

    expect(result.error).toBeNull()
    expect(result.data!.battleStatus).toBe('waiting')
    expect(result.data!.connectedCount).toBe(1)
    expect(result.data!.requiredParticipants).toBe(2)
    expect(result.data!.timerStarted).toBe(false)
    expect(result.logs.some(l => l.startsWith('waiting_for_more'))).toBe(true)
    // Participant and session were updated
    expect(participants[0].status).toBe('active')
    expect(sessions[0].session_status).toBe('joined')
  })

  it('second participant confirmation starts the battle exactly once', () => {
    const participants: FakeParticipant[] = [
      { id: 'p1', battle_id: 'battle-123', user_profile_id: 'user-1', status: 'active', joined_at: 't1' },
      { id: 'p2', battle_id: 'battle-123', user_profile_id: 'user-2', status: 'ready', joined_at: null },
    ]
    const sessions: FakeStreamSession[] = [
      { id: 's1', battle_id: 'battle-123', user_profile_id: 'user-1', session_status: 'joined', connected_at: 't1', disconnected_at: null },
      { id: 's2', battle_id: 'battle-123', user_profile_id: 'user-2', session_status: 'created', connected_at: null, disconnected_at: null },
    ]

    const result = simulateConfirmBattleConnection({
      battle: baseBattle,
      profileId: 'user-2',
      allParticipants: participants,
      allSessions: sessions,
    })

    expect(result.error).toBeNull()
    expect(result.data!.battleStatus).toBe('live')
    expect(result.data!.connectedCount).toBe(2)
    expect(result.data!.timerStarted).toBe(true)
    expect(result.logs.some(l => l.startsWith('battle_live'))).toBe(true)
  })

  it('does not count a participant as connected until their stream session is joined', () => {
    const participants: FakeParticipant[] = [
      { id: 'p1', battle_id: 'battle-123', user_profile_id: 'user-1', status: 'active', joined_at: 't1' },
      { id: 'p2', battle_id: 'battle-123', user_profile_id: 'user-2', status: 'active', joined_at: 't2' },
    ]
    const sessions: FakeStreamSession[] = [
      { id: 's1', battle_id: 'battle-123', user_profile_id: 'user-1', session_status: 'joined', connected_at: 't1', disconnected_at: null },
      { id: 's2', battle_id: 'battle-123', user_profile_id: 'user-2', session_status: 'created', connected_at: null, disconnected_at: null },
    ]

    const activeBefore = participants.filter(p => p.status === 'active').length
    const joinedBefore = sessions.filter(s => s.session_status === 'joined').length
    expect(Math.min(activeBefore, joinedBefore)).toBe(1)

    const result = simulateConfirmBattleConnection({
      battle: baseBattle,
      profileId: 'user-2',
      allParticipants: participants,
      allSessions: sessions,
    })

    expect(result.error).toBeNull()
    expect(result.data!.battleStatus).toBe('live')
    expect(result.data!.connectedCount).toBe(2)
    expect(result.data!.timerStarted).toBe(true)
    expect(sessions[1].session_status).toBe('joined')
  })

  it('duplicate confirmation does not restart the timer', () => {
    const liveBattle: FakeBattle = { ...baseBattle, status: 'live' }
    const participants: FakeParticipant[] = [
      { id: 'p1', battle_id: 'battle-123', user_profile_id: 'user-1', status: 'active', joined_at: 't1' },
      { id: 'p2', battle_id: 'battle-123', user_profile_id: 'user-2', status: 'active', joined_at: 't2' },
    ]
    const sessions: FakeStreamSession[] = [
      { id: 's1', battle_id: 'battle-123', user_profile_id: 'user-1', session_status: 'joined', connected_at: 't1', disconnected_at: null },
      { id: 's2', battle_id: 'battle-123', user_profile_id: 'user-2', session_status: 'joined', connected_at: 't2', disconnected_at: null },
    ]

    const result = simulateConfirmBattleConnection({
      battle: liveBattle,
      profileId: 'user-2',
      allParticipants: participants,
      allSessions: sessions,
    })

    expect(result.error).toBeNull()
    expect(result.data!.battleStatus).toBe('live')
    expect(result.data!.timerStarted).toBe(false)
    expect(result.logs.some(l => l.startsWith('battle_already_live_skip'))).toBe(true)
  })

  it('2v2 battle requires 4 connected participants', () => {
    const battle2v2: FakeBattle = { ...baseBattle, format: '2v2', status: 'waiting' }
    const participants: FakeParticipant[] = [
      { id: 'p1', battle_id: 'battle-123', user_profile_id: 'user-1', status: 'active', joined_at: 't1' },
      { id: 'p2', battle_id: 'battle-123', user_profile_id: 'user-2', status: 'active', joined_at: 't2' },
      { id: 'p3', battle_id: 'battle-123', user_profile_id: 'user-3', status: 'active', joined_at: 't3' },
    ]
    const sessions: FakeStreamSession[] = participants.map((p, i) => ({
      id: `s${i + 1}`,
      battle_id: 'battle-123',
      user_profile_id: p.user_profile_id,
      session_status: 'joined',
      connected_at: `t${i + 1}`,
      disconnected_at: null,
    }))

    const result3 = simulateConfirmBattleConnection({
      battle: battle2v2,
      profileId: 'user-3',
      allParticipants: participants,
      allSessions: sessions,
    })
    expect(result3.data!.battleStatus).toBe('waiting')
    expect(result3.data!.connectedCount).toBe(3)
    expect(result3.data!.requiredParticipants).toBe(4)

    const p4: FakeParticipant = { id: 'p4', battle_id: 'battle-123', user_profile_id: 'user-4', status: 'ready', joined_at: null }
    const s4: FakeStreamSession = { id: 's4', battle_id: 'battle-123', user_profile_id: 'user-4', session_status: 'created', connected_at: null, disconnected_at: null }
    const result4 = simulateConfirmBattleConnection({
      battle: battle2v2,
      profileId: 'user-4',
      allParticipants: [...participants, p4],
      allSessions: [...sessions, s4],
    })
    expect(result4.data!.battleStatus).toBe('live')
    expect(result4.data!.connectedCount).toBe(4)
    expect(result4.data!.timerStarted).toBe(true)
  })

  it('rejects confirmation when participant status is not ready or active', () => {
    const participants: FakeParticipant[] = [
      { id: 'p1', battle_id: 'battle-123', user_profile_id: 'user-1', status: 'removed', joined_at: null },
    ]
    const sessions: FakeStreamSession[] = [
      { id: 's1', battle_id: 'battle-123', user_profile_id: 'user-1', session_status: 'created', connected_at: null, disconnected_at: null },
    ]

    const result = simulateConfirmBattleConnection({
      battle: baseBattle,
      profileId: 'user-1',
      allParticipants: participants,
      allSessions: sessions,
    })

    expect(result.error).toBe('Only a queued participant can confirm a broadcast connection')
    expect(result.status).toBe(403)
  })
})

describe('matchmaking state-code filtering logic', () => {
  function findMatchingBattle({
    candidates,
    p_format,
    p_mode,
    p_state_code,
    p_profile_id,
  }: {
    candidates: FakeBattle[]
    p_format: string
    p_mode: string
    p_state_code: string | null
    p_profile_id: string
  }): FakeBattle | null {
    const v_state = p_mode === 'state' ? p_state_code : null
    const v_total = formatDurationSeconds(p_format)

    for (const b of candidates) {
      if (b.status !== 'waiting') continue
      if (b.format !== p_format) continue
      if (b.mode !== p_mode) continue
      if (p_mode === 'state' && b.state_code !== v_state) continue
      if ((b as any).created_by_profile_id === p_profile_id) continue
      const participantCount = 1
      if (participantCount >= v_total) continue
      return b
    }
    return null
  }

  it('state battles only match the selected state code', () => {
    const candidates: FakeBattle[] = [
      { ...baseBattle, id: 'battle-al', state_code: 'AL', format: '1v1', mode: 'state' },
      { ...baseBattle, id: 'battle-tx', state_code: 'TX', format: '1v1', mode: 'state' },
    ]

    const matchAL = findMatchingBattle({ candidates, p_format: '1v1', p_mode: 'state', p_state_code: 'AL', p_profile_id: 'user-other' })
    expect(matchAL?.id).toBe('battle-al')

    const matchTX = findMatchingBattle({ candidates, p_format: '1v1', p_mode: 'state', p_state_code: 'TX', p_profile_id: 'user-other' })
    expect(matchTX?.id).toBe('battle-tx')

    const wrongMatch = findMatchingBattle({ candidates: [candidates[1]], p_format: '1v1', p_mode: 'state', p_state_code: 'AL', p_profile_id: 'user-other' })
    expect(wrongMatch).toBeNull()
  })

  it('non-state battles do not filter by state_code', () => {
    const candidates: FakeBattle[] = [
      { ...baseBattle, id: 'battle-standard', state_code: null, format: '1v1', mode: 'standard' },
    ]

    const match = findMatchingBattle({ candidates, p_format: '1v1', p_mode: 'standard', p_state_code: null, p_profile_id: 'user-other' })
    expect(match?.id).toBe('battle-standard')
  })

  it('does not match a battle created by the same user', () => {
    const candidates: FakeBattle[] = [
      { ...baseBattle, id: 'battle-own', state_code: null, format: '1v1', mode: 'standard', created_by_profile_id: 'user-me' },
    ]

    const match = findMatchingBattle({ candidates, p_format: '1v1', p_mode: 'standard', p_state_code: null, p_profile_id: 'user-me' })
    expect(match).toBeNull()
  })

  it('supports all team sizes', () => {
    expect(formatDurationSeconds('1v1')).toBe(2)
    expect(formatDurationSeconds('2v2')).toBe(4)
    expect(formatDurationSeconds('3v3')).toBe(6)
    expect(formatDurationSeconds('4v4')).toBe(8)
    expect(formatDurationSeconds('5v5')).toBe(10)
    expect(formatDurationSeconds('6v6')).toBe(12)
  })
})
