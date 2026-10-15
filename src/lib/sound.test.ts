import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('playUiSound', () => {
  let originalAudioContext: unknown
  let originalWebkitAudioContext: unknown

  beforeEach(() => {
    vi.resetModules()
    originalAudioContext = (globalThis as unknown as { AudioContext?: unknown }).AudioContext
    originalWebkitAudioContext = (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext
    delete (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
  })

  afterEach(() => {
    if (originalAudioContext) (globalThis as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext
    if (originalWebkitAudioContext) (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = originalWebkitAudioContext
  })

  it('does not throw when no AudioContext is available', async () => {
    const { playUiSound } = await import('./sound')
    expect(() => playUiSound('tap')).not.toThrow()
    expect(() => playUiSound('success')).not.toThrow()
    expect(() => playUiSound('battle')).not.toThrow()
    expect(() => playUiSound('warning')).not.toThrow()
  })

  it('accepts a default kind argument', async () => {
    const { playUiSound } = await import('./sound')
    expect(() => playUiSound()).not.toThrow()
  })
})