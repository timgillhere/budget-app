/**
 * One-time migration: users.json in Vercel Blob → Postgres users table.
 *
 * Usage (run locally with both env vars set):
 *   node --env-file=.env.local scripts/migrate-blob-to-pg.js
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING.
 */

import pg from 'pg';
import { list } from '@vercel/blob';
import { randomUUID } from 'crypto';

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // ── Load users from Vercel Blob ──────────────────────────────────────
  let blobUsers = [];
  try {
    const blobs = await list({ prefix: 'users.json' });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      blobUsers = await res.json();
      console.log(`Found ${blobUsers.length} user(s) in Blob.`);
    } else {
      console.log('No users.json found in Blob — nothing to migrate from Blob.');
    }
  } catch (err) {
    console.error('Failed to read Blob:', err.message);
  }

  let migrated = 0;
  let skipped = 0;

  // ── Migrate Blob users ───────────────────────────────────────────────
  for (const u of blobUsers) {
    const isAdmin = u.email === process.env.ADMIN_EMAIL;
    try {
      const { rowCount } = await pool.query(
        `INSERT INTO users (id, email, name, password_hash, is_admin)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [u.id || randomUUID(), u.email, u.name, u.passwordHash, isAdmin]
      );
      if (rowCount > 0) { migrated++; console.log(`  Migrated: ${u.email}`); }
      else { skipped++; console.log(`  Skipped (already exists): ${u.email}`); }
    } catch (err) {
      console.error(`  Error migrating ${u.email}:`, err.message);
    }
  }

  // ── Bootstrap admin from env vars (if not already in DB) ────────────
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
    const adminEmail = process.env.ADMIN_EMAIL;
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, name, password_hash, is_admin)
         VALUES ($1, $2, $3, true)`,
        [adminEmail, process.env.ADMIN_NAME || 'Admin', process.env.ADMIN_PASSWORD_HASH]
      );
      migrated++;
      console.log(`  Migrated bootstrap admin: ${adminEmail}`);
    } else {
      console.log(`  Admin already in DB: ${adminEmail}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const { rows: total } = await pool.query('SELECT COUNT(*) FROM users');
  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}, Total in DB: ${total[0].count}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
