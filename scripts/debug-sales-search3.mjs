import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectToDatabase } from '../lib/db/connect.js';
import Product from '../lib/models/Product.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const envPath = resolve(__dirname, '../.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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
await connectToDatabase();

// Dynamic import won't work easily with server-only — inline the new base filter
const base = {
  deletedAt: null,
  productStatus: { $ne: 'inactive' },
  productType: { $ne: 'parent' },
};

for (const term of ['plate', 'bowl', 'blue plate', '']) {
  let q = base;
  if (term) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q = {
      ...base,
      $or: [{ title: regex }, { tags: regex }, { searchBlob: regex }],
    };
  }
  const c = await Product.countDocuments(q);
  console.log(`"${term || '(browse)'}" => ${c} products`);
}

process.exit(0);
