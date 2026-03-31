import { useState } from 'react';

export default function LoginScreen({ onLogin }) {
  const [view, setView] = useState('login'); // 'login' | 'reset'

  if (view === 'reset') {
    return <ResetPasswordView onBack={() => setView('login')} />;
  }

  return <LoginView onLogin={onLogin} onReset={() => setView('reset')} />;
}

function LoginView({ onLogin, onReset }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
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

  return (
    <div className="min-h-screen bg-ash-grey-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-ash-grey-400 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-ash-grey-900 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-sm text-ash-grey-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-ash-grey-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-vibrant-coral-400 text-sm bg-vibrant-coral-900/20 border border-vibrant-coral-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-tropical-teal-600 hover:bg-tropical-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="w-full text-ash-grey-500 hover:text-ash-grey-300 text-sm transition-colors"
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordView({ onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword: password }),
      });
      let data = {};
      try { data = await res.json(); } catch { /* empty/non-JSON response */ }
      if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ash-grey-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-ash-grey-400 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-ash-grey-900 rounded-2xl p-6 shadow-xl">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-soft-linen-400 text-sm bg-soft-linen-900/20 border border-soft-linen-800 rounded-lg px-3 py-2">
                Password updated successfully.
              </p>
              <button
                onClick={onBack}
                className="w-full bg-tropical-teal-600 hover:bg-tropical-teal-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-ash-grey-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-ash-grey-400 mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm text-ash-grey-400 mb-1.5">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-vibrant-coral-400 text-sm bg-vibrant-coral-900/20 border border-vibrant-coral-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-tropical-teal-600 hover:bg-tropical-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full text-ash-grey-500 hover:text-ash-grey-300 text-sm transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
