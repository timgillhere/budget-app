# Tim's Budget

Personal finance tracker built with React + Vite, deployed on Vercel.

## Deploying to Vercel

### 1. Storage

Your data lives in a Google Sheet — see [The data store](#the-data-store-your-google-sheet) below.
Postgres holds users and sessions. A Vercel **Blob** store is only needed if you are migrating off an
older Blob-backed deployment.

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
| `GOOGLE_SHEET_ID` | The id from your sheet's URL (see below) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account key for that sheet, raw JSON or base64 |
| `SHEETS_USER_ID` | The app user id that owns the sheet |
| `BLOB_READ_WRITE_TOKEN` | Only needed to run the Blob→Sheets migration |

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
4. They can sign in with Google straight away.

Any Google account not on the list is turned away.

Note that budget data currently lives in **one** spreadsheet belonging to `SHEETS_USER_ID`. Any other
signed-in account authenticates fine but gets `403 — this account has no data store`. Giving each user
their own sheet means changing one function (`sheetForUser` in `api/_sheets.js`) to look the id up per
user instead of reading it from the environment.

### Sessions

The session cookie (`__Host-session`) holds only a random ID. It is `HttpOnly`, `Secure` and `SameSite=Strict`, so page scripts can't read it and other sites can't send it. The database stores only a SHA-256 hash of that ID. Sessions end after 1 hour of inactivity and after 7 days at most. **Settings → Sign out on all devices** ends every session.

Passwords and 2-Step Verification are handled by Google.

---

## The data store: your Google Sheet

The budget, trips, settings, net worth, pensions, goals, transactions and merchant rules all live in a
Google Sheet — readable and editable by hand. Postgres still holds users and sessions, and Vercel Blob
is no longer used by the app (only by the migration script).

### Setup

1. In the same Google Cloud project as your OAuth client: create a **service account**, enable the
   **Google Sheets API**, and download the service account's JSON key.
2. Share the spreadsheet with the service account's `client_email` (**Viewer** is enough for the app — it only reads; the setup scripts under `scripts/` need **Editor**).
3. Set `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` and `SHEETS_USER_ID` (above), locally in
   `.env.local` too.
4. `node --env-file=.env.local scripts/sheet-sync.mjs init` — creates missing tabs and columns. Safe to
   re-run: headers are written into the columns they already occupy, so a sheet you have rearranged
   stays rearranged.
5. `node --env-file=.env.local scripts/sheet-sync.mjs check` — verifies credentials and that every
   tab/column exists. The same check powers **Settings → Where Your Data Lives** in the app.

The service account signs its own token with `crypto` — no `googleapis` or JWT dependency.

### Migrating off Vercel Blob

```bash
node --env-file=.env.local scripts/migrate-blob-to-sheets.mjs            # dry run (default)
node --env-file=.env.local scripts/migrate-blob-to-sheets.mjs --commit   # apply
```

Copies `budget.json`, every `transactions/YYYY-MM.json` and `merchant-rules.json` into the sheet.
Because the sheet's budget tabs may have been filled in by hand, the script prints a field-level diff
of Blob vs sheet and **stops** rather than guessing — re-run with `--take-blob` (Blob wins) or
`--keep-sheet` (sheet wins). Transactions migrate in a single read+write for the whole history, and
re-running is safe since each month replaces only its own rows. `sync-status.json` is skipped, as bank
sync no longer exists.

### Other commands

- `scripts/sheet-sync.mjs pull [out.json]` / `push <budget.json>` — move the budget in and out as JSON.
- `scripts/sheet-sync.mjs pots` — prints `Pots` totals next to the `Groups` tab. `Pots` is organised
  differently from `Groups` (several pots per group, different names), so there is no safe automatic
  mapping; use this to fill in `Groups!Balance` by hand. That column is what the app shows as each
  group's "Held" amount.
- `npm run test:sheets` — round-trip tests against an in-memory fake, no network.

### How the sheet is treated

- Columns are matched **by header name**, so you can reorder them or add your own.
- Header cells holding a formula (Annual, Monthly total, Progress…) are never written by the app.
- Unknown fields round-trip through each tab's `Extra` JSON column, so nothing is lost as the app grows.
- Tabs the app doesn't know about are left completely alone. `Lists` is **hand-maintained** — `init`
  creates the tab but never fills it; it feeds the dropdowns and the `Settings!Label` lookup.
- The app saves a **whole document at a time**, so reload it after editing the sheet by hand.

---

## Local development

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. `/api` requests are proxied to the deployed app (see `vite.config.js`), so sign-in redirects back to `http://localhost:5173` — keep that redirect URI on the Google OAuth client.
