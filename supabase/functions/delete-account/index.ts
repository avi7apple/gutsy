// Supabase Edge Function: delete-account
//
// Why this exists:
//   `supabase.auth.admin.deleteUser()` requires the SERVICE_ROLE key. The
//   mobile app only has the ANON key (correctly — exposing service role on
//   a client is a critical security hole). So when the in-app "Delete
//   Account" button calls `admin.deleteUser` it silently fails and leaves
//   the `auth.users` row behind. Future sign-ins with the same Apple/Google
//   identity then map back to the same UUID and the user sees orphaned data
//   (e.g. their old meal_scans rows).
//
//   This Edge Function uses the service role key from Supabase Secrets to
//   actually delete the auth user. Because `meal_scans` and `user_profiles`
//   both have `on delete cascade` against `auth.users (id)`, a single
//   `admin.deleteUser` call wipes everything atomically.
//
// Auth model:
//   - Caller passes their own access token in the `Authorization: Bearer`
//     header (Supabase JS client does this automatically when you call
//     `supabase.functions.invoke`).
//   - We resolve the user with the ANON-key client + that token, so we
//     never trust a `user_id` from the request body.
//   - Only then do we hand off to the SERVICE-ROLE client to delete.
//
// Deploy:
//   1. supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
//      (Already auto-set in the function runtime on Supabase-hosted projects,
//       but verify in Dashboard → Edge Functions → Secrets.)
//   2. supabase functions deploy delete-account

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      {
        error:
          "delete-account function is misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing from secrets.",
      },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(
      { error: "Missing Authorization: Bearer <jwt> header" },
      401,
    );
  }

  // 1. Identify the caller from THEIR token, never from the request body.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();

  if (userErr || !user) {
    return jsonResponse(
      { error: "Could not authenticate caller", details: userErr?.message },
      401,
    );
  }

  // 2. Use the service-role client to perform the actual destructive op.
  //    The on-delete-cascade FK constraints on `user_profiles` and
  //    `meal_scans` (and any other table referencing `auth.users`) wipe
  //    those rows automatically.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Explicit deletes first as a belt-and-suspenders for any table that
  // somehow has cascade missing. Errors are non-fatal because the auth
  // delete below cascades anyway.
  await adminClient.from("meal_scans").delete().eq("user_id", user.id);
  await adminClient.from("user_profiles").delete().eq("id", user.id);

  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return jsonResponse(
      {
        error: "Failed to delete auth user",
        details: deleteErr.message,
      },
      500,
    );
  }

  return jsonResponse({ ok: true, deleted_user_id: user.id });
});
