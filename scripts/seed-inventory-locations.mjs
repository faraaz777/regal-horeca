/**
 * Seed location tree for inventory (code-based paths: b1 › f1 › sec1 › z1 › R12 › Shelf 3).
 * Usage: node scripts/seed-inventory-locations.mjs
 */

import mongoose from 'mongoose';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEP = ' › ';

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
  },
  { timestamps: true }
);

/** Matches reference UI: Begum Bazaar HQ → … → R12 → Shelf 3 */
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
        children: [
          {
            code: 'sec1',
            name: 'Crockery',
            level: 'section',
            children: [
              {
                code: 'z1',
                name: 'Zone A',
                level: 'zone',
                children: [
                  {
                    code: 'R12',
                    name: 'Normal',
                    level: 'rack',
                    children: [
                      { code: 'Shelf 1', name: '', level: 'shelf' },
                      { code: 'Shelf 2', name: '', level: 'shelf' },
                      { code: 'Shelf 3', name: '', level: 'shelf' },
                    ],
                  },
                  {
                    code: 'R13',
                    name: 'Display',
                    level: 'rack',
                    children: [{ code: 'Shelf 1', name: '', level: 'shelf' }],
                  },
                ],
              },
            ],
          },
        ],
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
    });
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

  const shelves = await Location.find({ level: 'shelf' }).sort({ path: 1 }).lean();
  console.log(`Seeded ${shelves.length} shelf location(s):`);
  shelves.forEach((s) => console.log(' -', s.path));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
