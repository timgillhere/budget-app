import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = unauthenticated

  // On mount, check session via /api/auth/me. The session cookie is HttpOnly, so this
  // request is the only way the page can learn whether it's signed in.
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  // Full-page redirect: Google's consent screen can't run inside fetch.
  const login = useCallback(() => {
    window.location.assign('/api/auth/google');
  }, []);

  const logout = useCallback(async ({ everywhere = false } = {}) => {
    await fetch(`/api/logout${everywhere ? '?all=1' : ''}`, { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  return {
    user,
    loading: user === undefined,
    isAdmin: user?.isAdmin ?? false,
    login,
    logout,
  };
}
