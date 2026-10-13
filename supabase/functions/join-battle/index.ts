import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile,user}=await requireProfile(auth); const {battleId,stateCode}=await request.json(); if(typeof battleId!=='string') return json({error:'Battle ID required'},400)
    const cooldownExempt=profile.role==='admin'||user.email?.trim().toLowerCase()==='trollcity2025@gmail.com'
    const {data,error}=await db.rpc('join_existing_battle',{p_profile_id:profile.id,p_battle_id:battleId,p_state_code:typeof stateCode==='string'?stateCode.toUpperCase():profile.state_code,p_cooldown_exempt:cooldownExempt}); if(error) throw error
    return json(data)
  }catch(error){const message=errorMessage(error);const cooldownMatch=message.match(/^NO_GIFT_BATTLE_COOLDOWN:(.+)$/);if(cooldownMatch)return json({error:`You received no gifts in your last 3 completed battles. You can start another battle after ${cooldownMatch[1]} UTC.`},429);return json({error:message},message.includes('Account safety restriction')?403:400)}
})
