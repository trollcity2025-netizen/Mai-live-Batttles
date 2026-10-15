export function setPageMeta(title: string, description: string, path = '/') {
  document.title = `${title} | Mai Live Wars`
  let descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!descriptionTag) {
    descriptionTag = document.createElement('meta')
    descriptionTag.name = 'description'
    document.head.appendChild(descriptionTag)
  }
  descriptionTag.content = description
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.appendChild(robots)
  }
  robots.content = 'index,follow,max-image-preview:large'
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  const baseUrl = (import.meta.env.VITE_PUBLIC_APP_URL?.trim() || 'https://mai-live-batttles.onrender.com').replace(/\/+$/, '')
  canonical.href = `${baseUrl}${path}`
}
