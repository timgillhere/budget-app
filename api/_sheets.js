// Minimal Google Sheets REST client authenticated as a service account. No googleapis dependency,
// and no JWT library either — the RS256 assertion is signed with node's crypto, same as _auth.js
// and _google.js do. Only what the store needs.
import crypto from 'crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export function parseCredentials(raw) {
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set.');
  let text = raw.trim();
  if (!text.startsWith('{')) text = Buffer.from(text, 'base64').toString('utf8'); // allow base64-encoded
  const c = JSON.parse(text);
  if (!c.client_email || !c.private_key) throw new Error('Service account JSON needs client_email and private_key.');
  c.private_key = c.private_key.replace(/\\n/g, '\n');
  return c;
}

export const quoteTab = name => `'${name.replace(/'/g, "''")}'`;

// Signed service-account assertion (RFC 7523): base64url(header).base64url(claims).base64url(sig).
const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');

function signAssertion(claims, privateKey) {
  const body = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(body);
  signer.end();
  return `${body}.${signer.sign(privateKey).toString('base64url')}`;
}

export class SheetsClient {
  constructor({ spreadsheetId, credentials, fetchImpl }) {
    if (!spreadsheetId) throw new Error('GOOGLE_SHEET_ID is not set.');
    this.id = spreadsheetId;
    this.creds = credentials;
    this.fetch = fetchImpl || globalThis.fetch;
    this._tok = null;
  }

  async token() {
    const now = Math.floor(Date.now() / 1000);
    if (this._tok && this._tok.exp - 60 > now) return this._tok.value;
    const assertion = signAssertion(
      { iss: this.creds.client_email, scope: SCOPE, aud: this.creds.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
      this.creds.private_key
    );
    const r = await this.fetch(this.creds.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Google auth failed: ${j.error_description || j.error || r.status}`);
    this._tok = { value: j.access_token, exp: now + (j.expires_in || 3600) };
    return this._tok.value;
  }

  async req(method, path, body, attempt = 0) {
    const r = await this.fetch(`${API}/${this.id}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise(res => setTimeout(res, 500 * 2 ** attempt));
      return this.req(method, path, body, attempt + 1);
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(`Sheets API ${r.status}: ${j.error?.message || 'request failed'}`);
      e.status = r.status === 404 || r.status === 403 ? 502 : r.status;
      throw e;
    }
    return j;
  }

  // ── The three primitives the store uses ──
  async batchGet(ranges) {
    const q = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const j = await this.req('GET', `/values:batchGet?${q}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&majorDimension=ROWS`);
    return (j.valueRanges || []).map(v => v.values || []);
  }
  async batchUpdate(data, input = 'RAW') {
    if (!data.length) return;
    await this.req('POST', '/values:batchUpdate', { valueInputOption: input, data });
  }
  async batchClear(ranges) {
    if (!ranges.length) return;
    await this.req('POST', '/values:batchClear', { ranges });
  }

  // ── Setup helpers (used by scripts/sheet-sync.mjs) ──
  async tabs() {
    const j = await this.req('GET', '?fields=sheets.properties(sheetId,title)');
    return (j.sheets || []).map(s => s.properties);
  }
  async structure(requests) {
    if (!requests.length) return;
    await this.req('POST', ':batchUpdate', { requests });
  }
}

export function clientFromEnv(env = process.env) {
  return new SheetsClient({ spreadsheetId: env.GOOGLE_SHEET_ID, credentials: parseCredentials(env.GOOGLE_SERVICE_ACCOUNT_JSON) });
}

// The single seam between "which user is this" and "which spreadsheet holds their data".
// Today: one sheet, one owner — anyone else has no store at all. When users bring their own sheet,
// this is the only function that changes (look the id up per user instead of reading it from env).
// Returns null rather than throwing so callers can answer 403 without leaking whether a sheet exists.
export function sheetForUser(user, env = process.env) {
  if (!env.SHEETS_USER_ID || String(user?.userId) !== String(env.SHEETS_USER_ID)) return null;
  return { spreadsheetId: env.GOOGLE_SHEET_ID, credentials: parseCredentials(env.GOOGLE_SERVICE_ACCOUNT_JSON) };
}

// Convenience for the API routes: the client for this user's sheet, or null if they don't have one.
export function clientForUser(user, env = process.env) {
  const cfg = sheetForUser(user, env);
  return cfg && new SheetsClient(cfg);
}

export const sheetUrl = id => `https://docs.google.com/spreadsheets/d/${id}/edit`;
