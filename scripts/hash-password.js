#!/usr/bin/env node
// Run this locally to generate your ADMIN_PASSWORD_HASH env var:
//   node scripts/hash-password.js yourpassword
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log('\nAdd this to your Vercel environment variables:');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
