import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase.ts'
const paypalBase = () => Deno.env.get('PAYPAL_ENV') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
async function paypalAccessToken() { const id=Deno.env.get('PAYPAL_CLIENT_ID'); const secret=Deno.env.get('PAYPAL_CLIENT_SECRET'); if(!id||!secret) throw new Error('PayPal server credentials are not configured'); const r=await fetch(`${paypalBase()}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${id}:${secret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'}); const b=await r.json(); if(!r.ok) throw new Error(b.error_description||'PayPal authentication failed'); return b.access_token as string }
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const event=await request.json(); const webhookId=Deno.env.get('PAYPAL_WEBHOOK_ID'); if(!webhookId) return json({error:'PayPal webhook ID is not configured'},503)
    const header=(name:string)=>request.headers.get(name)||''
    const verification={auth_algo:header('paypal-auth-algo'),cert_url:header('paypal-cert-url'),transmission_id:header('paypal-transmission-id'),transmission_sig:header('paypal-transmission-sig'),transmission_time:header('paypal-transmission-time'),webhook_id:webhookId,webhook_event:event}
    const token=await paypalAccessToken(); const verifyResponse=await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(verification)}); const verified=await verifyResponse.json(); if(!verifyResponse.ok||verified.verification_status!=='SUCCESS') return json({error:'Invalid PayPal webhook signature'},401)
    const db=adminClient(); const eventId=String(event.id||''); const eventType=String(event.event_type||'unknown'); if(!eventId) return json({error:'Webhook event ID missing'},400)
    const {data:existing}=await db.from('payment_webhook_events').select('id,processed').eq('provider','paypal').eq('provider_event_id',eventId).maybeSingle(); if(existing?.processed) return json({status:'already_processed'})
    const {error:insertError}=await db.from('payment_webhook_events').upsert({provider:'paypal',provider_event_id:eventId,event_type:eventType,payload_hash:await digest(JSON.stringify(event)),processed:false},{onConflict:'provider,provider_event_id'}); if(insertError) throw insertError
    const resource=event.resource||{}; const captureId=resource.id||resource.supplementary_data?.related_ids?.capture_id; const orderId=resource.supplementary_data?.related_ids?.order_id||resource.purchase_units?.[0]?.reference_id
    const cashoutId=String(resource.sender_item_id || resource.payout_item?.sender_item_id || resource.payout_item?.senderItemId || '')
    if((eventType==='PAYMENT.PAYOUTS-ITEM.SUCCEEDED'||eventType==='PAYMENT.PAYOUTS-ITEM.FAILED')&&cashoutId) {
      const outcome=eventType==='PAYMENT.PAYOUTS-ITEM.SUCCEEDED'?'paid':'failed'
      const {error:settleError}=await db.rpc('settle_cashout_payout',{p_cashout_id:cashoutId,p_outcome:outcome,p_provider_reference:String(resource.payout_item_id||resource.payout_item?.payout_item_id||resource.id||'')})
      if(settleError) throw settleError
    } else if(eventType==='PAYMENT.CAPTURE.REFUNDED'||eventType==='PAYMENT.CAPTURE.REVERSED'||eventType==='CUSTOMER.DISPUTE.CREATED') {
      if(captureId) await db.from('purchase_orders').update({status:eventType==='CUSTOMER.DISPUTE.CREATED'?'chargeback':'refunded'}).eq('provider_capture_id',captureId)
      // Refunds and disputes are flagged for ledger reconciliation. Never silently restore or debit currency from an unverified client event.
    } else if(eventType==='PAYMENT.CAPTURE.COMPLETED'&&captureId) {
      // The authenticated capture flow credits Bullets atomically. This webhook records provider confirmation for reconciliation.
      await db.from('purchase_orders').update({provider_capture_id:captureId,captured_at:new Date().toISOString()}).eq('provider_capture_id',captureId)
    }
    await db.from('payment_webhook_events').update({processed:true,processed_at:new Date().toISOString()}).eq('provider','paypal').eq('provider_event_id',eventId)
    return json({status:'processed',eventType,orderId:orderId||null})
  }catch(error){return json({error:errorMessage(error)},400)}
})
async function digest(value:string) { const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return [...new Uint8Array(hash)].map((byte)=>byte.toString(16).padStart(2,'0')).join('') }
