import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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

const base = {
  deletedAt: null,
  productType: { $in: ['standalone', 'child'] },
  productStatus: { $ne: 'inactive' },
};

console.log('Base catalog count:', await Product.countDocuments(base));

for (const term of ['plate', 'bowl', 'blue']) {
  const regex = new RegExp(term, 'i');
  const q = {
    ...base,
    $or: [{ title: regex }, { tags: regex }, { searchBlob: regex }, { brand: regex }],
  };
  const c = await Product.countDocuments(q);
  console.log(`Search "${term}" count:`, c);
  const sample = await Product.findOne(q).select('title productType searchBlob tags').lean();
  if (sample) {
    console.log('  sample:', sample.title, sample.productType, (sample.searchBlob || '').slice(0, 100));
  }
}

const parentPlate = await Product.countDocuments({
  deletedAt: null,
  productType: 'parent',
  title: /plate/i,
});
console.log('Parent products with plate in title:', parentPlate);

const childEmptyBlob = await Product.countDocuments({
  ...base,
  productType: 'child',
  $or: [{ searchBlob: '' }, { searchBlob: { $exists: false } }],
});
console.log('Child products with empty searchBlob:', childEmptyBlob);

const catPlate = await Category.find({ name: /plate/i }).select('name').limit(5).lean();
console.log(
  'Categories with plate:',
  catPlate.map((c) => c.name)
);

if (catPlate.length) {
  const childInCat = await Product.countDocuments({
    ...base,
    $or: [
      { categoryId: { $in: catPlate.map((c) => c._id) } },
      { categoryIds: { $in: catPlate.map((c) => c._id) } },
    ],
  });
  console.log('Products in plate categories:', childInCat);
}

// Parent match -> children
const parentIds = await Product.find({
  deletedAt: null,
  productType: 'parent',
  $or: [{ title: /plate/i }, { searchBlob: /plate/i }, { tags: /plate/i }],
})
  .select('_id title')
  .limit(5)
  .lean();
console.log('Sample parents matching plate:', parentIds.map((p) => p.title));
if (parentIds.length) {
  const kids = await Product.countDocuments({
    ...base,
    parentProductId: { $in: parentIds.map((p) => p._id) },
  });
  console.log('Children of those parents:', kids);
}

// Broader plate search (any product type)
const anyPlate = await Product.find({
  deletedAt: null,
  $or: [
    { title: /plate/i },
    { searchBlob: /plate/i },
    { tags: /plate/i },
    { description: /plate/i },
    { summary: /plate/i },
  ],
})
  .select('title productType tags categoryId categoryIds')
  .limit(10)
  .lean();
console.log('Any product with plate (sample):', anyPlate.length);
anyPlate.forEach((p) =>
  console.log(' ', p.productType, p.title, 'tags:', p.tags, 'cat:', p.categoryId)
);

const bowlAny = await Product.countDocuments({
  deletedAt: null,
  $or: [{ title: /bowl/i }, { searchBlob: /bowl/i }, { tags: /bowl/i }],
});
console.log('Any product with bowl:', bowlAny);

// Sample child titles
const samples = await Product.find(base).select('title searchBlob tags productType').limit(5).lean();
console.log('Sample catalog titles:');
samples.forEach((s) => console.log(' ', s.title, '| blob:', (s.searchBlob || '').slice(0, 60)));
