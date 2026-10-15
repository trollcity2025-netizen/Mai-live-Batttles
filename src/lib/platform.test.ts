import { describe, it, expect } from 'vitest'

describe('platform detection', () => {
  it('exports isNativeApp as a boolean', async () => {
    const { isNativeApp } = await import('./platform')
    expect(typeof isNativeApp).toBe('boolean')
  })
})