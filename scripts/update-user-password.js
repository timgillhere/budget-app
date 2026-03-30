#!/usr/bin/env node
// Update or create a user's password in Vercel Blob users.json
// Usage: node scripts/update-user-password.js <email> <newPassword>
// Requires BLOB_READ_WRITE_TOKEN to be set in environment (or .env file)
import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // fallback to .env
import bcrypt from 'bcryptjs';
import { list, put } from '@vercel/blob';
import { randomUUID } from 'crypto';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/update-user-password.js <email> <newPassword>');
  process.exit(1);
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
  console.log('No existing users.json, starting fresh.');
}

const passwordHash = await bcrypt.hash(password, 10);
const existing = users.findIndex((u) => u.email === email);

if (existing >= 0) {
  users[existing].passwordHash = passwordHash;
  console.log(`Updated password for ${email}`);
} else {
  users.push({ id: randomUUID(), name: email.split('@')[0], email, passwordHash });
  console.log(`Created new user ${email}`);
}

await put('users.json', JSON.stringify(users, null, 2), {
  access: 'private',
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: 'application/json',
});

console.log('Done.');
