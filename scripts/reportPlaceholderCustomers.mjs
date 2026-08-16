/**
 * reportPlaceholderCustomers.mjs
 *
 * Read-only report of Customer rows that look like placeholder identity:
 *   - phone = 0000000000
 *   - email contains @temp.regal-horeca.com
 *   - name is Guest User / Walk-in Customer / Customer N
 *
 * Does not update or delete anything. Review the JSON before any cleanup.
 *
 * Usage:
 *   node scripts/reportPlaceholderCustomers.mjs
 *   node scripts/reportPlaceholderCustomers.mjs --uri=mongodb://...
 *   node scripts/reportPlaceholderCustomers.mjs --out=scripts/_placeholder-customers.json
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

const TEMP_EMAIL_DOMAIN = '@temp.regal-horeca.com';
const FAKE_PHONE = '0000000000';
const PLACEHOLDER_NAME_RE = /^(guest user|walk-in customer|customer\s*\d+)$/i;

function loadEnvFile(name) {
  try {
    const p = path.resolve(process.cwd(), name);
    if (!fs.existsSync(p)) return;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

function parseArgs(argv) {
  const opts = { uri: null, out: null };
  for (const arg of argv) {
    if (arg.startsWith('--uri=')) opts.uri = arg.slice(6);
    else if (arg.startsWith('--out=')) opts.out = arg.slice(6);
  }
  return opts;
}

function reasonsFor(row) {
  const reasons = [];
  if (String(row.phone || '') === FAKE_PHONE) reasons.push('fake_phone');
  if (String(row.email || '').includes(TEMP_EMAIL_DOMAIN)) reasons.push('temp_email');
  if (PLACEHOLDER_NAME_RE.test(String(row.name || '').trim())) reasons.push('placeholder_name');
  return reasons;
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const opts = parseArgs(process.argv.slice(2));
  const uri = opts.uri || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const customers = mongoose.connection.db.collection('customers');

  const filter = {
    $or: [
      { phone: FAKE_PHONE },
      { email: { $regex: TEMP_EMAIL_DOMAIN.replace('.', '\\.'), $options: 'i' } },
      { name: { $regex: '^(guest user|walk-in customer|customer\\s*\\d+)$', $options: 'i' } },
    ],
  };

  const rows = await customers
    .find(filter)
    .project({ name: 1, phone: 1, email: 1, companyName: 1, createdAt: 1, updatedAt: 1 })
    .toArray();

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    total: rows.length,
    customers: rows.map((row) => ({
      id: String(row._id),
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      companyName: row.companyName || '',
      reasons: reasonsFor(row),
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    })),
  };

  const outPath = path.resolve(
    process.cwd(),
    opts.out || `scripts/_placeholder-customers-${Date.now()}.json`
  );
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Placeholder customers: ${report.total}`);
  console.log(`Report written: ${outPath}`);
  console.log('Read-only — no Customer rows were changed.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
