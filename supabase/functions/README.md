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
