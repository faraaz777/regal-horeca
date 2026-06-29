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

const plateTag = { tags: /plate/i, deletedAt: null, productStatus: { $ne: 'inactive' } };

const byType = await Product.aggregate([
  { $match: plateTag },
  { $group: { _id: '$productType', count: { $sum: 1 } } },
]);
console.log('Products with plate in tags by productType:', byType);

const currentBase = {
  deletedAt: null,
  productType: { $in: ['standalone', 'child'] },
  productStatus: { $ne: 'inactive' },
};
console.log('Current base count:', await Product.countDocuments(currentBase));

const expandedBase = {
  deletedAt: null,
  productType: { $ne: 'parent' },
  productStatus: { $ne: 'inactive' },
};
console.log('Expanded base (not parent):', await Product.countDocuments(expandedBase));

const plateExpanded = await Product.countDocuments({
  ...expandedBase,
  $or: [{ title: /plate/i }, { tags: /plate/i }, { searchBlob: /plate/i }],
});
console.log('Plate search with expanded base:', plateExpanded);

const plateCurrent = await Product.countDocuments({
  ...currentBase,
  $or: [{ title: /plate/i }, { tags: /plate/i }, { searchBlob: /plate/i }],
});
console.log('Plate search with current base:', plateCurrent);

process.exit(0);
