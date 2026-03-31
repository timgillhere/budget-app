import bcrypt from 'bcryptjs';
import { list, put } from '@vercel/blob';
import { requireAdmin } from '../_auth.js';

async function loadUsers() {
  try {
    const blobs = await list({ prefix: 'users.json' });
    if (blobs.blobs.length > 0) {
      const response = await fetch(blobs.blobs[0].url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      return await response.json();
    }
  } catch {
    // no users file yet
  }
  return [];
}

async function saveUsers(users) {
  await put('users.json', JSON.stringify(users, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const users = await loadUsers();
    // Strip password hashes before returning
    const safe = users.map(({ id, name, email }) => ({ id, name, email }));
    return res.status(200).json(safe);
  }

  // PATCH — change a user's password
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const users = await loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[idx].passwordHash = await bcrypt.hash(newPassword, 10);

  try {
    await saveUsers(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ ok: true });
}
