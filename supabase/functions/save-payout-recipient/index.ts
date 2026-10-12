import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireProfile(auth); const {paypalEmail}=await request.json(); const email=String(paypalEmail||'').trim().toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Enter a valid PayPal email address'},400)
    const {error}=await db.from('payout_recipients').upsert({user_profile_id:profile.id,paypal_email:email,verified:false,verification_provider_ref:null,verified_at:null,updated_at:new Date().toISOString()},{onConflict:'user_profile_id'}); if(error) throw error
    return json({status:'pending_verification',message:'PayPal destination saved and marked unverified. An administrator must verify it before a payout can be sent.'})
  }catch(error){return json({error:errorMessage(error)},400)}
})
