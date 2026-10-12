import { useState, useEffect, useCallback } from 'react';

const inputCls = "bg-nb-800 text-slate-300 rounded-lg px-3 py-2 text-sm neon-input";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addStatus, setAddStatus] = useState(null);

  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [removeError, setRemoveError] = useState(null);

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

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setAddStatus(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add user');
      setUsers(u => [...u, data]);
      setAddStatus({ type: 'success', message: `${data.email} can now sign in with Google.` });
      setName(''); setEmail('');
    } catch (err) {
      setAddStatus({ type: 'error', message: err.message });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id) {
    setRemoveError(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove user');
      setUsers(u => u.filter(x => x.id !== id));
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setConfirmRemoveId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-nb-750 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-nb-700">
          <h2 className="text-base font-bold text-slate-300">Add a user</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            They sign in with the Google account for this email. Nobody else can sign in.
          </p>
        </div>
        <form onSubmit={handleAdd} className="px-6 py-5 flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1">
            <span className="block text-xs text-slate-500 mb-1">Name</span>
            <input value={name} onChange={e => setName(e.target.value)} required className={inputCls + ' w-full'} placeholder="Alex" />
          </label>
          <label className="flex-[2]">
            <span className="block text-xs text-slate-500 mb-1">Google account email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputCls + ' w-full'} placeholder="alex@gmail.com" />
          </label>
          <button type="submit" disabled={adding}
            className="bg-neuro-600 hover:bg-neuro-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {adding ? 'Adding…' : 'Add user'}
          </button>
        </form>
        {addStatus && (
          <p className={`px-6 pb-4 -mt-1 text-sm ${addStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
            {addStatus.message}
          </p>
        )}
      </div>

      <div className="bg-nb-750 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-nb-700">
          <h2 className="text-base font-bold text-slate-300">Users</h2>
        </div>

        <div className="px-6 py-5">
          {usersLoading && <p className="text-slate-500 text-sm py-2">Loading…</p>}
          {usersError && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2">{usersError}</p>
          )}
          {removeError && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/60 rounded-lg px-3 py-2 mb-3">{removeError}</p>
          )}
          {!usersLoading && !usersError && users.length === 0 && (
            <p className="text-slate-500 text-sm italic py-2">No users yet.</p>
          )}
          {!usersLoading && !usersError && users.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-nb-600">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-nb-600">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="py-3 pr-4 text-sm font-medium text-slate-300">
                      {user.name}{user.is_admin && <span className="ml-2 text-xs text-neuro-400">admin</span>}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-500 break-all">{user.email}</td>
                    <td className="py-3 pr-4 text-sm">
                      {user.has_signed_in
                        ? <span className="text-emerald-400">Linked to Google</span>
                        : <span className="text-slate-500">Not signed in yet</span>}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {!user.is_admin && (confirmRemoveId === user.id ? (
                        <span className="inline-flex gap-2">
                          <button onClick={() => handleRemove(user.id)}
                            className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                            Remove
                          </button>
                          <button onClick={() => setConfirmRemoveId(null)}
                            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 transition-colors">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmRemoveId(user.id)}
                          className="text-xs text-slate-500 hover:text-slate-300 border border-nb-600 hover:border-nb-500 bg-nb-800 hover:bg-nb-700 px-3 py-1.5 rounded-lg transition-colors">
                          Remove
                        </button>
                      ))}
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
