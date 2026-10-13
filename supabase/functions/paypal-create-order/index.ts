import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
const paypalBase = () => Deno.env.get('PAYPAL_ENV') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
async function paypalAccessToken() {
  const id = Deno.env.get('PAYPAL_CLIENT_ID'); const secret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  if (!id || !secret) throw new Error('PayPal server credentials are not configured')
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' })
  const body = await response.json(); if (!response.ok) throw new Error(body.error_description || 'PayPal authentication failed')
  return body.access_token as string
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const auth = request.headers.get('Authorization'); if (!auth) return json({ error: 'Authorization required' }, 401)
    const { db, profile } = await requireProfile(auth)
    const { packageKey } = await request.json()
    const { data: pkg, error: packageError } = await db.from('bullet_packages').select('*').eq('package_key', packageKey).eq('active', true).single()
    if (packageError || !pkg) return json({ error: 'This Bullet package is not available for purchase.' }, 404)
    if (pkg.requires_admin_confirmation) return json({ error: 'This package is disabled pending price confirmation.' }, 400)
    const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/$/, '')
    const returnUrl = Deno.env.get('PAYPAL_RETURN_URL') || (publicAppUrl ? `${publicAppUrl}/paypal-return` : '')
    const cancelUrl = Deno.env.get('PAYPAL_CANCEL_URL') || (publicAppUrl ? `${publicAppUrl}/profile` : '')
    if (!returnUrl.startsWith('https://') || !cancelUrl.startsWith('https://')) return json({ error: 'Configure HTTPS PayPal return/cancel URLs using your hosting subdomain before purchases are enabled.' }, 503)
    const accessToken = await paypalAccessToken()
    const orderResponse = await fetch(`${paypalBase()}/v2/checkout/orders`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': crypto.randomUUID() }, body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: pkg.id, custom_id: profile.id, description: `${pkg.bullets} Mai Live Wars Bullets`, amount: { currency_code: 'USD', value: Number(pkg.price_usd).toFixed(2) } }], application_context: { brand_name: 'Mai Live Wars', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: returnUrl, cancel_url: cancelUrl } }) })
    const order = await orderResponse.json(); if (!orderResponse.ok) throw new Error(order.message || 'PayPal order creation failed')
    const { data: purchase, error: insertError } = await db.from('purchase_orders').insert({ user_profile_id: profile.id, package_id: pkg.id, provider: 'paypal', provider_order_id: order.id, amount_usd: pkg.price_usd, bullets: pkg.bullets, status: 'created', idempotency_key: `paypal-order:${order.id}` }).select('id').single()
    if (insertError) throw insertError
    return json({ orderId: order.id, purchaseId: purchase.id, links: order.links?.filter((link: any) => ['approve','payer-action'].includes(link.rel)).map((link: any) => ({ rel: link.rel, href: link.href })) || [] })
  } catch (error) { return json({ error: errorMessage(error) }, 400) }
})
