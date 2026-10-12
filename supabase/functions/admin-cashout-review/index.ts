import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireAdmin(auth); const {cashoutRequestId,action,reason}=await request.json(); if(typeof cashoutRequestId!=='string'||!['approve','reject'].includes(action)) return json({error:'Valid request ID and action required'},400)
    const {data,error}=await db.rpc('review_cashout_request',{p_cashout_id:cashoutRequestId,p_admin_profile_id:profile.id,p_action:action,p_reason:typeof reason==='string'?reason:null}); if(error) throw error
    return json(data)
  }catch(error){return json({error:errorMessage(error)},400)}
})
