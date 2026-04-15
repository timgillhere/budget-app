import { useState, useEffect, useCallback } from 'react';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  const [changingPwId, setChangingPwId] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState({});

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

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleChangePw(userId) {
    if (newPw.length < 8) {
      setPwStatus(s => ({ ...s, [userId]: { type: 'error', message: 'Min. 8 characters' } }));
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-nb-750 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-nb-700">
          <h2 className="text-base font-bold text-slate-300">Users</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Registered users. The admin account set via environment variables is not listed here.
          </p>
        </div>

        <div className="px-6 py-5">
          {usersLoading && <p className="text-slate-500 text-sm py-2">Loading…</p>}
          {usersError && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">{usersError}</p>
          )}
          {!usersLoading && !usersError && users.length === 0 && (
            <p className="text-slate-500 text-sm italic py-2">No users registered yet.</p>
          )}
          {!usersLoading && !usersError && users.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-nb-600">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">2FA</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nb-600">
                {users.map(user => (
                  <tr key={user.id} className="group">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-300">{user.name}</td>
                    <td className="py-3 pr-4 text-sm text-slate-500">{user.email}</td>
                    <td className="py-3 pr-4 text-sm">
                      {user.mfa_enabled
                        ? <span className="text-emerald-400 font-medium">✓ On</span>
                        : <span className="text-slate-600">Off</span>}
                    </td>
                    <td className="py-3">
                      {pwStatus[user.id] && changingPwId !== user.id && (
                        <span className={`text-xs mr-3 font-medium ${pwStatus[user.id].type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pwStatus[user.id].message}
                        </span>
                      )}
                      {changingPwId === user.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleChangePw(user.id); if (e.key === 'Escape') { setChangingPwId(null); setNewPw(''); } }}
                            autoFocus placeholder="New password (8+ chars)"
                            className="bg-nb-800 text-slate-300 rounded-lg px-3 py-1.5 text-sm neon-input w-48" />
                          <button onClick={() => handleChangePw(user.id)} disabled={pwLoading}
                            className="text-xs bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium">
                            {pwLoading ? 'Saving…' : 'Confirm'}
                          </button>
                          <button onClick={() => { setChangingPwId(null); setNewPw(''); }}
                            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 transition-colors">
                            Cancel
                          </button>
                          {pwStatus[user.id] && (
                            <span className={`text-xs font-medium ${pwStatus[user.id].type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {pwStatus[user.id].message}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button onClick={() => { setChangingPwId(user.id); setNewPw(''); setPwStatus(s => { const n = { ...s }; delete n[user.id]; return n; }); }}
                          className="text-xs text-slate-500 hover:text-slate-300 border border-nb-600 hover:border-nb-500 bg-nb-800 hover:bg-nb-700 px-3 py-1.5 rounded-lg transition-colors">
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
