# OAuth Provider Setup Guide

This guide walks you through setting up Apple and Google OAuth for Gutsy.

## Prerequisites

- Apple Developer account (for Apple Sign-In) - $99/year
- Google Cloud Platform account (free)
- Supabase project with Auth enabled

---

## Google OAuth Setup

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the **OAuth consent screen**:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in:
     - **App name**: Gutsy
     - **User support email**: Your email
     - **Developer contact**: Your email
   - Add scopes (these are added by default):
     - `.../auth/userinfo.profile`
     - `.../auth/userinfo.email`
     - `openid` (add manually)
   - Save and continue

### Step 2: Configure OAuth Client

1. **Application type**: Choose **Web application**
2. **Name**: Gutsy (or Gutsy Mobile)
3. **Authorized JavaScript origins**:
   ```
   http://localhost:8081
   https://[your-project-ref].supabase.co
   ```
   (Replace `[your-project-ref]` with your Supabase project reference)

4. **Authorized redirect URIs**:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
   ⚠️ **Important**: 
   - **Only add the Supabase callback URL** (Google doesn't accept custom URL schemes like `gutsy://`)
   - The deep link `gutsy://auth/callback` is configured in Supabase, not Google
   - Google redirects to Supabase, then Supabase redirects to your app's deep link

5. Click **Create**
6. **Save the Client ID and Client Secret** (you'll need these)

### Step 3: Configure in Supabase Dashboard

1. Go to your Supabase project → **Authentication** → **Providers**
2. Find **Google** and click to expand
3. Toggle **Enable Google provider**
4. Enter:
   - **Client ID (for OAuth)**: Your Google Client ID
   - **Client secret (for OAuth)**: Your Google Client Secret
5. Click **Save**

---

## Apple OAuth Setup

### Step 1: Create App ID in Apple Developer

1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles** → **Identifiers**
3. Click **+** to create a new identifier
4. Select **App IDs** → **Continue**
5. Select **App** → **Continue**
6. Fill in:
   - **Description**: Gutsy
   - **Bundle ID**: `com.yourcompany.gutsy` (or your actual bundle ID)
7. Under **Capabilities**, check **Sign In with Apple**
8. Click **Continue** → **Register**

### Step 2: Create Services ID

1. Still in **Identifiers**, click **+** again
2. Select **Services IDs** → **Continue**
3. Fill in:
   - **Description**: Gutsy Web Services
   - **Identifier**: `com.yourcompany.gutsy.web` (or similar)
4. Click **Continue** → **Register**
5. Click on the newly created Services ID
6. Check **Sign In with Apple** → **Configure**
7. **Primary App ID**: Select your App ID from Step 1
8. **Website URLs**:
   - **Domains and Subdomains**: `[your-project-ref].supabase.co`
   - **Return URLs**: 
     ```
     https://[your-project-ref].supabase.co/auth/v1/callback
     ```
   ⚠️ **Note**: Apple also doesn't accept custom URL schemes here. The deep link `gutsy://auth/callback` is configured in Supabase Dashboard → Authentication → URL Configuration.
9. Click **Save** → **Continue** → **Save**

### Step 3: Create Signing Key

1. Go to **Keys** section in Apple Developer Console
2. Click **+** to create a new key
3. Fill in:
   - **Key Name**: Gutsy Sign In Key
   - Check **Sign In with Apple**
4. Click **Continue** → **Register**
5. **Download the `.p8` file** (you can only download it once!)
6. Note the **Key ID** shown on the page

### Step 4: Generate Client Secret

Apple requires a JWT client secret that rotates every 6 months. You can generate it using:

**Option A: Use Supabase's built-in tool** (in the Dashboard)
- Go to Supabase Dashboard → **Authentication** → **Providers** → **Apple**
- There's a tool to generate the secret if you provide:
  - Team ID (found in top-right of Apple Developer Console)
  - Key ID (from Step 3)
  - Services ID (from Step 2)
  - Upload the `.p8` file

**Option B: Generate manually** (if needed)
- Use a tool like [this one](https://appleid.apple.com/sign-in-with-apple/jwt) or a script
- You'll need: Team ID, Key ID, Services ID, and the `.p8` file

### Step 5: Configure in Supabase Dashboard

1. Go to your Supabase project → **Authentication** → **Providers**
2. Find **Apple** and click to expand
3. Toggle **Enable Apple provider**
4. Enter:
   - **Services ID**: Your Services ID (e.g., `com.yourcompany.gutsy.web`)
   - **Team ID**: Your Apple Team ID (10-character alphanumeric)
   - **Key ID**: The Key ID from Step 3
   - **Private Key**: Upload the `.p8` file or paste its contents
   - **Client Secret**: The generated JWT secret (if using Option B)
5. Click **Save**

⚠️ **Important**: Apple client secrets expire every 6 months. Set a reminder to regenerate!

---

## Configure Redirect URLs in Supabase

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   ```
   gutsy://auth/callback
   ```
3. **Site URL** should be set to your app's main URL (or leave as default)

---

## Testing

### Google
1. In your app, tap "Sign in with Google"
2. You should see Google's consent screen
3. After approval, you should be redirected back to your app
4. Check Supabase Dashboard → **Authentication** → **Users** to see the new user

### Apple
1. In your app, tap "Sign in with Apple"
2. You should see Apple's sign-in screen
3. After approval, you should be redirected back to your app
4. Check Supabase Dashboard → **Authentication** → **Users** to see the new user

---

## Troubleshooting

### "Redirect URI mismatch"
- **Google**: Only add `https://[your-project-ref].supabase.co/auth/v1/callback` (Google doesn't accept custom URL schemes)
- **Apple**: Only add `https://[your-project-ref].supabase.co/auth/v1/callback` (Apple doesn't accept custom URL schemes)
- **Supabase**: Add `gutsy://auth/callback` in Authentication → URL Configuration (this is where the deep link goes)
- The flow is: Provider → Supabase → Your App (via deep link)

### "Invalid client"
- Double-check your Client ID and Client Secret are correct
- For Apple, ensure your Services ID matches exactly

### Apple secret expired
- Regenerate the client secret using the same `.p8` file
- Update it in Supabase Dashboard

### Deep link not working
- Verify your `app.json` has `"scheme": "gutsy"` (already configured ✅)
- Test the deep link manually: `gutsy://auth/callback`

---

## Security Notes

1. **Never commit** `.p8` files, Client Secrets, or API keys to git
2. Store secrets securely (use environment variables for production)
3. Rotate Apple secrets every 6 months
4. Use HTTPS in production (Supabase provides this automatically)

---

## Next Steps

After setup:
1. ✅ Run the migration: `supabase/migrations/20260215_user_profiles.sql`
2. ✅ Test sign-in flows
3. ✅ Verify onboarding data syncs to `user_profiles` table
4. ✅ Check that users appear in Supabase Dashboard → Authentication → Users
