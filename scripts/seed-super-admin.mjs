/**
 * Seed the first super_admin user.
 *
 * Usage:
 *   SUPER_ADMIN_EMAIL=admin@regal.com SUPER_ADMIN_PASSWORD=YourSecurePass node scripts/seed-super-admin.mjs
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const USER_ROLES = ['super_admin', 'product_manager', 'inventory_supervisor', 'data_entry', 'sales', 'inventory_manager', 'viewer'];

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: USER_ROLES, default: 'super_admin' },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  const email = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@regal-horeca.com').toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  if (!password) {
    console.error('Set SUPER_ADMIN_PASSWORD or ADMIN_PASSWORD');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User already exists: ${email} (role: ${existing.role})`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    email,
    passwordHash,
    name,
    role: 'super_admin',
    isActive: true,
    tokenVersion: 0,
  });

  console.log(`Created super_admin: ${email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
