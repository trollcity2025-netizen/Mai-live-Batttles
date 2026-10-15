import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './in-app-notifications.css'

type NotificationItem = {
  id: string
  title: string
  body: string
  href: string
  created_at: string
  read_at: string | null
}

const getCurrentTimestamp = () => new Date().toISOString()

export function InAppNotifications({ profileId }: { profileId: string }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase) return
    const [listResult, countResult] = await Promise.all([
      supabase.from('user_notifications')
        .select('id,title,body,href,created_at,read_at')
        .eq('user_profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_profile_id', profileId)
        .is('read_at', null),
    ])
    if (listResult.error || countResult.error) {
      const reason = listResult.error?.message || countResult.error?.message || 'Notifications could not be loaded.'
      setError(reason)
      return
    }
    setItems(listResult.data || [])
    setUnreadCount(countResult.count || 0)
    setError('')
  }, [profileId])

  useEffect(() => {
    if (!supabase) return
    const initialLoad = window.setTimeout(() => void refresh(), 0)
    const channel = supabase.channel(`user-notifications-${profileId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_profile_id=eq.${profileId}`,
      }, () => { void refresh() })
      .subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      void supabase?.removeChannel(channel)
    }
  }, [profileId, refresh])

  const markRead = async (item: NotificationItem) => {
    if (!supabase) return
    if (!item.read_at) {
      const readAt = getCurrentTimestamp()
      const { error: updateError } = await supabase.from('user_notifications')
        .update({ read_at: readAt })
        .eq('id', item.id)
        .eq('user_profile_id', profileId)
        .is('read_at', null)
      if (updateError) {
        setError(`Could not mark notification as read: ${updateError.message}`)
        return
      }
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry))
      setUnreadCount((current) => Math.max(0, current - 1))
    }
    setOpen(false)
    navigate(item.href.startsWith('/') ? item.href : '/')
  }

  const markAllRead = async () => {
    if (!supabase || unreadCount === 0 || busy) return
    setBusy(true)
    const readAt = getCurrentTimestamp()
    const { error: updateError } = await supabase.from('user_notifications')
      .update({ read_at: readAt })
      .eq('user_profile_id', profileId)
      .is('read_at', null)
    setBusy(false)
    if (updateError) {
      setError(`Could not mark notifications as read: ${updateError.message}`)
      return
    }
    setItems((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }))
    setUnreadCount(0)
    setError('')
  }

  return <div className="notification-center">
    <button
      className="notification-bell"
      type="button"
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      aria-expanded={open}
      title="Notifications"
      onClick={() => setOpen((value) => !value)}
    >
      <span aria-hidden="true">♧</span>
      {unreadCount > 0 && <i>{unreadCount > 99 ? '99+' : unreadCount}</i>}
    </button>
    {open && <section className="notification-popover" aria-label="Notifications">
      <header>
        <div><strong>Notifications</strong><small>{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</small></div>
        <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount || busy}>{busy ? 'Saving…' : 'Mark all read'}</button>
      </header>
      {error && <p className="notification-error" role="alert">{error}</p>}
      <div className="notification-list">
        {items.length === 0
          ? <p className="notification-empty">{error ? 'Notifications are temporarily unavailable.' : 'No notifications yet.'}</p>
          : items.map((item) => <button
            type="button"
            key={item.id}
            className={`notification-item ${item.read_at ? '' : 'unread'}`}
            onClick={() => void markRead(item)}
          >
            <span className="notification-unread-dot" />
            <span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.created_at}>{item.created_at.slice(0, 16).replace('T', ' ')} UTC</time></span>
          </button>)}
      </div>
    </section>}
  </div>
}
