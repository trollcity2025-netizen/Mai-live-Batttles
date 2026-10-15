import { describe, it, expect } from 'vitest'

describe('supabase configuration', () => {
  it('exports isSupabaseConfigured as a boolean', async () => {
    const { isSupabaseConfigured } = await import('./supabase')
    expect(typeof isSupabaseConfigured).toBe('boolean')
  })
})