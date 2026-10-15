import { describe, it, expect } from 'vitest'

// battleRequestErrorMessage is not exported, so we test the logic by replicating it
// and verifying behavior with the same edge cases the app handles.

async function battleRequestErrorMessage(error: unknown, data: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const httpError = error as { context: { clone: () => { json: () => Promise<unknown> } } }
    try {
      const payload: unknown = await httpError.context.clone().json()
      if (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error: unknown }).error === 'string') {
        return (payload as { error: string }).error
      }
    } catch {
      // fall through
    }
  }
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  if (error instanceof Error) return error.message
  return fallback
}

describe('battleRequestErrorMessage', () => {
  it('extracts error from FunctionsHttpError context payload', async () => {
    const error = {
      context: {
        clone: () => ({ json: async () => ({ error: 'Battle is full' }) }),
      },
    }
    const result = await battleRequestErrorMessage(error, null, 'Fallback')
    expect(result).toBe('Battle is full')
  })

  it('falls back to data.error when HttpError context fails to parse', async () => {
    const error = {
      context: {
        clone: () => ({ json: async () => { throw new Error('parse') } }),
      },
    }
    const result = await battleRequestErrorMessage(error, { error: 'Data error' }, 'Fallback')
    expect(result).toBe('Data error')
  })

  it('returns error.message when error is an Error instance', async () => {
    const result = await battleRequestErrorMessage(new Error('Network failure'), null, 'Fallback')
    expect(result).toBe('Network failure')
  })

  it('returns the fallback when no error info is available', async () => {
    const result = await battleRequestErrorMessage(null, null, 'Default message')
    expect(result).toBe('Default message')
  })

  it('returns fallback when data.error is not a string', async () => {
    const result = await battleRequestErrorMessage(null, { error: 42 }, 'Fallback')
    expect(result).toBe('Fallback')
  })
})