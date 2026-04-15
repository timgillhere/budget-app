import { useState, useEffect } from 'react';

const inputCls = "w-full bg-nb-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-600 neon-input";

export default function SetPasswordScreen({ token, type, onDone }) {
  const [tokenInfo, setTokenInfo] = useState(null); // { valid, name, email, reason }
  const [validating, setValidating] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/auth/password-reset?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        setTokenInfo(data);
      } catch {
        setTokenInfo({ valid: false, reason: 'Could not verify your link. Please try again.' });
      } finally {
        setValidating(false);
      }
    }
    validateToken();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set password');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isInvite = type === 'invite' || tokenInfo?.type === 'invite';

  return (
    <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-slate-500 text-sm mt-1">
            {isInvite ? 'Set up your account' : 'Reset your password'}
          </p>
        </div>

        <div className="bg-nb-750 rounded-2xl border border-nb-600 p-6 space-y-4 shadow-2xl nb-card-glow">
          {validating && (
            <p className="text-slate-400 text-sm text-center py-4">Verifying your link…</p>
          )}

          {!validating && !tokenInfo?.valid && (
            <div className="text-center py-2 space-y-3">
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">
                {tokenInfo?.reason || 'This link is invalid or has expired.'}
              </p>
              <button
                onClick={onDone}
                className="text-slate-400 hover:text-white text-sm underline transition-colors"
              >
                Back to sign in
              </button>
            </div>
          )}

          {!validating && tokenInfo?.valid && !done && (
            <>
              {tokenInfo.name && (
                <p className="text-slate-300 text-sm">
                  Hi <strong className="text-white">{tokenInfo.name}</strong>, choose a password to{' '}
                  {isInvite ? 'activate your account' : 'sign in with'}.
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      className={inputCls + ' pr-10'}
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                          <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                          <path d="m10.748 13.93 2.523 2.524a10.024 10.024 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.033 10.033 0 0 1 4.1 5.82l2.519 2.52a4 4 0 0 0 4.131 5.59Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Confirm password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className={inputCls}
                    placeholder="Repeat your password"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2"
                >
                  {loading ? 'Saving…' : isInvite ? 'Set password & continue' : 'Reset password'}
                </button>
              </form>
            </>
          )}

          {done && (
            <div className="text-center py-2 space-y-4">
              <div className="text-emerald-400 text-4xl">✓</div>
              <p className="text-slate-200 font-medium">
                {isInvite ? 'Account activated!' : 'Password updated!'}
              </p>
              <p className="text-slate-400 text-sm">
                {isInvite
                  ? 'Your account is ready. Sign in with your new password.'
                  : 'Your password has been changed. Any existing sessions have been signed out.'}
              </p>
              <button
                onClick={onDone}
                className="w-full bg-neuro-600 hover:bg-neuro-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
