import bcrypt from 'bcryptjs';
import { requireAdmin } from '../_auth.js';
import { getPool } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const pool = getPool();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, password_hash, is_admin)
       VALUES ($1, $2, $3, false)
       RETURNING id, email, name`,
      [email.toLowerCase().trim(), name.trim(), passwordHash]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }
    return res.status(500).json({ error: err.message });
  }
}
