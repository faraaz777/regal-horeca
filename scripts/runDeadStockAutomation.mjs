/**
 * runDeadStockAutomation.mjs
 *
 * Evaluates InventoryRule dead-stock velocity rules and updates deadStockMarked.
 * Prefer this for cron / Task Scheduler. Admins can also POST
 * /api/admin/inventory/jobs/dead-stock-automation
 *
 * Rule:
 *   If sold qty in deadStockPeriod < deadStockQty AND sellableQty > 0 → mark
 *   If sold qty >= deadStockQty → clear tag
 *   Skip rules younger than one full period (avoids marking brand-new intake)
 *
 * Flags:
 *   --dry-run   Log only
 *   --uri=...   Override MONGODB_URI
 *
 * Usage:
 *   node scripts/runDeadStockAutomation.mjs --dry-run
 *   node scripts/runDeadStockAutomation.mjs
 */

import path from 'node:path';
import fs from 'node:fs';
import mongoose from 'mongoose';

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
  const opts = { dryRun: false, uri: null };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg.startsWith('--uri=')) opts.uri = arg.slice(6);
  }
  return opts;
}

const MS_DAY = 86400000;

function periodMs(period) {
  const days = { day: 1, week: 7, month: 30, '3month': 90, '6month': 180 }[period] || 30;
  return days * MS_DAY;
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const opts = parseArgs(process.argv.slice(2));
  if (opts.uri) process.env.MONGODB_URI = opts.uri;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const now = new Date();

  const rules = await db.collection('inventoryrules').find({}).toArray();
  let marked = 0;
  let cleared = 0;
  let skippedTooNew = 0;
  let unchanged = 0;
  const changes = [];

  for (const rule of rules) {
    const ms = periodMs(rule.deadStockPeriod);
    if (rule.createdAt && now - new Date(rule.createdAt) < ms) {
      skippedTooNew += 1;
      continue;
    }

    const from = new Date(now.getTime() - ms);
    const soldAgg = await db
      .collection('stockledgers')
      .aggregate([
        {
          $match: {
            productId: rule.productId,
            createdAt: { $gte: from, $lte: now },
            $or: [{ type: 'sale_fulfill' }, { reason: 'sold', statusBucket: 'sold' }],
          },
        },
        { $group: { _id: null, qty: { $sum: { $abs: '$qty' } } } },
      ])
      .toArray();
    const soldQty = soldAgg[0]?.qty || 0;

    const stockRows = await db
      .collection('stocks')
      .find({ productId: rule.productId, statusBucket: 'sellable', qty: { $gt: 0 } })
      .project({ qty: 1 })
      .toArray();
    const sellableQty = stockRows.reduce((s, r) => s + (r.qty || 0), 0);

    const target = Number(rule.deadStockQty) || 0;
    const currentlyMarked = Boolean(rule.deadStockMarked);
    let nextMarked = currentlyMarked;
    if (soldQty >= target) nextMarked = false;
    else if (sellableQty > 0) nextMarked = true;

    if (nextMarked === currentlyMarked) {
      unchanged += 1;
      continue;
    }

    if (!opts.dryRun) {
      await db
        .collection('inventoryrules')
        .updateOne({ _id: rule._id }, { $set: { deadStockMarked: nextMarked, updatedAt: now } });

      const periodLabel =
        { day: 'A day', week: 'Week', month: 'Month', '3month': '3 months', '6month': '6 months' }[
          rule.deadStockPeriod
        ] || rule.deadStockPeriod;
      const reason = nextMarked
        ? `${periodLabel} sales rule failed: sold ${soldQty} / target ${target}`
        : `Sales recovered: sold ${soldQty} / target ${target} in ${periodLabel}`;

      await db.collection('auditlogs').insertOne({
        actorRole: 'system',
        action: nextMarked ? 'inventory.dead_stock_marked' : 'inventory.dead_stock_cleared',
        entityType: 'Product',
        entityId: rule.productId,
        before: {
          condition: currentlyMarked ? 'HAS_DEAD_STOCK' : 'NORMAL',
          deadStockMarked: currentlyMarked,
        },
        after: {
          condition: nextMarked ? 'HAS_DEAD_STOCK' : 'NORMAL',
          deadStockMarked: nextMarked,
        },
        metadata: {
          source: 'automation',
          reason,
          soldQty,
          targetQty: target,
          sellableQty,
          deadStockPeriod: rule.deadStockPeriod,
        },
        ip: '',
        userAgent: '',
        createdAt: now,
      });
    }

    const action = nextMarked ? 'marked' : 'cleared';
    if (nextMarked) marked += 1;
    else cleared += 1;
    changes.push({
      productId: String(rule.productId),
      action,
      soldQty,
      targetQty: target,
      sellableQty,
    });
    console.log(
      `${action.toUpperCase()} product=${rule.productId} sold=${soldQty}/${target} sellable=${sellableQty}`
    );
  }

  const summary = {
    success: true,
    dryRun: opts.dryRun,
    ranAt: now.toISOString(),
    evaluated: rules.length,
    marked,
    cleared,
    unchanged,
    skippedTooNew,
    changeCount: changes.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
