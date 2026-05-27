import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: corsHeaders })

    const { companyName, email, password, firstName } = await req.json()

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } })

    const { data: { user: caller }, error: callerError } = await supabaseUser.auth.getUser()
    if (callerError || !caller) throw new Error('Sesión inválida o expirada')

    // 1. Crear la empresa
    const { data: affiliateData, error: dbError } = await supabaseAdmin
      .from('affiliates')
      .insert([{ name: companyName }])
      .select('id')
      .single()
      
    if (dbError) throw new Error(`Error al crear la empresa: ${dbError.message}`)

    // 2. Crear el usuario nativo auto-confirmado
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        role: 'Affiliate',
        affiliate_name: companyName
      }
    })

    if (authError) {
      await supabaseAdmin.from('affiliates').delete().eq('id', affiliateData.id)
      throw new Error(`Error en Auth: ${authError.message}`)
    }

    // 3. Forzar la limpieza del bug del NULL mediante el RPC permitido
    const { error: rpcError } = await supabaseAdmin.rpc('fix_user_tokens', { target_user_id: newUser.user.id })
    if (rpcError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      await supabaseAdmin.from('affiliates').delete().eq('id', affiliateData.id)
      throw new Error(`Error al parchar tokens: ${rpcError.message}`)
    }

    return new Response(JSON.stringify({ success: true, user: newUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 400 })
  }
})