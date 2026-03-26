# Tim's Budget

Personal finance tracker built with React + Vite, deployed on Vercel.

## Deploying to Vercel

### 1. Add Vercel Blob storage

In the Vercel dashboard, go to your project → **Storage** → add a **Blob** store.

### 2. Set environment variables

In the Vercel dashboard, go to your project → **Settings** → **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `ADMIN_EMAIL` | Your admin email address |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of your admin password (see below) |
| `JWT_SECRET` | A random 32-character hex string (see below) |
| `BLOB_READ_WRITE_TOKEN` | Copied from the Blob store you created above |

**Generate your admin password hash:**
```bash
node scripts/hash-password.js yourpassword
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy

Push to your connected Git repo — Vercel will build and deploy automatically.

---

## Authentication

### Logging in

Visit the app and sign in with your `ADMIN_EMAIL` and password.

### Registering other users (admin only)

1. Log in as admin
2. Click the **Users** tab (only visible to admins)
3. Enter the new user's email and password, then click **Register user**
4. They can log in immediately — each user sees only their own budget data

### Sessions

Sessions last 7 days. Refreshing the page keeps you logged in. Use the **Sign out** button in the top-right to log out.

---

## Local development

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. The `api/` serverless functions only run on Vercel — for full local API testing use `vercel dev` instead.
# budgeting-app
# budgeting-app
# budgeting-app
