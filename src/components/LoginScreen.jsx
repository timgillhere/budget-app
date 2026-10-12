import { useState, useEffect } from 'react';

// Set by /api/auth/callback when sign-in doesn't complete.
const AUTH_ERRORS = {
  not_invited: "That Google account isn't on the list for this app. Ask the admin to add your email under Users, then try again.",
  email_unverified: 'Google reports that email address as unverified, so it can’t be used to sign in.',
  cancelled: 'Sign-in was cancelled.',
  state_mismatch: 'Sign-in expired or was started in another tab. Please try again.',
  google_error: 'Google sign-in failed. Please try again.',
  not_configured: 'Google sign-in isn’t set up yet: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing from the server environment.',
};

function readAuthError() {
  const code = new URLSearchParams(window.location.search).get('auth_error');
  return code ? AUTH_ERRORS[code] || 'Sign-in failed. Please try again.' : '';
}

export default function LoginScreen({ onLogin }) {
  const [error] = useState(readAuthError);
  const [redirecting, setRedirecting] = useState(false);

  // Drop the code from the address bar so a refresh doesn't show it again.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('auth_error')) return;
    params.delete('auth_error');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }, []);

  function handleLogin() {
    setRedirecting(true);
    onLogin();
  }

  return (
    <div className="min-h-screen bg-nb-900 nb-grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tim's Budget" className="h-16 w-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold text-white">Tim's Budget</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <div className="bg-nb-750 rounded-2xl border border-nb-600 p-6 space-y-4 shadow-2xl nb-card-glow">
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <button type="button" onClick={handleLogin} disabled={redirecting}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:opacity-60 disabled:cursor-wait text-slate-800 font-medium rounded-lg py-2.5 text-sm transition-colors">
            <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            {redirecting ? 'Redirecting to Google…' : 'Sign in with Google'}
          </button>

          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Only accounts the admin has added can sign in. Your Google password and 2-Step
            Verification are handled by Google; this app never sees them.
          </p>
        </div>
      </div>
    </div>
  );
}
