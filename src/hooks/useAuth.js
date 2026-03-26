import { useState, useCallback } from 'react';

function parseToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem('auth_token');
    if (!stored || !parseToken(stored)) {
      localStorage.removeItem('auth_token');
      return null;
    }
    return stored;
  });

  const user = token ? parseToken(token) : null;

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('auth_token', data.token);
    setToken(data.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
  }, []);

  return { token, user, isAdmin: user?.isAdmin ?? false, login, logout };
}
