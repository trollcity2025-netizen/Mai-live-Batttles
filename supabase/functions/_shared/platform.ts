export function isNativeAppRequest(request: Request) {
  const origin = request.headers.get('Origin')
  if (!origin) return false
  try {
    const parsed = new URL(origin)
    if ((parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:') && parsed.hostname === 'localhost') return true
    return parsed.protocol === 'http:' && parsed.hostname === 'localhost' && parsed.port === ''
  } catch {
    return false
  }
}

export function isBrowserRequest(request: Request) {
  const origin = request.headers.get('Origin')
  if (!origin || isNativeAppRequest(request)) return false
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
