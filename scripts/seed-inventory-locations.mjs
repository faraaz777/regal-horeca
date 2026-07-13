/**
 * Seed location tree for inventory (Branch › Floor › Rack).
 * Each floor gets RACKS_PER_FLOOR racks with capacity MAX_PRODUCTS_PER_RACK.
 * Usage: node scripts/seed-inventory-locations.mjs
 */

import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEP = ' › ';
const RACKS_PER_FLOOR = 5;
const MAX_PRODUCTS_PER_RACK = 5;

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

const LocationSchema = new mongoose.Schema(
  {
    code: String,
    name: String,
    parentLocationId: { type: mongoose.Schema.Types.ObjectId, default: null },
    path: String,
    level: String,
    isActive: { type: Boolean, default: true },
    capacity: { type: Number, default: null },
  },
  { timestamps: true }
);

function racksForFloor() {
  return Array.from({ length: RACKS_PER_FLOOR }, (_, i) => {
    const n = i + 1;
    return {
      code: `R${n}`,
      name: `Rack ${n}`,
      level: 'rack',
      capacity: MAX_PRODUCTS_PER_RACK,
    };
  });
}

/** Branch → floors → 5 racks each (active inventory model). */
const TREE = [
  {
    code: 'b1',
    name: 'Begum Bazaar HQ',
    level: 'branch',
    children: [
      {
        code: 'f1',
        name: 'Ground Floor',
        level: 'floor',
        children: racksForFloor(),
      },
      {
        code: 'f2',
        name: 'First Floor',
        level: 'floor',
        children: racksForFloor(),
      },
    ],
  },
];

function buildPath(codes) {
  return codes.join(SEP);
}

async function upsertNode(node, parentId, codePath, Location) {
  const codes = [...codePath, node.code];
  const path = buildPath(codes);

  let doc = await Location.findOne({ path });
  if (!doc) {
    doc = await Location.create({
      code: node.code,
      name: node.name || '',
      parentLocationId: parentId,
      path,
      level: node.level,
      isActive: true,
      ...(node.capacity != null ? { capacity: node.capacity } : {}),
    });
  } else if (node.level === 'rack' && node.capacity != null && doc.capacity == null) {
    doc.capacity = node.capacity;
    await doc.save();
  }

  for (const child of node.children || []) {
    await upsertNode(child, doc._id, codes, Location);
  }
  return doc;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const Location = mongoose.models.Location || mongoose.model('Location', LocationSchema);

  for (const root of TREE) {
    await upsertNode(root, null, [], Location);
  }

  const racks = await Location.find({ level: 'rack', isActive: true }).sort({ path: 1 }).lean();
  console.log(`Seeded ${racks.length} rack location(s) (${RACKS_PER_FLOOR} per floor):`);
  racks.forEach((r) => console.log(` - ${r.path} (capacity ${r.capacity ?? '—'})`));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
