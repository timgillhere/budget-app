import bcrypt from 'bcryptjs';
import { list, put } from '@vercel/blob';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Load existing users
  let users = [];
  try {
    const blobs = await list({ prefix: 'users.json' });
    if (blobs.blobs.length > 0) {
      const response = await fetch(blobs.blobs[0].url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      users = await response.json();
    }
  } catch {
    // No users stored yet
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const userIndex = users.findIndex((u) => u.email === email);
  if (userIndex === -1) {
    users.push({ id: randomUUID(), name: email.split('@')[0], email, passwordHash });
  } else {
    users[userIndex].passwordHash = passwordHash;
  }

  try {
    await put('users.json', JSON.stringify(users, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ success: true });
}
