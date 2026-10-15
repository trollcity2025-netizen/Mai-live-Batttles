import { CallingState, StreamVideoClient, type Call } from '@stream-io/video-react-sdk'
import { supabase } from './supabase'

export type StreamConnection = {
  client: StreamVideoClient
  call: Call
  isViewer: boolean
  ready: Promise<void>
  dispose: () => Promise<void>
}

export type TestBattleOpponentConnection = {
  client: StreamVideoClient
  call: Call
  profileId: string
  dispose: () => Promise<void>
}

type ManagedClient = {
  client: StreamVideoClient
  activeCalls: number
  disconnectPromise: Promise<void> | null
}

type ManagedCall = {
  key: string
  clientKey: string
  clientEntry: ManagedClient
  call: Call
  isViewer: boolean
  references: number
  joined: Promise<void>
  mediaReady: Promise<void>
  ready: Promise<void>
  disposePromise: Promise<void> | null
}

const clients = new Map<string, ManagedClient>()
const calls = new Map<string, ManagedCall>()
const callCreations = new Map<string, Promise<ManagedCall>>()

function abortError() {
  return new DOMException('The GetStream connection was cancelled.', 'AbortError')
}

async function acquireClient(clientKey: string, apiKey: string, userId: string, displayName: string, token: string): Promise<ManagedClient> {
  while (true) {
    const existing = clients.get(clientKey)
    if (existing?.disconnectPromise) {
      await existing.disconnectPromise
      continue
    }
    if (existing) {
      existing.activeCalls += 1
      return existing
    }
    const client = StreamVideoClient.getOrCreateInstance({
      apiKey,
      options: { clientEventsReportingEnabled: false },
      user: { id: userId, name: displayName },
      token,
    })
    const entry: ManagedClient = { client, activeCalls: 1, disconnectPromise: null }
    clients.set(clientKey, entry)
    return entry
  }
}

function releaseClient(entry: ManagedClient, clientKey: string): Promise<void> {
  entry.activeCalls = Math.max(0, entry.activeCalls - 1)
  if (entry.activeCalls > 0) return Promise.resolve()
  if (entry.disconnectPromise) return entry.disconnectPromise

  entry.disconnectPromise = (async () => {
    try {
      await entry.client.disconnectUser()
    } finally {
      if (clients.get(clientKey) === entry) clients.delete(clientKey)
    }
  })()
  return entry.disconnectPromise
}

function releaseCall(session: ManagedCall): Promise<void> {
  if (session.references > 0) session.references -= 1
  if (session.references > 0) return Promise.resolve()
  if (session.disposePromise) return session.disposePromise

  session.disposePromise = (async () => {
    try {
      await session.mediaReady.catch(() => undefined)
      if (session.call.state.callingState !== CallingState.LEFT) {
        await session.call.leave()
      }
    } finally {
      if (calls.get(session.key) === session) calls.delete(session.key)
      await releaseClient(session.clientEntry, session.clientKey)
    }
  })()
  return session.disposePromise
}

function createManagedCall(key: string, clientKey: string, clientEntry: ManagedClient, callId: string, isViewer: boolean, roomId: string, profileId: string): ManagedCall {
  const call = clientEntry.client.call('default', callId)
  const session: ManagedCall = {
    key,
    clientKey,
    clientEntry,
    call,
    isViewer,
    references: 1,
    joined: Promise.resolve(),
    mediaReady: Promise.resolve(),
    ready: Promise.resolve(),
    disposePromise: null,
  }
  calls.set(key, session)

  session.joined = call.join({ create: !isViewer })
  session.mediaReady = session.joined.then(async () => {
    if (isViewer || session.references === 0) return
    await call.camera.enable()
    if (session.references === 0) return
    await call.microphone.enable()
  })
  session.ready = session.mediaReady.then(async () => {
    if (isViewer || session.references === 0) return
    const db = supabase
    if (!db) throw new Error('Supabase is not configured. Add your public project URL and anon key.')
    const { data: confirmation, error: confirmationError } = await db.functions.invoke('confirm-battle-connection', { body: { roomId, profileId } })
    if (confirmationError || confirmation?.error) {
      throw new Error(confirmationError?.message || confirmation?.error || 'Could not confirm the battle connection.')
    }
    if (session.references === 0) return
    if (confirmation?.shouldStartTranscription && typeof call.startTranscription === 'function') {
      try {
        await call.startTranscription()
      } catch (transcriptionError) {
        console.warn('GetStream transcription did not start; confirm transcription is enabled for this call type.', transcriptionError)
      }
    }
  })
  void session.joined.catch(() => undefined)
  void session.mediaReady.catch(() => undefined)
  void session.ready.catch((error) => {
    console.error('[GetStream] Session ready failed', { callId, roomId, profileId, error: String(error) })
  })
  return session
}

