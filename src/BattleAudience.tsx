import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, type UserProfile } from './lib/supabase'
import './battle-audience.css'

type AudienceProfile = {
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

type DirectMessage = {
  id: string
  conversation_id: string
  sender_profile_id: string
  body: string
  created_at: string
}

type DirectConversationSummary = {
  conversationId: string
  profile: AudienceProfile
  lastMessage: string | null
  updatedAt: string
}

const reportReasons = [
  ['harassment', 'Harassment or bullying'],
  ['threats_violence', 'Threats or violence'],
  ['self_harm', 'Self-harm concern'],
  ['sexual_content', 'Sexual content'],
  ['spam', 'Spam or scams'],
  ['other', 'Other safety concern'],
]

export function BattleAudience({ battleId, profile }: { battleId: string; profile: UserProfile }) {
  const [viewerCount, setViewerCount] = useState(0)
  const [viewers, setViewers] = useState<AudienceProfile[]>([])
  const [selected, setSelected] = useState<AudienceProfile | null>(null)
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.functions.invoke('battle-viewers', { body: { battleId } })
    if (error || data?.error) {
      setLoadError(error?.message || data?.error || 'Could not load battle viewers.')
      return
    }
    setLoadError('')
    setViewerCount(Number(data.viewerCount) || 0)
    setViewers(Array.isArray(data.viewers) ? data.viewers : [])
  }, [battleId])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(timer)
    }
  }, [refresh])

  const updateViewer = (next: AudienceProfile) => {
    setViewers((current) => current.map((viewer) => viewer.id === next.id ? next : viewer))
    setSelected(next)
  }

  return <>
    <section className="battle-audience" aria-label="Battle audience">
      <div className="battle-audience-count"><span className="audience-live-dot" /><strong>{viewerCount}</strong><span>{viewerCount === 1 ? 'watching' : 'watching'}</span></div>
      {viewers.length > 0
        ? <div className="battle-audience-bubbles" aria-label="Current viewers">
          {viewers.slice(0, 8).map((viewer) => <button key={viewer.id} type="button" className="audience-avatar-button" title={`${viewer.displayName} · View profile`} onClick={() => setSelected(viewer)}>
            {viewer.avatarUrl ? <img src={viewer.avatarUrl} alt="" /> : <span>{viewer.displayName.slice(0, 1).toUpperCase()}</span>}
          </button>)}
          {viewers.length > 8 && <span className="audience-extra">+{viewers.length - 8}</span>}
        </div>
        : <span className="battle-audience-empty">No viewer profiles yet</span>}
      {loadError && <span className="battle-audience-error" title={loadError}>Audience unavailable</span>}
    </section>
    {selected && <AudienceProfileDialog
      battleId={battleId}
      profile={profile}
      viewer={selected}
      onClose={() => setSelected(null)}
      onUpdate={updateViewer}
      onBlocked={(blockedId) => {
        setViewers((current) => current.filter((viewer) => viewer.id !== blockedId))
        setViewerCount((count) => Math.max(0, count - 1))
        setSelected(null)
      }}
    />}
  </>
}

