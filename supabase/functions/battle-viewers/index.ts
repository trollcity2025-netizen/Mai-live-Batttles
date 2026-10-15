import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(authorization)
    const { battleId } = await request.json()
    if (typeof battleId !== 'string') return json({ error: 'Battle ID is required' }, 400)

    const { data: battle, error: battleError } = await db.from('battles')
      .select('id,status').eq('id', battleId).maybeSingle()
    if (battleError) throw battleError
    if (!battle || !['waiting', 'ready', 'live'].includes(battle.status)) return json({ error: 'Battle is not active' }, 404)

    const [{ data: participant, error: participantError }, { data: viewerSession, error: viewerError }] = await Promise.all([
      db.from('battle_participants').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).in('status', ['ready', 'active']).maybeSingle(),
      db.from('stream_sessions').select('id').eq('battle_id', battleId).eq('user_profile_id', profile.id).eq('session_role', 'viewer').eq('session_status', 'joined').maybeSingle(),
    ])
    if (participantError) throw participantError
    if (viewerError) throw viewerError
    if (!participant && !viewerSession) return json({ error: 'Join this battle to view its audience' }, 403)

    const [{ data: sessions, error: sessionsError }, { count: viewerCount, error: countError }, { data: blocks, error: blocksError }] = await Promise.all([
      db.from('stream_sessions')
        .select('user_profile_id,connected_at,user_profiles!inner(id,display_name,username,avatar_url,bio,state_code)')
        .eq('battle_id', battleId)
        .eq('session_role', 'viewer')
        .eq('session_status', 'joined')
        .order('connected_at', { ascending: true }),
      db.from('stream_sessions').select('id', { count: 'exact', head: true })
        .eq('battle_id', battleId).eq('session_role', 'viewer').eq('session_status', 'joined'),
      db.from('user_blocks').select('blocker_profile_id,blocked_profile_id')
        .or(`blocker_profile_id.eq.${profile.id},blocked_profile_id.eq.${profile.id}`),
    ])
    if (sessionsError) throw sessionsError
    if (countError) throw countError
    if (blocksError) throw blocksError

    const blockedIds = new Set((blocks || []).flatMap((block) => [block.blocker_profile_id, block.blocked_profile_id]))
    const viewers = (sessions || []).flatMap((session) => {
      const user = Array.isArray(session.user_profiles) ? session.user_profiles[0] : session.user_profiles
      if (!user || user.id === profile.id || blockedIds.has(user.id)) return []
      return [{
        id: user.id,
        displayName: user.display_name,
        username: user.username,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        stateCode: user.state_code,
        connectedAt: session.connected_at,
      }]
    })
    const viewerIds = viewers.map((viewer) => viewer.id)
    const [{ data: follows, error: followsError }, { data: followedBy, error: followersError }] = viewerIds.length
      ? await Promise.all([
        db.from('follows').select('followed_profile_id').eq('follower_profile_id', profile.id).in('followed_profile_id', viewerIds),
        db.from('follows').select('follower_profile_id').eq('followed_profile_id', profile.id).in('follower_profile_id', viewerIds),
      ])
      : [{ data: [], error: null }, { data: [], error: null }]
    if (followsError) throw followsError
    if (followersError) throw followersError
    const followingIds = new Set((follows || []).map((row) => row.followed_profile_id))
    const followerIds = new Set((followedBy || []).map((row) => row.follower_profile_id))
    return json({
      viewerCount: viewerCount || 0,
      viewers: viewers.map((viewer) => ({
        ...viewer,
        following: followingIds.has(viewer.id),
        followsYou: followerIds.has(viewer.id),
      })),
    })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
