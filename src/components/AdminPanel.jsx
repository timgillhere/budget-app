import { useState, useEffect, useCallback } from 'react';

export default function AdminPanel() {
  // Invite form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [loading, setLoading] = useState(false);

  // User table state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  // Per-user action state
  const [userActionLoading, setUserActionLoading] = useState(null); // userId being actioned
  const [userActionStatus, setUserActionStatus] = useState({}); // keyed by userId

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load users');
      setUsers(await res.json());
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleInvite(e) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      setStatus({ type: 'success', message: `Invite sent to ${data.email}. They'll receive an email to set their password.` });
      setName('');
      setEmail('');
      fetchUsers();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleUserAction(userId, action) {
    setUserActionLoading(userId);
    setUserActionStatus(s => { const n = { ...s }; delete n[userId]; return n; });
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      const msg = action === 'resendInvite' ? 'Invite resent ✓' : 'Reset link sent ✓';
      setUserActionStatus(s => ({ ...s, [userId]: { type: 'success', message: msg } }));
      setTimeout(() => setUserActionStatus(s => { const n = { ...s }; delete n[userId]; return n; }), 4000);
    } catch (err) {
      setUserActionStatus(s => ({ ...s, [userId]: { type: 'error', message: err.message } }));
    } finally {
      setUserActionLoading(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── Invite new user ── */}
      <div className="bg-nb-750 rounded-xl overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-4" style={{ backgroundColor: '#1a42b0' }}>
          <h2 className="text-base font-bold text-white">Invite User</h2>
          <p className="text-blue-200 text-sm mt-0.5">Send an invite email. The user sets their own password — you never see it.</p>
        </div>

        <form onSubmit={handleInvite} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-slate-400 mb-1.5">Name</label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-nb-800 text-slate-300 rounded-lg px-3 py-2.5 text-sm neon-input"
                placeholder="Maria"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-nb-800 text-slate-300 rounded-lg px-3 py-2.5 text-sm neon-input"
                placeholder="user@example.com"
              />
            </div>
          </div>

          {status && (
            <p className={`text-sm rounded-lg px-3 py-2 border ${
              status.type === 'success'
                ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/60'
                : 'text-red-400 bg-red-900/20 border-red-800/60'
            }`}>
              {status.message}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
            >
              {loading ? 'Sending invite…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Users table ── */}
      <div className="bg-nb-750 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-nb-700">
          <h2 className="text-base font-bold text-slate-300">Users</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Invited users. The admin account set via environment variables is not listed here.
          </p>
        </div>

        <div className="px-6 py-5">
          {usersLoading && (
            <p className="text-slate-500 text-sm py-2">Loading…</p>
          )}
          {usersError && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">
              {usersError}
            </p>
          )}
          {!usersLoading && !usersError && users.length === 0 && (
            <p className="text-slate-500 text-sm italic py-2">No users invited yet.</p>
          )}
          {!usersLoading && !usersError && users.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-nb-600">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">2FA</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nb-600">
                {users.map(user => (
                  <tr key={user.id} className="group">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-300">{user.name}</td>
                    <td className="py-3 pr-4 text-sm text-slate-500">{user.email}</td>
                    <td className="py-3 pr-4 text-sm">
                      {user.pending
                        ? <span className="text-amber-400 font-medium">Pending</span>
                        : <span className="text-emerald-400 font-medium">Active</span>}
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      {user.mfa_enabled
                        ? <span className="text-emerald-400 font-medium">✓ On</span>
                        : <span className="text-slate-600">Off</span>}
                    </td>
                    <td className="py-3">
                      {userActionStatus[user.id] && (
                        <span className={`text-xs mr-2 font-medium ${
                          userActionStatus[user.id].type === 'success' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {userActionStatus[user.id].message}
                        </span>
                      )}
                      {!userActionStatus[user.id] && (
                        <button
                          onClick={() => handleUserAction(user.id, user.pending ? 'resendInvite' : 'sendReset')}
                          disabled={userActionLoading === user.id}
                          className="text-xs text-slate-500 hover:text-slate-300 border border-nb-600 hover:border-nb-500 bg-nb-800 hover:bg-nb-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {userActionLoading === user.id
                            ? 'Sending…'
                            : user.pending ? 'Resend invite' : 'Send reset link'}
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
