import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom does not implement matchMedia; React Router and some components use it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// IntersectionObserver is used by some UI libraries.
window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as unknown as typeof IntersectionObserver

// ResizeObserver is used by some UI libraries.
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver

// Suppress expected React state update warnings in tests that unmount components.
const originalError = console.error
console.error = (...args: unknown[]) => {
  const message = args[0]
  if (typeof message === 'string' && /not wrapped in act/.test(message)) return
  originalError(...args)
}