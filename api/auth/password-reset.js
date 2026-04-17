import bcrypt from 'bcryptjs';
import { getPool } from '../_db.js';
import { checkRateLimit } from '../_rateLimit.js';

export default async function handler(req, res) {
  // GET /api/auth/password-reset?email=xxx  — fetch the user's security question
  if (req.method === 'GET') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT sq.question
       FROM users u
       JOIN security_questions sq ON sq.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({ found: true, question: rows[0].question });
  }

  // POST { action: 'reset', email, answer, newPassword }  — verify answer and set new password
  if (req.method === 'POST') {
    const { email, answer, newPassword } = req.body;
    if (!email || !answer || !newPassword) {
      return res.status(400).json({ error: 'Email, answer, and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const pool = getPool();
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 5 attempts per email per hour
    const limited = await checkRateLimit(`reset:${normalizedEmail}`, 5, 60 * 60 * 1000);
    if (limited) {
      return res.status(429).json({ error: 'Too many attempts. Please wait an hour before trying again.' });
    }

    const { rows } = await pool.query(
      `SELECT u.id, sq.answer_hash
       FROM users u
       JOIN security_questions sq ON sq.user_id = u.id
       WHERE u.email = $1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No account found with that email.' });
    }

    const { id: userId, answer_hash } = rows[0];
    const answerOk = await bcrypt.compare(answer.toLowerCase().trim(), answer_hash);

    if (!answerOk) {
      return res.status(400).json({ error: 'Incorrect answer.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
