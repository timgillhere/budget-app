import { appOrigin, startFlow } from '../_google.js';

// GET /api/auth/google — starts "Sign in with Google" by redirecting to Google's consent screen.
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.setHeader('Location', '/?auth_error=not_configured');
    return res.status(302).end();
  }

  const { url, cookie } = startFlow(appOrigin(req));
  res.setHeader('Set-Cookie', cookie);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', url);
  return res.status(302).end();
}
