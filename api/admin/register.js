import bcrypt from 'bcryptjs';
import { list, put } from '@vercel/blob';
import { requireAdmin } from '../_auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Load existing users
  let users = [];
  try {
    const blobs = await list({ prefix: 'users.json' });
    if (blobs.blobs.length > 0) {
      const response = await fetch(blobs.blobs[0].url);
      users = await response.json();
    }
  } catch {
    // Start fresh
  }

  if (users.find((u) => u.email === email)) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const newUser = {
    id: randomUUID(),
    email,
    passwordHash: await bcrypt.hash(password, 10),
  };

  users.push(newUser);

  await put('users.json', JSON.stringify(users, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });

  return res.status(201).json({ id: newUser.id, email: newUser.email });
}
