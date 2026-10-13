export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-name, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
export function errorMessage(error: unknown) {
  const stack = new Error().stack ?? ''
  const caller = stack.split('\n').find((line) => /functions[/\\][^/\\]+[/\\]index\.ts/.test(line))
  const functionName = caller?.match(/functions[/\\]([^/\\]+)[/\\]index\.ts/)?.[1] ?? 'unknown'
  console.error(`[Edge Function: ${functionName}] Request failed`, error)
  return error instanceof Error ? error.message : 'Unexpected server error'
}
