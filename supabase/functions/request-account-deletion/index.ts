import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireProfile } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,user,profile}=await requireProfile(auth); const body=await request.json(); if(body.confirmation!=='DELETE') return json({error:'Explicit DELETE confirmation required'},400)
    const {data:existing}=await db.from('account_deletion_requests').select('id,status').eq('user_profile_id',profile.id).in('status',['requested','processing']).maybeSingle(); if(existing) return json({status:existing.status,requestId:existing.id})
    const {data,error}=await db.from('account_deletion_requests').insert({user_profile_id:profile.id,auth_user_id:user.id,status:'requested'}).select('id').single(); if(error) throw error
    await db.from('user_profiles').update({account_status:'deletion_requested'}).eq('id',profile.id)
    const {error:banError}=await db.auth.admin.updateUserById(user.id,{ban_duration:'876000h',user_metadata:{...user.user_metadata,account_deletion_requested:true}}); if(banError) throw banError
    return json({status:'requested',requestId:data.id,message:'Your deletion request was recorded. The account is now restricted pending secure deletion and financial-record review.'})
  }catch(error){return json({error:errorMessage(error)},400)}
})
