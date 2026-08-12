const crypto = require('node:crypto');
const db = require('../db');

const [username = 'admin', password = 'change-me-now', email = 'admin@example.com'] = process.argv.slice(2);
if (password.length < 8) throw new Error('Password must be at least 8 characters');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
db.prepare(`INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, 'admin')
  ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, email = excluded.email, role = 'admin'`)
  .run(username, `${salt}:${hash}`, email);
console.log(`Admin ready: ${username}`);
