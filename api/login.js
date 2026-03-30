import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Load registered users from Vercel Blob
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

  // Check users.json first (covers regular users and admin who has reset their password)
  const user = users.find((u) => u.email === email);
  if (user && (await bcrypt.compare(password, user.passwordHash))) {
    const isAdmin = email === process.env.ADMIN_EMAIL;
    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email, isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(200).json({ token });
  }

  // Fallback: admin via env vars (before any password reset has been done)
  if (
    email === process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD_HASH &&
    (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH))
  ) {
    const token = jwt.sign(
      { userId: 'admin', name: process.env.ADMIN_NAME || 'Admin', email, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(200).json({ token });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}
