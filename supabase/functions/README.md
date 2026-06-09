# Edge Functions

## analyze-scan

This function runs **all** scan analysis and calls the **Groq LLM**. The app does not call Groq directly; it only calls this Edge Function, which then calls Groq and returns the result (including `personalizedInsights`, `bloatDetails`, etc.). If you see **404** when scanning, the function is not deployed.

### Deploy

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
2. Set the Groq API key (Dashboard → Edge Functions → Secrets, or CLI):
   ```bash
   supabase secrets set GROQ_API_KEY=your_groq_api_key
   ```
3. Deploy the function:
   ```bash
   supabase functions deploy analyze-scan
   ```

After deployment, scans will hit this function and you should see usage in the [Groq dashboard](https://console.groq.com).

## delete-account

Permanently deletes the calling user's `auth.users` row using the service-role key. The mobile app cannot call `auth.admin.deleteUser` directly because it only has the anon key; without this function the in-app delete leaves orphan `auth.users` rows, which causes old scans/profile data to reappear when the same Apple/Google identity signs in again.

### Deploy

```bash
supabase functions deploy delete-account
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase at runtime — no manual secret setup required on the hosted platform. For local `supabase functions serve`, export them in your shell first.

### How the app calls it

The Profile screen invokes it via `supabase.functions.invoke("delete-account", { method: "POST" })`, which automatically attaches the user's JWT in the `Authorization` header. The function resolves the caller from that JWT (never trusts a `user_id` in the body), then deletes the row. FK `on delete cascade` constraints on `user_profiles` and `meal_scans` clean up everything else.
