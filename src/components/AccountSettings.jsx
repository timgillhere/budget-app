import { useState, useEffect } from 'react';

export default function AccountSettings() {
  const [me, setMe] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => {});
  }, []);

  async function signOutEverywhere() {
    setSigningOut(true);
    await fetch('/api/logout?all=1', { method: 'POST', credentials: 'include' }).catch(() => {});
    window.location.reload();
  }

  return (
    <div className="bg-nb-750 rounded-xl overflow-hidden">
      <div className="px-6 py-4 bg-nb-700">
        <h2 className="text-base font-bold text-slate-300">Google sign-in</h2>
      </div>
      <div className="px-6 py-5 space-y-4 text-sm">
        <p className="text-slate-400">
          Signed in with Google as{' '}
          <span className="text-slate-200 font-medium">{me ? me.email : '…'}</span>
        </p>
        <p className="text-slate-500 leading-relaxed">
          Your password and 2-Step Verification are managed by Google, not this app. Turn on
          2-Step Verification in your{' '}
          <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer"
            className="text-neuro-400 hover:text-neuro-300 underline">Google Account security settings</a>{' '}
          to protect your budget too.
        </p>
        <p className="text-slate-500 leading-relaxed">
          Sessions end after an hour of inactivity, and after 7 days at most. The session cookie is
          HttpOnly, so scripts on the page can’t read it.
        </p>
        <button onClick={signOutEverywhere} disabled={signingOut}
          className="text-xs text-slate-400 hover:text-slate-200 border border-nb-600 hover:border-nb-500 bg-nb-800 hover:bg-nb-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors">
          {signingOut ? 'Signing out…' : 'Sign out on all devices'}
        </button>
      </div>
    </div>
  );
}