function AudienceProfileDialog({
  battleId,
  profile,
  viewer,
  onClose,
  onUpdate,
  onBlocked,
}: {
  battleId: string
  profile: UserProfile
  viewer: AudienceProfile
  onClose: () => void
  onUpdate: (viewer: AudienceProfile) => void
  onBlocked: (profileId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportCategory, setReportCategory] = useState('harassment')
  const [reportDetails, setReportDetails] = useState('')
  const [conversationId, setConversationId] = useState('')

  const toggleFollow = async () => {
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    const result = viewer.following
      ? await supabase.from('follows').delete().eq('follower_profile_id', profile.id).eq('followed_profile_id', viewer.id)
      : await supabase.from('follows').insert({ follower_profile_id: profile.id, followed_profile_id: viewer.id })
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    onUpdate({ ...viewer, following: !viewer.following })
  }

  const openMessage = async () => {
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('open-direct-conversation', {
      body: { battleId, targetProfileId: viewer.id },
    })
    setBusy(false)
    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || 'Could not open a private conversation.')
      return
    }
    setConversationId(data.conversationId)
  }

  const blockViewer = async () => {
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    const { error: blockError } = await supabase.from('user_blocks').insert({
      blocker_profile_id: profile.id,
      blocked_profile_id: viewer.id,
    })
    setBusy(false)
    if (blockError) {
      setError(blockError.code === '23505' ? 'This user is already blocked.' : blockError.message)
      return
    }
    onBlocked(viewer.id)
  }

  const submitReport = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    const { data, error: reportError } = await supabase.functions.invoke('report-battle-user', {
      body: { battleId, targetProfileId: viewer.id, category: reportCategory, details: reportDetails },
    })
    setBusy(false)
    if (reportError || data?.error) {
      setError(reportError?.message || data?.error || 'Could not submit the report.')
      return
    }
    setReporting(false)
    setReportDetails('')
    setNotice(data.aiTriage === 'completed'
      ? 'Report sent. AI triage completed; it is queued for safety review.'
      : 'Report sent. AI triage is unavailable, so it is queued for moderator review.')
  }

  return <div className="audience-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="audience-profile-dialog" role="dialog" aria-modal="true" aria-label={`${viewer.displayName} profile`}>
      <button className="audience-dialog-close" type="button" aria-label="Close profile" onClick={onClose}>×</button>
      <div className="audience-profile-heading">
        {viewer.avatarUrl
          ? <img className="audience-profile-avatar" src={viewer.avatarUrl} alt={`${viewer.displayName}'s profile`} />
          : <div className="audience-profile-avatar audience-profile-avatar-fallback">{viewer.displayName.slice(0, 1).toUpperCase()}</div>}
        <div><h2>{viewer.displayName}</h2><span>@{viewer.username}</span>{viewer.stateCode && <small>{viewer.stateCode}</small>}</div>
      </div>
      {viewer.bio && <p className="audience-profile-bio">{viewer.bio}</p>}
      {viewer.followsYou && <span className="audience-mutual-tag">Follows you</span>}

      {!conversationId && !reporting && <div className="audience-profile-actions">
        <button type="button" className="button button-primary" onClick={() => void toggleFollow()} disabled={busy}>{busy ? 'Working…' : viewer.following ? 'Following · Unfollow' : 'Follow'}</button>
        <button type="button" className="button button-ghost" onClick={() => void openMessage()} disabled={busy}>Private message</button>
        <button type="button" className="audience-danger-action" onClick={() => setReporting(true)}>Report</button>
        <button type="button" className="audience-danger-action" onClick={() => void blockViewer()} disabled={busy}>Block</button>
      </div>}

      {reporting && <form className="audience-report-form" onSubmit={(event) => void submitReport(event)}>
        <strong>Report this viewer</strong>
        <label>Reason<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value)}>{reportReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>What happened?<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} minLength={5} maxLength={1000} required placeholder="Share details so our safety system can triage the report." /></label>
        <p>AI will triage your report. A human moderator reviews reports before account action.</p>
        <div><button className="button button-primary" type="submit" disabled={busy || reportDetails.trim().length < 5}>{busy ? 'Submitting…' : 'Submit report'}</button><button className="button button-ghost" type="button" onClick={() => setReporting(false)}>Cancel</button></div>
      </form>}

      {conversationId && <DirectMessageThread conversationId={conversationId} profile={profile} recipient={viewer} onBack={() => setConversationId('')} />}
      {error && <p className="audience-feedback audience-feedback-error" role="alert">{error}</p>}
      {notice && <p className="audience-feedback" role="status">{notice}</p>}
      <small className="audience-safety-note">Be respectful. You can block or report this account at any time.</small>
    </section>
  </div>
}

