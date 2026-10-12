import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireProfile(auth); const {consent}=await request.json(); if(typeof consent!=='boolean') return json({error:'Consent must be true or false'},400)
    const now=new Date().toISOString()
    const {error:updateError}=await db.from('user_profiles').update({marketing_recording_consent:consent,marketing_recording_consent_at:consent?now:null}).eq('id',profile.id); if(updateError) throw updateError
    const {error:historyError}=await db.from('marketing_recording_consents').insert({user_profile_id:profile.id,consent_granted:consent,consent_version:'2026-10-12',source:'profile_settings',recorded_at:now,withdrawn_at:consent?null:now}); if(historyError) throw historyError
    return json({status:consent?'opted_in':'withdrawn',consent})
  }catch(error){return json({error:errorMessage(error)},400)}
})
