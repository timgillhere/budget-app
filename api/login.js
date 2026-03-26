import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { list, head } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Check admin credentials first
  if (
    email === process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD_HASH &&
    (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH))
  ) {
    const token = jwt.sign(
      { userId: 'admin', email, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(200).json({ token });
  }

  // Check registered users in Vercel Blob
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

  const user = users.find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, isAdmin: false },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return res.status(200).json({ token });
}
