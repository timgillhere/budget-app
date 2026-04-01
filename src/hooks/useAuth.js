import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated
  const [mfaPending, setMfaPending] = useState(false);

  // On mount, check session via /api/auth/me
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { setUser(null); return; }
        return r.json().then(data => {
          if (data.mfaVerified === false && data.mfaEnabled) {
            setMfaPending(true);
            setUser(null);
          } else {
            setUser(data);
          }
        });
      })
      .catch(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty response */ }
    if (!res.ok) throw new Error(data.error || 'Login failed — please try again');

    if (data.status === 'mfa_required') {
      setMfaPending(true);
      return;
    }

    // Fetch user profile from session cookie
    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    if (meRes.ok) setUser(await meRes.json());
  }, []);

  const completeMfa = useCallback(async () => {
    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    if (meRes.ok) {
      setUser(await meRes.json());
      setMfaPending(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setMfaPending(false);
  }, []);

  const loading = user === undefined && !mfaPending;

  return {
    user,
    loading,
    isAdmin: user?.isAdmin ?? false,
    mfaPending,
    login,
    logout,
    completeMfa,
  };
}
