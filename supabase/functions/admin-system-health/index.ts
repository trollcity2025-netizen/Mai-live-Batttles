import { corsHeaders, errorMessage, json } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/supabase.ts'
Deno.serve(async (request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders})
  try { const auth=request.headers.get('Authorization'); if(!auth) return json({error:'Authorization required'},401); await requireAdmin(auth)
    const has=(name:string)=>Boolean(Deno.env.get(name)?.trim())
    return json({
      supabase:has('SUPABASE_URL')&&has('SUPABASE_SERVICE_ROLE_KEY')&&has('SUPABASE_ANON_KEY'),
      getstream:has('GETSTREAM_API_KEY')&&has('GETSTREAM_API_SECRET'),
      openrouter:has('OPENROUTER_API_KEY')&&has('OPENROUTER_MODERATION_MODEL'),
      paypal:has('PAYPAL_CLIENT_ID')&&has('PAYPAL_CLIENT_SECRET')&&has('PAYPAL_WEBHOOK_ID'),
      publicUrl:has('PUBLIC_APP_URL'),
      payoutProvider:has('PAYPAL_CLIENT_ID')&&has('PAYPAL_CLIENT_SECRET'),
      checkedAt:new Date().toISOString(),
    })
  }catch(error){return json({error:errorMessage(error)},400)}
})
