import { useState, useEffect, useCallback } from 'react';

export default function AdminPanel({ token }) {
  // Registration form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [loading, setLoading] = useState(false);

  // User table state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  // Inline change-password state
  const [changingPwId, setChangingPwId] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState({}); // keyed by userId

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load users');
      setUsers(await res.json());
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleRegister(e) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setStatus({ type: 'success', message: `User ${data.email} registered successfully.` });
      setName('');
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePw(userId) {
    if (newPw.length < 8) {
      setPwStatus(s => ({ ...s, [userId]: { type: 'error', message: 'Min. 8 characters' } }));
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setChangingPwId(null);
      setNewPw('');
      setPwStatus(s => ({ ...s, [userId]: { type: 'success', message: 'Password updated ✓' } }));
      setTimeout(() => setPwStatus(s => { const n = { ...s }; delete n[userId]; return n; }), 3000);
    } catch (err) {
      setPwStatus(s => ({ ...s, [userId]: { type: 'error', message: err.message } }));
    } finally {
      setPwLoading(false);
    }
  }

  function startChangePw(userId) {
    setChangingPwId(userId);
    setNewPw('');
    setPwStatus(s => { const n = { ...s }; delete n[userId]; return n; });
  }

  function cancelChangePw(userId) {
    setChangingPwId(null);
    setNewPw('');
    setPwStatus(s => { const n = { ...s }; delete n[userId]; return n; });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── Register new user ── */}
      <div className="bg-white rounded-xl shadow-sm border border-ash-grey-200 overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-4 border-b border-ash-grey-200" style={{ backgroundColor: '#2E75B6' }}>
          <h2 className="text-base font-bold text-white">Register User</h2>
          <p className="text-blue-100 text-sm mt-0.5">Create a new account. The user can log in immediately.</p>
        </div>

        <form onSubmit={handleRegister} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-ash-grey-700 mb-1.5">Name</label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white text-ash-grey-800 rounded-lg px-3 py-2.5 text-sm border border-ash-grey-300 focus:border-tropical-teal-500 focus:ring-2 focus:ring-tropical-teal-500/20 focus:outline-none transition-colors"
                placeholder="Maria"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-ash-grey-700 mb-1.5">Email</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white text-ash-grey-800 rounded-lg px-3 py-2.5 text-sm border border-ash-grey-300 focus:border-tropical-teal-500 focus:ring-2 focus:ring-tropical-teal-500/20 focus:outline-none transition-colors"
                placeholder="user@example.com"
              />
            </div>
          </div>

          <div className="max-w-xs">
            <label htmlFor="reg-password" className="block text-sm font-medium text-ash-grey-700 mb-1.5">Password</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-white text-ash-grey-800 rounded-lg px-3 py-2.5 text-sm border border-ash-grey-300 focus:border-tropical-teal-500 focus:ring-2 focus:ring-tropical-teal-500/20 focus:outline-none transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          {status && (
            <p className={`text-sm rounded-lg px-3 py-2 border ${
              status.type === 'success'
                ? 'text-tropical-teal-700 bg-tropical-teal-50 border-tropical-teal-200'
                : 'text-vibrant-coral-700 bg-vibrant-coral-50 border-vibrant-coral-200'
            }`}>
              {status.message}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-tropical-teal-600 hover:bg-tropical-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
            >
              {loading ? 'Registering…' : 'Register user'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Registered users table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-ash-grey-200 overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-4 border-b border-ash-grey-200 bg-ash-grey-800">
          <h2 className="text-base font-bold text-white">Registered Users</h2>
          <p className="text-ash-grey-300 text-sm mt-0.5">
            Users you have invited. The admin account set via environment variables is not listed here.
          </p>
        </div>

        <div className="px-6 py-5">
          {usersLoading && (
            <p className="text-ash-grey-400 text-sm py-2">Loading…</p>
          )}
          {usersError && (
            <p className="text-vibrant-coral-600 text-sm bg-vibrant-coral-50 border border-vibrant-coral-200 rounded-lg px-3 py-2">
              {usersError}
            </p>
          )}
          {!usersLoading && !usersError && users.length === 0 && (
            <p className="text-ash-grey-400 text-sm italic py-2">No users registered yet.</p>
          )}
          {!usersLoading && !usersError && users.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ash-grey-200">
                  <th className="pb-2 text-left text-xs font-semibold text-ash-grey-500 uppercase tracking-wide">Name</th>
                  <th className="pb-2 text-left text-xs font-semibold text-ash-grey-500 uppercase tracking-wide">Email</th>
                  <th className="pb-2 text-left text-xs font-semibold text-ash-grey-500 uppercase tracking-wide">Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ash-grey-100">
                {users.map(user => (
                  <tr key={user.id} className="group">
                    <td className="py-3 pr-4 text-sm font-medium text-ash-grey-800">{user.name}</td>
                    <td className="py-3 pr-4 text-sm text-ash-grey-500">{user.email}</td>
                    <td className="py-3">
                      {/* Success message shown after saving (row closed) */}
                      {pwStatus[user.id] && changingPwId !== user.id && (
                        <span className={`text-xs mr-3 font-medium ${
                          pwStatus[user.id].type === 'success'
                            ? 'text-tropical-teal-600'
                            : 'text-vibrant-coral-600'
                        }`}>
                          {pwStatus[user.id].message}
                        </span>
                      )}

                      {changingPwId === user.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="password"
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleChangePw(user.id);
                              if (e.key === 'Escape') cancelChangePw(user.id);
                            }}
                            autoFocus
                            placeholder="New password (8+ chars)"
                            className="bg-white text-ash-grey-800 rounded-lg px-3 py-1.5 text-sm border border-ash-grey-300 focus:border-tropical-teal-500 focus:ring-2 focus:ring-tropical-teal-500/20 focus:outline-none w-48"
                          />
                          <button
                            onClick={() => handleChangePw(user.id)}
                            disabled={pwLoading}
                            className="text-xs bg-tropical-teal-600 hover:bg-tropical-teal-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            {pwLoading ? 'Saving…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => cancelChangePw(user.id)}
                            className="text-xs text-ash-grey-500 hover:text-ash-grey-700 px-2 py-1.5 transition-colors"
                          >
                            Cancel
                          </button>
                          {pwStatus[user.id] && (
                            <span className={`text-xs font-medium ${
                              pwStatus[user.id].type === 'success'
                                ? 'text-tropical-teal-600'
                                : 'text-vibrant-coral-600'
                            }`}>
                              {pwStatus[user.id].message}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => startChangePw(user.id)}
                          className="text-xs text-ash-grey-500 hover:text-ash-grey-800 border border-ash-grey-300 hover:border-ash-grey-400 bg-ash-grey-50 hover:bg-ash-grey-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Change password
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
