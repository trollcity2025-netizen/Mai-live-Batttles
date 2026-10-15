import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('setPageMeta', () => {
  let originalTitle: string
  let originalHeadChildren: string

  beforeEach(() => {
    originalTitle = document.title
    originalHeadChildren = document.head.innerHTML
  })

  afterEach(() => {
    document.head.innerHTML = originalHeadChildren
    document.title = originalTitle
  })

  it('sets the document title with the page title and app name', async () => {
    const { setPageMeta } = await import('./seo')
    setPageMeta('About', 'About the app', '/about')
    expect(document.title).toBe('About | Mai Live Wars')
  })

  it('creates or updates the description meta tag', async () => {
    const { setPageMeta } = await import('./seo')
    setPageMeta('About', 'About the app', '/about')
    const description = document.querySelector('meta[name="description"]')
    expect(description).toBeTruthy()
    expect(description?.getAttribute('content')).toBe('About the app')
  })

  it('updates an existing description meta tag rather than creating duplicates', async () => {
    const existing = document.createElement('meta')
    existing.name = 'description'
    existing.content = 'old'
    document.head.appendChild(existing)

    const { setPageMeta } = await import('./seo')
    setPageMeta('About', 'new description', '/about')

    const descriptions = document.querySelectorAll('meta[name="description"]')
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0].getAttribute('content')).toBe('new description')
  })

  it('creates or updates the robots meta tag', async () => {
    const { setPageMeta } = await import('./seo')
    setPageMeta('About', 'About the app', '/about')
    const robots = document.querySelector('meta[name="robots"]')
    expect(robots).toBeTruthy()
    expect(robots?.getAttribute('content')).toContain('index,follow')
  })

  it('creates a canonical link element', async () => {
    const { setPageMeta } = await import('./seo')
    setPageMeta('About', 'About the app', '/about')
    const canonical = document.querySelector('link[rel="canonical"]')
    expect(canonical).toBeTruthy()
  })

  it('uses the Render domain for canonical URLs when VITE_PUBLIC_APP_URL is not configured', async () => {
    const { setPageMeta } = await import('./seo')
    setPageMeta('About', 'About the app', '/about')
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    expect(canonical?.href).toBe('https://mai-live-batttles.onrender.com/about')
  })

  it('uses the default path when none is provided', async () => {
    const { setPageMeta } = await import('./seo')
    setPageMeta('Home', 'Home page')
    expect(document.title).toBe('Home | Mai Live Wars')
  })
})