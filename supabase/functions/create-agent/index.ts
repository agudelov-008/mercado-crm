import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { email, password, firstName, lastName } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseUser.auth.getUser();
    if (callerError || !caller) {
      throw new Error("Sesión inválida o expirada");
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();

    if (callerProfile?.role !== "Admin") {
      throw new Error("Solo administradores pueden crear asesores");
    }

    const { data: newUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName ?? "",
          role: "Agent",
        },
      });

    if (authError) {
      throw new Error(`Error en Auth: ${authError.message}`);
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName ?? null,
        role: "Agent",
      })
      .eq("id", newUser.user.id);

    const { error: rpcError } = await supabaseAdmin.rpc("fix_user_tokens", {
      target_user_id: newUser.user.id,
    });
    if (rpcError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw new Error(`Error al parchar tokens: ${rpcError.message}`);
    }

    return new Response(JSON.stringify({ success: true, user: newUser }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      headers: corsHeaders,
      status: 400,
    });
  }
});
