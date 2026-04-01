import { useState } from 'react';

const inputCls = "w-full bg-nb-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-600 neon-input"

export default function LoginScreen({ onLogin }) {
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
    <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-nb-750 rounded-2xl border border-nb-600 p-6 space-y-4 shadow-2xl nb-card-glow">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className={inputCls}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputCls}
              placeholder="••••••••"
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-slate-600 text-xs">
            Forgotten your password? Contact an admin to reset it.
          </p>
        </form>
      </div>
    </div>
  );
}
