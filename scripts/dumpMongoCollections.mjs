/**
 * Download all MongoDB collections to a local folder as JSON.
 *
 * Reads MONGODB_URI from .env.local (same pattern as other admin scripts).
 *
 * Usage:
 *   node scripts/dumpMongoCollections.mjs
 *   node scripts/dumpMongoCollections.mjs --out=./mongo-backups
 *   node scripts/dumpMongoCollections.mjs --collections=products,stocks
 *   node scripts/dumpMongoCollections.mjs --db=test --uri="mongodb+srv://..."
 *   node scripts/dumpMongoCollections.mjs --ndjson
 *
 * Options:
 *   --out=DIR           Parent folder for the dump (default: scripts/mongo-dumps)
 *   --collections=a,b   Only these collections (comma-separated)
 *   --db=NAME           Force database name if URI has none
 *   --uri=...           Override MONGODB_URI
 *   --ndjson            Write one JSON object per line (better for huge collections)
 *   --pretty            Pretty-print JSON arrays (ignored with --ndjson)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

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

function parseArgs(argv) {
  const opts = {
    out: resolve(__dirname, 'mongo-dumps'),
    collections: null,
    db: null,
    uri: null,
    ndjson: false,
    pretty: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--out=')) opts.out = resolve(arg.slice(6));
    else if (arg.startsWith('--collections=')) {
      opts.collections = arg
        .slice(14)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--db=')) opts.db = arg.slice(5).trim() || null;
    else if (arg.startsWith('--uri=')) opts.uri = arg.slice(6);
    else if (arg === '--ndjson') opts.ndjson = true;
    else if (arg === '--pretty') opts.pretty = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeCollectionArray(coll, filePath, pretty) {
  const cursor = coll.find({}).batchSize(500);
  const docs = [];
  for await (const doc of cursor) {
    docs.push(doc);
  }
  const payload = pretty ? EJSON.stringify(docs, null, 2) : EJSON.stringify(docs);
  writeFileSync(filePath, payload, 'utf8');
  return docs.length;
}

async function writeCollectionNdjson(coll, filePath) {
  let count = 0;
  const cursor = coll.find({}).batchSize(500);
  const stream = Readable.from(
    (async function* () {
      for await (const doc of cursor) {
        count += 1;
        yield `${EJSON.stringify(doc)}\n`;
      }
    })()
  );
  await pipeline(stream, createWriteStream(filePath, { encoding: 'utf8' }));
  return count;
}

loadEnvLocal();
const opts = parseArgs(process.argv.slice(2));

if (opts.help) {
  console.log(`Usage: node scripts/dumpMongoCollections.mjs [--out=DIR] [--collections=a,b] [--db=NAME] [--uri=...] [--ndjson] [--pretty]`);
  process.exit(0);
}

const uri = opts.uri || process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required (set in .env.local or pass --uri=...)');
  process.exit(1);
}

const connectOpts = {};
if (opts.db) connectOpts.dbName = opts.db;

await mongoose.connect(uri, connectOpts);
const db = mongoose.connection.db;
const dbName = db.databaseName;

const dumpDir = join(opts.out, `${dbName}-${stamp()}`);
mkdirSync(dumpDir, { recursive: true });

console.log(`Connected to database: ${dbName}`);
console.log(`Writing dump to: ${dumpDir}`);

const listed = await db.listCollections().toArray();
let names = listed
  .map((c) => c.name)
  .filter((name) => !name.startsWith('system.'))
  .sort((a, b) => a.localeCompare(b));

if (opts.collections?.length) {
  const wanted = new Set(opts.collections);
  const missing = opts.collections.filter((n) => !names.includes(n));
  if (missing.length) {
    console.warn(`Warning: collections not found: ${missing.join(', ')}`);
  }
  names = names.filter((n) => wanted.has(n));
}

if (!names.length) {
  console.log('No collections to dump.');
  await mongoose.disconnect();
  process.exit(0);
}

const summary = [];
for (const name of names) {
  const coll = db.collection(name);
  const fileName = opts.ndjson ? `${name}.ndjson` : `${name}.json`;
  const filePath = join(dumpDir, fileName);
  process.stdout.write(`  ${name} ... `);
  try {
    const count = opts.ndjson
      ? await writeCollectionNdjson(coll, filePath)
      : await writeCollectionArray(coll, filePath, opts.pretty);
    console.log(`${count} docs → ${fileName}`);
    summary.push({ collection: name, documents: count, file: fileName });
  } catch (err) {
    console.log('FAILED');
    console.error(`    ${err.message}`);
    summary.push({ collection: name, documents: null, file: fileName, error: err.message });
  }
}

writeFileSync(
  join(dumpDir, '_manifest.json'),
  JSON.stringify(
    {
      database: dbName,
      exportedAt: new Date().toISOString(),
      uriHost: (() => {
        try {
          return new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://')).host;
        } catch {
          return '(unknown)';
        }
      })(),
      format: opts.ndjson ? 'ndjson-ejson' : 'json-array-ejson',
      collections: summary,
    },
    null,
    2
  ),
  'utf8'
);

const ok = summary.filter((s) => s.documents != null);
const totalDocs = ok.reduce((sum, s) => sum + s.documents, 0);
console.log(`\nDone. ${ok.length}/${summary.length} collections, ${totalDocs} documents.`);
console.log(`Folder: ${dumpDir}`);

await mongoose.disconnect();
