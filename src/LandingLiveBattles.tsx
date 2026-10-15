import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Database } from './lib/database.types'
import './landing-live-battles.css'

type BattleRow = Pick<
  Database['public']['Tables']['battles']['Row'],
  'id' | 'format' | 'mode' | 'team_a_score' | 'team_b_score' | 'viewer_count' | 'started_at'
>
type ParticipantRow = Pick<Database['public']['Tables']['battle_participants']['Row'], 'battle_id' | 'team' | 'state_code'>
type LiveBattle = BattleRow & { teamAStates: string[]; teamBStates: string[] }

export function LandingLiveBattles() {
  const [battles, setBattles] = useState<LiveBattle[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    const db = supabase
    if (!db) return

    let active = true
    let requestId = 0

    const loadBattles = async () => {
      const currentRequestId = ++requestId
      setLoading(true)
      const { data, error: battleError } = await db
        .from('battles')
        .select('id,format,mode,team_a_score,team_b_score,viewer_count,started_at')
        .eq('is_test', false)
        .eq('status', 'live')
        .order('started_at', { ascending: false })

      if (!active || currentRequestId !== requestId) return
      if (battleError) {
        console.error('[Landing live battles] Could not load live battles', battleError)
        setError('Live battles could not be loaded right now.')
        setLoading(false)
        return
      }

      const battleRows: BattleRow[] = data || []
      const ids = battleRows.map((battle) => battle.id)
      const { data: participants, error: participantError } = ids.length
        ? await db.from('battle_participants')
          .select('battle_id,team,state_code')
          .in('battle_id', ids)
          .eq('status', 'active')
        : { data: [] as ParticipantRow[], error: null }

      if (!active || currentRequestId !== requestId) return
      if (participantError) {
        console.error('[Landing live battles] Could not load live battle participants', participantError)
        setError('Live battles could not be loaded right now.')
        setLoading(false)
        return
      }

      const statesByBattle = new Map<string, { a: string[]; b: string[] }>()
      for (const participant of participants || []) {
        if (!participant.state_code) continue
        const summary = statesByBattle.get(participant.battle_id) || { a: [], b: [] }
        const teamStates = participant.team === 'A' ? summary.a : summary.b
        if (!teamStates.includes(participant.state_code)) teamStates.push(participant.state_code)
        statesByBattle.set(participant.battle_id, summary)
      }

      setBattles(battleRows.map((battle) => {
        const summary = statesByBattle.get(battle.id)
        return { ...battle, teamAStates: summary?.a || [], teamBStates: summary?.b || [] }
      }))
      setError('')
      setLoading(false)
    }

    void loadBattles()
    const channel = db.channel('landing-live-battles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battles' }, () => { void loadBattles() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'battle_participants' }, () => { void loadBattles() })
      .subscribe()

    return () => {
      active = false
      void db.removeChannel(channel)
    }
  }, [])

  return <section className="landing-live" aria-labelledby="landing-live-title">
    <div className="landing-live-heading">
      <div>
        <span className="eyebrow">MAI LIVE WARZ · THE ARENA RIGHT NOW</span>
        <h2 id="landing-live-title">Live <span>battles.</span></h2>
        <p>Real creators. Real-time matchups. Catch the action while it’s happening.</p>
      </div>
      <div className="landing-live-indicator" aria-live="polite">
        <span className="live-dot" />
        {loading ? 'Checking the arena' : `${battles.length} live now`}
      </div>
    </div>

    {error && <div className="landing-live-message" role="alert">{error}</div>}
    {!error && !loading && battles.length === 0 && <div className="landing-live-empty">
      <span className="landing-live-empty-mark">VS</span>
      <div><strong>The arena is warming up.</strong><p>Live battles will appear here as soon as the next matchup begins.</p></div>
    </div>}
    {battles.length > 0 && <div className="landing-live-grid">
      {battles.map((battle, index) => <article className={`landing-live-card landing-live-card-${index % 4}`} key={battle.id}>
        <div className="landing-live-card-art" aria-hidden="true"><span>LIVE</span><strong>{battle.format}</strong><small>MAI LIVE WARZ</small></div>
        <div className="landing-live-card-content">
          <div className="landing-live-card-top"><span className="landing-live-tag"><i /> LIVE NOW</span><span>{battle.format} · {battle.mode.replaceAll('_', ' ')}</span></div>
          <div className="landing-live-score">
            <div><strong>TEAM A</strong><small>{battle.mode === 'state' ? battle.teamAStates.join(' · ') || 'State team' : 'Creators'}</small></div>
            <b>{battle.team_a_score}</b><span>VS</span><b>{battle.team_b_score}</b>
            <div className="landing-live-team-b"><strong>TEAM B</strong><small>{battle.mode === 'state' ? battle.teamBStates.join(' · ') || 'State team' : 'Creators'}</small></div>
          </div>
          <div className="landing-live-card-bottom">
            <span>◉ {battle.viewer_count.toLocaleString()} watching</span>
            <Link to="/auth">Watch live <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </article>)}
    </div>}
  </section>
}
