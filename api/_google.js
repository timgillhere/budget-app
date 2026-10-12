import crypto from 'crypto';

// Google OAuth 2.0 / OpenID Connect — authorization-code flow with PKCE.
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Google Cloud → APIs & Services → Credentials).
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// Short-lived cookie carrying state + PKCE verifier between /api/auth/google and the callback.
// SameSite=Lax (not Strict) because the callback is a top-level redirect from accounts.google.com.
export const FLOW_COOKIE = '__Host-oauth-flow';
const FLOW_MAX_AGE = 10 * 60;

// Local dev runs on Vite and proxies /api to the deployed app, so the deployed function sees
// the production Host. vite.config.js tags proxied requests with this header so the redirect
// comes back to localhost. Browsers can't add custom headers to a navigation, so a third party
// can't use this to redirect anyone else's sign-in; Google also only accepts registered URIs.
const DEV_ORIGINS = ['http://localhost:5173'];

export function appOrigin(req) {
  const dev = req.headers['x-oauth-dev-origin'];
  if (dev && DEV_ORIGINS.includes(dev)) return dev;
  return `https://${req.headers.host}`;
}

export function redirectUri(origin) {
  return `${origin}/api/auth/callback`;
}

const b64url = buf => buf.toString('base64url');

export function startFlow(origin) {
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();

  const cookieValue = b64url(Buffer.from(JSON.stringify({ state, verifier, origin })));
  const cookie = `${FLOW_COOKIE}=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${FLOW_MAX_AGE}`;
  return { url: url.toString(), cookie };
}

export function clearFlowCookie() {
  return `${FLOW_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readFlowCookie(value) {
  try {
    const flow = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof flow.state === 'string' && typeof flow.verifier === 'string' && typeof flow.origin === 'string') {
      return flow;
    }
  } catch { /* fall through */ }
  return null;
}

// Exchanges the code for tokens and returns the verified identity claims.
// The ID token comes straight from Google's token endpoint over TLS, authenticated with our
// client secret, so per OIDC Core §3.1.3.7 its claims can be trusted without a JWKS signature
// check — we still validate issuer, audience and expiry.
export async function exchangeCode(code, verifier, origin) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status})`);
  const { id_token } = await res.json();
  if (!id_token) throw new Error('No ID token returned');

  const claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString('utf8'));
  if (!ISSUERS.includes(claims.iss)) throw new Error('Unexpected issuer');
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('Unexpected audience');
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error('ID token expired');
  if (!claims.sub) throw new Error('ID token missing subject');

  return {
    sub: claims.sub,
    email: (claims.email || '').toLowerCase().trim(),
    emailVerified: claims.email_verified === true,
    name: claims.given_name || claims.name || '',
  };
}
