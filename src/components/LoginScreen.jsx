import { useState } from 'react';

const inputCls = "w-full bg-nb-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-600 neon-input";

export default function LoginScreen({ onLogin, onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = answer question + set password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotQuestion, setForgotQuestion] = useState('');
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotDone, setForgotDone] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotStep1(e) {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await fetch(`/api/auth/password-reset?email=${encodeURIComponent(forgotEmail)}`);
      const data = await res.json();
      if (!data.found) {
        setForgotError('No account found with that email.');
        return;
      }
      setForgotQuestion(data.question);
      setForgotStep(2);
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotStep2(e) {
    e.preventDefault();
    setForgotError('');
    if (forgotNewPassword.length < 8) {
      setForgotError('New password must be at least 8 characters');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, answer: forgotAnswer, newPassword: forgotNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setForgotDone(true);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  function openForgot() {
    setForgotEmail(email);
    setForgotStep(1);
    setForgotQuestion('');
    setForgotAnswer('');
    setForgotNewPassword('');
    setForgotError('');
    setForgotDone(false);
    setShowForgot(true);
  }

  function closeForgot() {
    setShowForgot(false);
  }

  return (
    <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleLogin} className="bg-nb-750 rounded-2xl border border-nb-600 p-6 space-y-4 shadow-2xl nb-card-glow">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              className={inputCls} placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} required
                className={inputCls + ' pr-10'} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
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

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex justify-between text-xs pt-1">
            <button type="button" onClick={openForgot}
              className="text-slate-500 hover:text-slate-300 underline transition-colors">
              Forgotten your password?
            </button>
            <button type="button" onClick={onRegister}
              className="text-slate-500 hover:text-slate-300 underline transition-colors">
              Create account
            </button>
          </div>
        </form>
      </div>

      {/* Forgot password overlay */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-nb-750 rounded-2xl border border-nb-600 shadow-2xl w-full max-w-sm p-6 space-y-4">

            {forgotDone ? (
              <>
                <h2 className="text-lg font-bold text-white">Password updated</h2>
                <p className="text-slate-400 text-sm">Your password has been changed. Sign in with your new password.</p>
                <button onClick={closeForgot}
                  className="w-full bg-neuro-600 hover:bg-neuro-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                  Back to sign in
                </button>
              </>
            ) : forgotStep === 1 ? (
              <>
                <h2 className="text-lg font-bold text-white">Forgot password?</h2>
                <p className="text-slate-400 text-sm">Enter your email to retrieve your security question.</p>
                <form onSubmit={handleForgotStep1} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Email</label>
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      required autoFocus className={inputCls} placeholder="you@example.com" />
                  </div>
                  {forgotError && (
                    <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">
                      {forgotError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button type="button" onClick={closeForgot}
                      className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 rounded-lg py-2.5 text-sm transition-colors">
                      Cancel
                    </button>
                    <button type="submit" disabled={forgotLoading}
                      className="flex-1 bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                      {forgotLoading ? 'Looking up…' : 'Continue'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-white">Security question</h2>
                <form onSubmit={handleForgotStep2} className="space-y-4">
                  <div className="bg-nb-800 rounded-lg px-4 py-3">
                    <p className="text-xs text-slate-500 mb-1">Your question</p>
                    <p className="text-slate-200 text-sm">{forgotQuestion}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">Answer</label>
                    <input type="text" value={forgotAnswer} onChange={e => setForgotAnswer(e.target.value)}
                      required autoFocus className={inputCls} placeholder="Your answer" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1.5">New password</label>
                    <input type="password" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)}
                      required minLength={8} className={inputCls} placeholder="Min. 8 characters" />
                  </div>
                  {forgotError && (
                    <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">
                      {forgotError}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setForgotStep(1); setForgotError(''); }}
                      className="flex-1 border border-nb-500 text-slate-400 hover:text-slate-200 rounded-lg py-2.5 text-sm transition-colors">
                      Back
                    </button>
                    <button type="submit" disabled={forgotLoading}
                      className="flex-1 bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
                      {forgotLoading ? 'Saving…' : 'Reset password'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