async function acquireCallSession(sessionKey: string, clientKey: string, apiKey: string, userId: string, displayName: string, token: string, callId: string, isViewer: boolean, roomId: string, profileId: string): Promise<ManagedCall> {
  while (true) {
    const existing = calls.get(sessionKey)
    if (existing?.disposePromise) {
      await existing.disposePromise
      continue
    }
    if (existing) {
      existing.references += 1
      return existing
    }

    const creation = callCreations.get(sessionKey)
    if (creation) {
      const created = await creation
      if (created.disposePromise) continue
      created.references += 1
      return created
    }

    const pending = (async () => {
      const clientEntry = await acquireClient(clientKey, apiKey, userId, displayName, token)
      return createManagedCall(sessionKey, clientKey, clientEntry, callId, isViewer, roomId, profileId)
    })()
    callCreations.set(sessionKey, pending)
    try {
      return await pending
    } finally {
      if (callCreations.get(sessionKey) === pending) callCreations.delete(sessionKey)
    }
  }
}

/**
 * Connects the official GetStream Video SDK to an authenticated battle.
 * The API secret is never sent to the app; a Supabase Edge Function issues a short-lived user token.
 */
export async function connectGetStreamBattle(roomId: string, profileId: string, displayName: string, signal?: AbortSignal): Promise<StreamConnection> {
  if (!supabase) throw new Error('Supabase is not configured. Add the public project URL and anon key.')
  if (signal?.aborted) throw abortError()
  const apiKey = import.meta.env.VITE_GETSTREAM_API_KEY?.trim()
  if (!apiKey) throw new Error('GetStream is not configured yet. Add VITE_GETSTREAM_API_KEY.')

  const { data, error } = await supabase.functions.invoke('stream-token', {
    body: { profileId, roomId, displayName },
  })
  if (error || !data?.token || !data?.userId) {
    throw new Error(error?.message || data?.error || 'Unable to securely create a GetStream session.')
  }

  if (signal?.aborted) throw abortError()

  const userId = String(data.userId)
  const callId = String(data.callId || roomId)
  const isViewer = Boolean(data.viewer)
  const clientKey = `${apiKey}:${userId}`
  const sessionKey = `${clientKey}:${callId}`
  if (signal?.aborted) throw abortError()
  const session = await acquireCallSession(sessionKey, clientKey, apiKey, userId, displayName, String(data.token), callId, isViewer, roomId, profileId)
  if (signal?.aborted) {
    await releaseCall(session)
    throw abortError()
  }

  let released = false
  let releasePromise: Promise<void> | null = null
  const release = () => {
    if (released) return releasePromise || Promise.resolve()
    released = true
    signal?.removeEventListener('abort', onAbort)
    releasePromise = releaseCall(session!)
    return releasePromise
  }
  const onAbort = () => {
    void release().catch((cleanupError: unknown) => console.error('[GetStream] Cancelled connection cleanup failed', cleanupError))
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    await session.joined
    if (signal?.aborted) {
      await release()
      throw abortError()
    }
    return {
      client: session.clientEntry.client,
      call: session.call,
      isViewer: session.isViewer,
      ready: session.ready,
      dispose: release,
    }
  } catch (error) {
    try {
      await release()
    } catch (cleanupError) {
      console.error('[GetStream] Cleanup after a failed connection also failed', cleanupError)
    }
    throw error
  }
}

export async function connectTestBattleOpponent(battleId: string, signal?: AbortSignal): Promise<TestBattleOpponentConnection> {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (signal?.aborted) throw abortError()
  const { data, error } = await supabase.functions.invoke('test-bot-token', { body: { battleId } })
  if (error || !data?.token || !data?.apiKey || !data?.userId || !data?.callId) {
    throw new Error(error?.message || data?.error || 'Unable to create the Admin Tester RTC session.')
  }
  if (signal?.aborted) throw abortError()

  const client = new StreamVideoClient({
    apiKey: String(data.apiKey),
    user: { id: String(data.userId), name: String(data.displayName || 'Admin Tester'), image: data.avatarUrl || undefined },
    token: String(data.token),
  })
  const call = client.call('default', String(data.callId))
  let disposePromise: Promise<void> | null = null
  const dispose = () => {
    if (disposePromise) return disposePromise
    disposePromise = (async () => {
      try {
        if (call.state.callingState !== CallingState.LEFT) await call.leave()
      } finally {
        await client.disconnectUser()
      }
    })()
    return disposePromise
  }

  try {
    await call.join({ create: false })
    if (signal?.aborted) {
      await dispose()
      throw abortError()
    }
    const { error: confirmError, data: confirmData } = await supabase.functions.invoke('confirm-test-bot-connection', {
      body: { battleId, botProfileId: String(data.userId) },
    })
    if (confirmError || confirmData?.error) {
      throw new Error(confirmError?.message || confirmData?.error || 'Could not activate the Admin Tester opponent.')
    }
    if (signal?.aborted) {
      await dispose()
      throw abortError()
    }
    return { client, call, profileId: String(data.userId), dispose }
  } catch (error) {
    try {
      await dispose()
    } catch (cleanupError) {
      console.error('[GetStream] Test opponent cleanup failed after connection error', cleanupError)
    }
    throw error
  }
}
