import { useState } from 'react';

export default function AdminPanel({ token }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [loading, setLoading] = useState(false);

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
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-bold text-white mb-1">Register User</h2>
      <p className="text-ash-grey-400 text-sm mb-6">Create a new account. The user can log in immediately.</p>

      <form onSubmit={handleRegister} className="bg-ash-grey-900 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-ash-grey-400 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
            placeholder="Maria"
          />
        </div>

        <div>
          <label className="block text-sm text-ash-grey-400 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm text-ash-grey-400 mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-ash-grey-800 text-white rounded-lg px-4 py-2.5 text-sm border border-ash-grey-700 focus:border-tropical-teal-500 focus:outline-none transition-colors"
            placeholder="Min. 8 characters"
          />
        </div>

        {status && (
          <p
            className={`text-sm rounded-lg px-3 py-2 border ${
              status.type === 'success'
                ? 'text-soft-linen-400 bg-soft-linen-900/20 border-soft-linen-800'
                : 'text-vibrant-coral-400 bg-vibrant-coral-900/20 border-vibrant-coral-800'
            }`}
          >
            {status.message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-tropical-teal-600 hover:bg-tropical-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading ? 'Registering…' : 'Register user'}
        </button>
      </form>
    </div>
  );
}
