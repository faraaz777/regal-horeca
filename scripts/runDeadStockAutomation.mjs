/**
 * runDeadStockAutomation.mjs
 *
 * Calls the same HTTP job as Vercel cron — one code path, no duplicated rules.
 *
 * Env:
 *   APP_URL or NEXT_PUBLIC_SITE_URL  Base URL (default http://localhost:3000)
 *   CRON_SECRET                      Required (Authorization Bearer)
 *
 * Flags:
 *   --dry-run
 *
 * Usage:
 *   npm run job:dead-stock:dry
 *   npm run job:dead-stock
 */

import path from 'node:path';
import fs from 'node:fs';

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
  const opts = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const opts = parseArgs(process.argv.slice(2));
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      'CRON_SECRET is required. Set it in .env.local, then call this script while the app is running (or against production APP_URL).'
    );
    process.exit(1);
  }

  const base = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');

  const url = `${base}/api/admin/inventory/jobs/dead-stock-automation`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dryRun: opts.dryRun }),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid JSON response' };
  }

  if (!response.ok) {
    console.error(`Job failed (${response.status}):`, data.error || data);
    process.exit(1);
  }

  for (const change of data.changes || []) {
    console.log(
      `${String(change.action).toUpperCase()} product=${change.productId} velocity=${change.velocityQty ?? change.soldQty}/${change.targetQty} sellable=${change.sellableQty}`
    );
  }

  console.log(
    JSON.stringify(
      {
        success: data.success,
        dryRun: data.dryRun,
        ranAt: data.ranAt,
        evaluated: data.evaluated,
        marked: data.marked,
        cleared: data.cleared,
        unchanged: data.unchanged,
        skippedTooNew: data.skippedTooNew,
        changeCount: (data.changes || []).length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
