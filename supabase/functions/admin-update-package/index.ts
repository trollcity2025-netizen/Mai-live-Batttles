import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); const {db,profile}=await requireAdmin(auth); const {packageId,active,confirmPricing}=await request.json(); if(typeof packageId!=='string'||typeof active!=='boolean') return json({error:'Package ID and active status are required'},400)
    const {data:pkg,error:lookupError}=await db.from('bullet_packages').select('*').eq('id',packageId).single(); if(lookupError||!pkg) return json({error:'Package not found'},404)
    if(pkg.requires_admin_confirmation&&active!==false&&!confirmPricing) return json({error:'Explicit pricing confirmation is required for this package.'},409)
    if(pkg.requires_admin_confirmation&&active===true&&confirmPricing===true&&Number(pkg.bullets)!==31500) return json({error:'Unexpected flagged package configuration.'},409)
    const update={active,requires_admin_confirmation:active?false:pkg.requires_admin_confirmation,updated_at:new Date().toISOString()}
    const {error}=await db.from('bullet_packages').update(update).eq('id',packageId); if(error) throw error
    await db.from('admin_audit_logs').insert({admin_profile_id:profile.id,action:'bullet_package_updated',target_type:'bullet_package',target_id:packageId,metadata:{package_key:pkg.package_key,active,confirmPricing:Boolean(confirmPricing),bullets:pkg.bullets,price_usd:pkg.price_usd}})
    return json({status:'updated',active,requiresAdminConfirmation:active?false:pkg.requires_admin_confirmation})
  }catch(error){return json({error:errorMessage(error)},400)}
})
