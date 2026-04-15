import { useState } from 'react';

const inputCls = "w-full bg-nb-800 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-600 neon-input";

const PRESET_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What was the make of your first car?",
  "What is the name of your childhood best friend?",
  "__custom__",
];

export default function RegisterScreen({ onBack }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const isCustom = question === '__custom__';
  const finalQuestion = isCustom ? customQuestion.trim() : question;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (isCustom && !customQuestion.trim()) { setError('Please enter your security question'); return; }
    if (!answer.trim()) { setError('Please provide a security answer'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name,
          email,
          password,
          securityQuestion: finalQuestion,
          securityAnswer: answer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
            <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          </div>
          <div className="bg-nb-750 rounded-2xl border border-nb-600 p-6 text-center space-y-4 shadow-2xl nb-card-glow">
            <div className="text-emerald-400 text-4xl">✓</div>
            <p className="text-slate-200 font-medium">Account created!</p>
            <p className="text-slate-400 text-sm">Sign in below to get started.</p>
            <button
              onClick={onBack}
              className="w-full bg-neuro-600 hover:bg-neuro-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Go to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-slate-500 text-sm mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-nb-750 rounded-2xl border border-nb-600 p-6 space-y-4 shadow-2xl nb-card-glow">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus
              className={inputCls} placeholder="Your name" />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className={inputCls} placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={8}
                className={inputCls + ' pr-10'} placeholder="Min. 8 characters" />
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

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Confirm password</label>
            <input type={showPassword ? 'text' : 'password'} value={confirm}
              onChange={e => setConfirm(e.target.value)} required
              className={inputCls} placeholder="Repeat your password" />
          </div>

          <div className="border-t border-nb-600 pt-4">
            <p className="text-xs text-slate-500 mb-3">Security question — used to recover your password if you forget it.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Question</label>
                <select value={question} onChange={e => setQuestion(e.target.value)}
                  className="w-full bg-nb-800 text-slate-300 rounded-lg px-3 py-2.5 text-sm neon-input">
                  {PRESET_QUESTIONS.slice(0, -1).map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                  <option value="__custom__">Write my own question…</option>
                </select>
              </div>

              {isCustom && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Your question</label>
                  <input type="text" value={customQuestion} onChange={e => setCustomQuestion(e.target.value)}
                    className={inputCls} placeholder="e.g. What street did you grow up on?" />
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Answer</label>
                <input type="text" value={answer} onChange={e => setAnswer(e.target.value)} required
                  className={inputCls} placeholder="Your answer (not case-sensitive)" />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors">
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-xs">
            <button type="button" onClick={onBack}
              className="text-slate-500 hover:text-slate-300 underline transition-colors">
              Already have an account? Sign in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
