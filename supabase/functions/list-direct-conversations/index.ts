import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const authorization = request.headers.get('Authorization')
    if (!authorization) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(authorization)

    const [{ data: conversations, error: conversationsError }, { data: blocks, error: blocksError }] = await Promise.all([
      db.from('direct_conversations').select('id,user_a_profile_id,user_b_profile_id,updated_at')
        .or(`user_a_profile_id.eq.${profile.id},user_b_profile_id.eq.${profile.id}`)
        .order('updated_at', { ascending: false }).limit(50),
      db.from('user_blocks').select('blocker_profile_id,blocked_profile_id')
        .or(`blocker_profile_id.eq.${profile.id},blocked_profile_id.eq.${profile.id}`),
    ])
    if (conversationsError) throw conversationsError
    if (blocksError) throw blocksError

    const blockedIds = new Set((blocks || []).flatMap((block) => [block.blocker_profile_id, block.blocked_profile_id]))
    const visible = (conversations || []).filter((conversation) => {
      const otherId = conversation.user_a_profile_id === profile.id ? conversation.user_b_profile_id : conversation.user_a_profile_id
      return !blockedIds.has(otherId)
    })
    if (!visible.length) return json({ conversations: [] })

    const otherIds = visible.map((conversation) => conversation.user_a_profile_id === profile.id
      ? conversation.user_b_profile_id : conversation.user_a_profile_id)
    const conversationIds = visible.map((conversation) => conversation.id)
    const [{ data: profiles, error: profilesError }, { data: messages, error: messagesError }] = await Promise.all([
      db.from('user_profiles').select('id,display_name,username,avatar_url,bio,state_code')
        .in('id', otherIds).eq('profile_complete', true).eq('account_status', 'active'),
      db.from('direct_messages').select('id,conversation_id,body,created_at')
        .in('conversation_id', conversationIds).order('created_at', { ascending: false }).limit(500),
    ])
    if (profilesError) throw profilesError
    if (messagesError) throw messagesError

    const profileMap = new Map((profiles || []).map((user) => [user.id, user]))
    const messageMap = new Map<string, { body: string; created_at: string }>()
    for (const message of messages || []) {
      if (!messageMap.has(message.conversation_id)) messageMap.set(message.conversation_id, message)
    }
    const result = visible.flatMap((conversation) => {
      const otherId = conversation.user_a_profile_id === profile.id ? conversation.user_b_profile_id : conversation.user_a_profile_id
      const user = profileMap.get(otherId)
      if (!user) return []
      const lastMessage = messageMap.get(conversation.id)
      return [{
        conversationId: conversation.id,
        profile: {
          id: user.id,
          displayName: user.display_name,
          username: user.username,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          stateCode: user.state_code,
          connectedAt: null,
          following: false,
          followsYou: false,
        },
        lastMessage: lastMessage?.body || null,
        updatedAt: lastMessage?.created_at || conversation.updated_at,
      }]
    })
    return json({ conversations: result })
  } catch (error) {
    const message = errorMessage(error)
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400)
  }
})