function DirectMessageThread({ conversationId, profile, recipient, onBack }: { conversationId: string; profile: UserProfile; recipient: AudienceProfile; onBack: () => void }) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const loadMessages = useCallback(async () => {
    if (!supabase) return
    const { data, error: queryError } = await supabase.from('direct_messages')
      .select('id,conversation_id,sender_profile_id,body,created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (queryError) {
      setError(queryError.message)
      return
    }
    setMessages((data || []) as DirectMessage[])
  }, [conversationId])

  useEffect(() => {
    if (!supabase) return
    const initialLoad = window.setTimeout(() => void loadMessages(), 0)
    const channel = supabase.channel(`direct-messages-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` }, () => { void loadMessages() })
      .subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      void supabase?.removeChannel(channel)
    }
  }, [conversationId, loadMessages])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || busy || !draft.trim()) return
    setBusy(true)
    setError('')
    const { error: sendError } = await supabase.functions.invoke('send-direct-message', {
      body: { conversationId, body: draft.trim() },
    })
    setBusy(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setDraft('')
    await loadMessages()
  }

  return <div className="audience-dm-thread">
    <button type="button" className="audience-dm-back" onClick={onBack}>← Profile</button>
    <strong>Private chat with {recipient.displayName}</strong>
    <div className="audience-dm-messages" aria-live="polite">{messages.map((message) => <p key={message.id} className={message.sender_profile_id === profile.id ? 'mine' : ''}><span>{message.body}</span><small>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></p>)}</div>
    {error && <p className="audience-feedback audience-feedback-error" role="alert">{error}</p>}
    <form className="audience-dm-form" onSubmit={(event) => void send(event)}><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Write a private message…" disabled={busy} /><button type="submit" disabled={busy || !draft.trim()}>{busy ? '…' : 'Send'}</button></form>
  </div>
}

export function DirectInbox({ profile }: { profile: UserProfile }) {
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([])
  const [selected, setSelected] = useState<DirectConversationSummary | null>(null)
  const [error, setError] = useState('')
  const loadConversations = useCallback(async () => {
    if (!supabase) return
    const { data, error: invokeError } = await supabase.functions.invoke('list-direct-conversations', { body: {} })
    if (invokeError || data?.error) {
      setError(invokeError?.message || data?.error || 'Could not load private conversations.')
      return
    }
    setError('')
    const next = (Array.isArray(data.conversations) ? data.conversations : []) as DirectConversationSummary[]
    setConversations(next)
    setSelected((current) => current ? next.find((conversation) => conversation.conversationId === current.conversationId) || null : null)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadConversations(), 0)
    const timer = window.setInterval(() => void loadConversations(), 8000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(timer)
    }
  }, [loadConversations])

  return <div className="page-stack direct-inbox-page">
    <section className="page-heading"><span className="eyebrow">PRIVATE MESSAGES</span><h1>Your <span>inbox.</span></h1><p>Private conversations stay available after you leave a battle.</p></section>
    {error && <div className="inline-message" role="alert">{error}</div>}
    <section className="direct-inbox-card">
      <div className="direct-inbox-list">
        {conversations.length === 0
          ? <p className="direct-inbox-empty">No private conversations yet. Open a viewer’s profile during a battle to start one.</p>
          : conversations.map((conversation) => <button type="button" key={conversation.conversationId} className={`direct-inbox-item ${selected?.conversationId === conversation.conversationId ? 'active' : ''}`} onClick={() => setSelected(conversation)}>
            {conversation.profile.avatarUrl
              ? <img src={conversation.profile.avatarUrl} alt="" />
              : <span className="direct-inbox-fallback">{conversation.profile.displayName.slice(0, 1).toUpperCase()}</span>}
            <span><strong>{conversation.profile.displayName}</strong><small>{conversation.lastMessage || `@${conversation.profile.username}`}</small></span>
          </button>)}
      </div>
      <div className="direct-inbox-content">
        {selected
          ? <DirectMessageThread conversationId={selected.conversationId} profile={profile} recipient={selected.profile} onBack={() => setSelected(null)} />
          : <p>Select a conversation to read and reply.</p>}
      </div>
    </section>
  </div>
}
