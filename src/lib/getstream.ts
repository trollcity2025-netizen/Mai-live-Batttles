import { StreamVideoClient } from '@stream-io/video-react-sdk'
import { supabase } from './supabase'

export type StreamConnection = {
  client: any
  call: any
  isViewer: boolean
  dispose: () => Promise<void>
}

/**
 * Connects the official GetStream Video SDK to an authenticated battle.
 * The API secret is never sent to the app; a Supabase Edge Function issues a short-lived user token.
 */
export async function connectGetStreamBattle(roomId: string, profileId: string, displayName: string): Promise<StreamConnection> {
  if (!supabase) throw new Error('Supabase is not configured. Add the public project URL and anon key.')
  const apiKey = import.meta.env.VITE_GETSTREAM_API_KEY?.trim()
  if (!apiKey) throw new Error('GetStream is not configured yet. Add VITE_GETSTREAM_API_KEY.')

  const { data, error } = await supabase.functions.invoke('stream-token', {
    body: { profileId, roomId, displayName },
  })
  if (error || !data?.token || !data?.userId) {
    throw new Error(error?.message || data?.error || 'Unable to securely create a GetStream session.')
  }

  // Create a short-lived authenticated client for the current battle.
  const client = StreamVideoClient.getOrCreateInstance({
    apiKey,
    options: { clientEventsReportingEnabled: false },
    user: { id: data.userId, name: displayName },
    token: data.token,
  })
  const call: any = client.call('default', data.callId || roomId)
  try {
    await call.join({ create: !data.viewer })
    if (!data.viewer) {
      await call.camera.enable()
      await call.microphone.enable()
      const { data: confirmation, error: confirmationError } = await supabase.functions.invoke('confirm-battle-connection', { body: { roomId, profileId } })
      if (confirmationError || confirmation?.error) throw new Error(confirmationError?.message || confirmation?.error || 'Could not confirm the battle connection.')
      if (data.shouldStartTranscription && typeof call.startTranscription === 'function') {
        try { await call.startTranscription() } catch (transcriptionError) { console.warn('GetStream transcription did not start; confirm transcription is enabled for this call type.', transcriptionError) }
      }
    }
    let disposed = false
    return {
      client,
      call,
      isViewer: Boolean(data.viewer),
      dispose: async () => {
        if (disposed) return
        disposed = true
        try { await call.leave() } finally { await client.disconnectUser() }
      },
    }
  } catch (error) {
    try { await call.leave() } catch { /* best-effort cleanup */ }
    try { await client.disconnectUser() } catch { /* best-effort cleanup */ }
    throw error
  }
}
