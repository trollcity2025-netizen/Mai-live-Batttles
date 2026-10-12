import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try {
    const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401)
    const {db,profile:admin}=await requireAdmin(auth); const {requestId,action}=await request.json()
    if(typeof requestId!=='string'||action!=='complete') return json({error:'Deletion request ID and complete action are required'},400)
    const {data:req,error:reqError}=await db.from('account_deletion_requests').select('*').eq('id',requestId).single()
    if(reqError||!req) return json({error:'Deletion request not found'},404)
    if(req.status==='completed') return json({status:'completed',alreadyCompleted:true})
    if(!['requested','processing'].includes(req.status)) return json({error:'This deletion request is not processable'},409)
    const {data:profile,error:profileError}=await db.from('user_profiles').select('id,user_id,username,avatar_path').eq('id',req.user_profile_id).single()
    if(profileError||!profile) return json({error:'Profile record not found'},404)
    const authUserId=req.auth_user_id||profile.user_id
    await db.from('account_deletion_requests').update({status:'processing'}).eq('id',requestId)
    if(profile.avatar_path) await db.storage.from('profile-avatars').remove([profile.avatar_path])
    await db.from('payout_recipients').delete().eq('user_profile_id',profile.id)
    await db.from('user_profiles').update({user_id:null,username:`deleted_${profile.id.replaceAll('-','').slice(0,12)}`,display_name:'Deleted User',avatar_path:null,avatar_url:null,bio:null,gender:null,city:null,state_code:null,role:'user',profile_complete:false,marketing_recording_consent:false,marketing_recording_consent_at:null,account_status:'deleted'}).eq('id',profile.id)
    if(authUserId) { const {error:deleteAuthError}=await db.auth.admin.deleteUser(authUserId); if(deleteAuthError) throw deleteAuthError }
    await db.from('account_deletion_requests').update({status:'completed',auth_user_id:null,completed_at:new Date().toISOString(),retained_records_note:'Profile identifiers were anonymized. Financial, safety, and audit records may remain where required for security, reconciliation, or legal compliance.'}).eq('id',requestId)
    await db.from('admin_audit_logs').insert({admin_profile_id:admin.id,action:'account_deletion_completed',target_type:'account_deletion_request',target_id:requestId,reason:'User requested account deletion',metadata:{profile_id:profile.id,auth_user_deleted:Boolean(authUserId)}})
    return json({status:'completed',profileId:profile.id})
  }catch(error){return json({error:errorMessage(error)},400)}
})
