import { useState, useEffect } from 'react';

const inputCls = "w-full bg-nb-800 text-slate-300 rounded-lg px-3 py-2.5 text-sm neon-input";

// ── QR code rendered via a data URI from the otpauth URL ──────────────
function QrCode({ otpauthUrl }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    // Use a free QR generation API (server-side rendering) — we pass the otpauth URL
    // We render via a <canvas> using a tiny inline approach with the qrcode library
    // Since we don't want another dependency, use the Google Charts QR endpoint (no tracking, just rendering)
    const encoded = encodeURIComponent(otpauthUrl);
    setSrc(`https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encoded}&choe=UTF-8`);
  }, [otpauthUrl]);

  return src ? (
    <img src={src} alt="QR code for authenticator app" className="mx-auto rounded-lg border border-nb-600 bg-white p-1" width={200} height={200} />
  ) : null;
}

// ── Change password section ───────────────────────────────────────────
function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setStatus({ type: 'error', message: 'Passwords do not match' }); return; }
    if (newPassword.length < 8) { setStatus({ type: 'error', message: 'Password must be at least 8 characters' }); return; }
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setStatus({ type: 'success', message: 'Password updated successfully.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-nb-750 rounded-xl overflow-hidden">
      <div className="px-6 py-4 bg-nb-700">
        <h2 className="text-base font-bold text-slate-300">Change Password</h2>
      </div>
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-w-sm">
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Current password</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className={inputCls} placeholder="••••••••" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">New password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className={inputCls} placeholder="Min. 8 characters" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Confirm new password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputCls} placeholder="••••••••" />
        </div>
        {status && (
          <p className={`text-sm rounded-lg px-3 py-2 border ${status.type === 'success' ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/60' : 'text-red-400 bg-red-900/20 border-red-800/60'}`} role="alert">
            {status.message}
          </p>
        )}
        <button type="submit" disabled={loading} className="bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

// ── TOTP setup flow ───────────────────────────────────────────────────
function TotpSetup({ onComplete }) {
  const [step, setStep] = useState('start'); // start | scan | backup
  const [otpauthUrl, setOtpauthUrl] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ step: 'start' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start setup');
      setOtpauthUrl(data.otpauthUrl);
      setStep('scan');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function confirmSetup(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: 'confirm', code: code.replace(/\s/g, '') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      setBackupCodes(data.backupCodes);
      setStep('backup');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'));
  }

  if (step === 'start') return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) to add an extra layer of security.
      </p>
      {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">{error}</p>}
      <button onClick={startSetup} disabled={loading} className="bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors">
        {loading ? 'Generating…' : 'Set up 2FA'}
      </button>
    </div>
  );

  if (step === 'scan') return (
    <div className="space-y-4 max-w-xs">
      <p className="text-sm text-slate-400">Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
      {otpauthUrl && <QrCode otpauthUrl={otpauthUrl} />}
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer hover:text-slate-400">Can't scan? Enter manually</summary>
        <p className="mt-2 break-all font-mono text-slate-500 bg-nb-800 rounded p-2">{otpauthUrl}</p>
      </details>
      <form onSubmit={confirmSetup} className="space-y-3">
        <input
          type="tel" inputMode="numeric" maxLength={6} value={code}
          onChange={e => setCode(e.target.value)} required autoFocus
          className={`${inputCls} text-center tracking-widest text-lg`}
          placeholder="000000"
        />
        {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading || !code} className="w-full bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
          {loading ? 'Verifying…' : 'Verify and enable'}
        </button>
      </form>
    </div>
  );

  if (step === 'backup') return (
    <div className="space-y-4 max-w-sm">
      <div className="bg-amber-900/20 border border-amber-700/60 rounded-lg px-4 py-3">
        <p className="text-amber-300 font-semibold text-sm">Save these backup codes now</p>
        <p className="text-amber-400/70 text-xs mt-1">These will not be shown again. Each code can only be used once if you lose access to your authenticator app.</p>
      </div>
      <div className="bg-nb-800 rounded-lg p-4 font-mono text-sm space-y-1">
        {backupCodes.map(c => <div key={c} className="text-slate-300">{c}</div>)}
      </div>
      <div className="flex gap-2">
        <button onClick={copyBackupCodes} className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg text-sm transition-colors">
          Copy codes
        </button>
      </div>
      <div className="flex items-start gap-2 pt-1">
        <input
          type="checkbox" id="codes-saved" checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-0.5 accent-neuro-500"
        />
        <label htmlFor="codes-saved" className="text-sm text-slate-400 cursor-pointer">
          I have saved my backup codes in a safe place
        </label>
      </div>
      <button onClick={onComplete} disabled={!confirmed} className="w-full bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
        Done — 2FA is now active
      </button>
    </div>
  );
}

// ── Disable MFA ───────────────────────────────────────────────────────
function DisableMfa({ onComplete }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (!confirm) return (
    <button onClick={() => setConfirm(true)} className="border border-red-800/60 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg text-sm transition-colors">
      Disable 2FA
    </button>
  );

  async function handleDisable(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/mfa-disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');
      onComplete();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleDisable} className="space-y-3 max-w-xs">
      <p className="text-sm text-slate-400">Enter your password and current authenticator code to confirm.</p>
      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="Current password" className={inputCls} />
      <input type="tel" inputMode="numeric" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value)} required placeholder="Authenticator code" className={`${inputCls} text-center tracking-widest`} />
      {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirm(false)} className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors">
          {loading ? 'Disabling…' : 'Confirm disable'}
        </button>
      </div>
    </form>
  );
}

