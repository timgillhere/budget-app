import { useState } from 'react';

const inputCls = "w-full bg-nb-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-600 neon-input text-center tracking-widest text-lg"

export default function MfaVerifyScreen({ onVerified, onCancel }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* empty */ }
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      await onVerified();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold text-white">Two-Factor Auth</h1>
          <p className="text-slate-500 text-sm mt-1">
            {useBackup ? 'Enter a backup recovery code' : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-nb-750 rounded-2xl border border-nb-600 p-6 space-y-4 shadow-2xl nb-card-glow">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              {useBackup ? 'Recovery code' : 'Authentication code'}
            </label>
            <input
              type={useBackup ? 'text' : 'tel'}
              inputMode={useBackup ? 'text' : 'numeric'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={useBackup ? 11 : 6}
              required
              autoFocus
              autoComplete="one-time-code"
              className={inputCls}
              placeholder={useBackup ? 'xxxxx-xxxxx' : '000000'}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code}
            className="w-full bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>

          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              onClick={() => { setUseBackup(b => !b); setCode(''); setError(''); }}
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              {useBackup ? 'Use authenticator code instead' : 'Use a backup code instead'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
            >
              Cancel and sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
