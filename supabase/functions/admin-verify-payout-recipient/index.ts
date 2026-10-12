import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireAdmin(auth); const {userProfileId,verified}=await request.json(); if(typeof userProfileId!=='string'||typeof verified!=='boolean') return json({error:'Profile ID and verification status required'},400)
    const {error}=await db.from('payout_recipients').update({verified,verified_at:verified?new Date().toISOString():null,updated_at:new Date().toISOString(),verification_provider_ref:verified?'admin-reviewed':'verification-reset'}).eq('user_profile_id',userProfileId); if(error) throw error
    await db.from('admin_audit_logs').insert({admin_profile_id:profile.id,action:verified?'payout_recipient_verified':'payout_recipient_unverified',target_type:'user_profile',target_id:userProfileId,metadata:{manual_review:true}})
    return json({status:verified?'verified':'unverified'})
  }catch(error){return json({error:errorMessage(error)},400)}
})