// ── Regenerate backup codes ───────────────────────────────────────────
function RegenBackupCodes() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="border border-nb-500 text-slate-400 hover:text-slate-200 hover:border-nb-400 px-4 py-2 rounded-lg text-sm transition-colors">
      Regenerate backup codes
    </button>
  );

  if (codes) return (
    <div className="space-y-3 max-w-sm">
      <div className="bg-amber-900/20 border border-amber-700/60 rounded-lg px-4 py-3">
        <p className="text-amber-300 font-semibold text-sm">New backup codes</p>
        <p className="text-amber-400/70 text-xs mt-1">Old codes have been invalidated. Save these somewhere safe.</p>
      </div>
      <div className="bg-nb-800 rounded-lg p-4 font-mono text-sm space-y-1">
        {codes.map(c => <div key={c} className="text-slate-300">{c}</div>)}
      </div>
      <button onClick={() => navigator.clipboard.writeText(codes.join('\n'))} className="border border-nb-500 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg text-sm transition-colors">
        Copy codes
      </button>
    </div>
  );

  async function handleRegen(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/backup-codes-regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate codes');
      setCodes(data.backupCodes);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleRegen} className="space-y-3 max-w-xs">
      <p className="text-sm text-slate-400">Enter your password to generate new backup codes. Old codes will be invalidated.</p>
      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="Current password" className={inputCls} autoFocus />
      {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={loading} className="flex-1 bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors">
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>
    </form>
  );
}

// ── Main SecuritySettings panel ───────────────────────────────────────
export default function SecuritySettings() {
  const [mfaEnabled, setMfaEnabled] = useState(null); // null = loading

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setMfaEnabled(d.mfaEnabled ?? false))
      .catch(() => setMfaEnabled(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      <ChangePassword />

      <div className="bg-nb-750 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-nb-700">
          <h2 className="text-base font-bold text-slate-300">Two-Factor Authentication</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Add a second factor to protect your account. Uses an authenticator app — no SMS.
          </p>
        </div>

        <div className="px-6 py-5">
          {mfaEnabled === null && <p className="text-slate-500 text-sm">Loading…</p>}

          {mfaEnabled === false && (
            <TotpSetup onComplete={() => setMfaEnabled(true)} />
          )}

          {mfaEnabled === true && (
            <div className="space-y-4">
              <p className="text-emerald-400 text-sm font-medium">✓ Two-factor authentication is active</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <RegenBackupCodes />
                <DisableMfa onComplete={() => setMfaEnabled(false)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
