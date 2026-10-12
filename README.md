# Tim's Budget

Personal finance tracker built with React + Vite, deployed on Vercel.

## Deploying to Vercel

### 1. Add Vercel Blob storage

In the Vercel dashboard, go to your project → **Storage** → add a **Blob** store.

### 2. Create a Google OAuth client

Sign-in uses Google. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **Create credentials → OAuth client ID**, application type **Web application**. (If prompted, configure the consent screen first; the `openid`, `email` and `profile` scopes are all it needs.)
2. Under **Authorised redirect URIs** add:
   - `https://<your-domain>/api/auth/callback` (one per domain you sign in on)
   - `http://localhost:5173/api/auth/callback` (local dev)
3. Copy the **Client ID** and **Client secret**.

### 3. Set environment variables

In the Vercel dashboard, go to your project → **Settings** → **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | From the OAuth client above |
| `GOOGLE_CLIENT_SECRET` | From the OAuth client above |
| `ADMIN_EMAIL` | The Google account email that should be admin |
| `ADMIN_NAME` | Your first name (shown in the app header) |
| `DATABASE_URL` | Your Neon Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | Copied from the Blob store you created above |

### 4. Set up the database

Run `api/db/schema.sql` once against your database. If the database dates from before Google sign-in, run `api/db/migrate-to-oauth.sql` instead (after deploying). It links existing users to Google by email and deletes the old password, MFA and sync-token data.

### 5. Deploy

Push to your connected Git repo — Vercel will build and deploy automatically.

---

## Authentication

### Signing in

Click **Sign in with Google**. The first time `ADMIN_EMAIL` signs in, the admin account is created.

### Adding other users (admin only)

1. Sign in as admin
2. Open the **Users** tab
3. Enter their name and Google account email, then click **Add user**
4. They can sign in with Google straight away. Each user sees only their own budget data.

Any Google account not on the list is turned away.

### Sessions

The session cookie (`__Host-session`) holds only a random ID. It is `HttpOnly`, `Secure` and `SameSite=Strict`, so page scripts can't read it and other sites can't send it. The database stores only a SHA-256 hash of that ID. Sessions end after 1 hour of inactivity and after 7 days at most. **Settings → Sign out on all devices** ends every session.

Passwords and 2-Step Verification are handled by Google.

---

## Local development

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. `/api` requests are proxied to the deployed app (see `vite.config.js`), so sign-in redirects back to `http://localhost:5173` — keep that redirect URI on the Google OAuth client.
