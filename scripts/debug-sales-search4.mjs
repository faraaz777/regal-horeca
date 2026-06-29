import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectToDatabase } from '../lib/db/connect.js';
import Product from '../lib/models/Product.js';
import Category from '../lib/models/Category.js';

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

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const base = {
  deletedAt: null,
  productStatus: { $ne: 'inactive' },
  productType: { $ne: 'parent' },
};

const PRODUCT_TEXT_FIELDS = (regex) => [
  { title: regex },
  { tags: regex },
  { searchBlob: regex },
  { 'colorVariants.colorName': regex },
  { 'variationAttributes.color': regex },
];

async function countForTerm(term) {
  const tokens = term.split(/\s+/).filter(Boolean);
  const lookups = await Promise.all(
    tokens.map(async (token) => {
      const regex = new RegExp(escapeRegex(token), 'i');
      const categoryIds = (
        await Category.find({ name: regex }).select('_id').limit(40).lean()
      ).map((r) => r._id);
      const parentIds = (
        await Product.find({
          deletedAt: null,
          productType: 'parent',
          $or: PRODUCT_TEXT_FIELDS(regex),
        })
          .select('_id')
          .limit(80)
          .lean()
      ).map((r) => r._id);

      const branches = [{ $or: PRODUCT_TEXT_FIELDS(regex) }];
      if (categoryIds.length) {
        branches.push({
          $or: [
            { categoryId: { $in: categoryIds } },
            { categoryIds: { $in: categoryIds } },
          ],
        });
      }
      if (parentIds.length) branches.push({ parentProductId: { $in: parentIds } });
      return branches.length === 1 ? branches[0] : { $or: branches };
    })
  );

  const searchFilter = lookups.length === 1 ? lookups[0] : { $and: lookups };
  const q = { ...base, ...searchFilter };
  const c = await Product.countDocuments(q);
  console.log(`"${term}" => ${c}`);
}

for (const term of ['plate', 'bowl', 'blue', 'blue plate', 'ivory plate']) {
  await countForTerm(term);
}

process.exit(0);
