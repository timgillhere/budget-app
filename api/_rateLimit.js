import { getPool } from './_db.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

// Returns true if rate limit exceeded
export async function checkRateLimit(key) {
  const pool = getPool();
  const windowCutoff = new Date(Date.now() - WINDOW_MS);

  const result = await pool.query(
    `INSERT INTO rate_limit_login (key, attempts, window_start)
     VALUES ($1, 1, NOW())
     ON CONFLICT (key) DO UPDATE SET
       attempts     = CASE
                        WHEN rate_limit_login.window_start < $2
                        THEN 1
                        ELSE rate_limit_login.attempts + 1
                      END,
       window_start = CASE
                        WHEN rate_limit_login.window_start < $2
                        THEN NOW()
                        ELSE rate_limit_login.window_start
                      END
     RETURNING attempts`,
    [key, windowCutoff]
  );

  return result.rows[0].attempts > MAX_ATTEMPTS;
}
