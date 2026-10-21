import 'server-only';

import mongoose from 'mongoose';
import Product from '@/lib/models/Product';
import StockLedger from '@/lib/models/StockLedger';

const MATCH_CAP = 30;
const CANDIDATE_LIMIT = 200;

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeMovementSearch(raw) {
  return String(raw || '').replace(/[\r\n]+/g, ' ').trim();
}

function codeTerms(term) {
  const compact = term.replace(/\s+/g, '');
  return [...new Set([term, compact].filter(Boolean))];
}

function titleWords(term) {
  if (term.length < 2) return [];
  return term.split(/\s+/).map((word) => word.trim()).filter((word) => word.length >= 2);
}

async function ledgerBacked(candidateIds) {
  if (!candidateIds.length) return [];
  const present = await StockLedger.distinct('productId', {
    productId: { $in: candidateIds },
  });
  const allow = new Set(present.map((id) => String(id)));
  return candidateIds.filter((id) => allow.has(String(id)));
}

async function findProducts(filter) {
  return Product.find(filter).select('_id').limit(CANDIDATE_LIMIT).lean();
}

/**
 * Product lookup for stock movements.
 *
 * Catalog search is not used. It matches descriptions and categories and
 * returns unrelated products. This prefers an exact code, then a code
 * prefix, then the title, and only products that already have movements.
 */
export async function findMovementProductIds(raw) {
  const term = normalizeMovementSearch(raw);
  if (!term) return { ids: [], truncated: false };

  const codes = codeTerms(term);
  const exactRaw = await findProducts({
    $or: codes.flatMap((code) => [{ sku: code }, { barcode: code }, { hsnCode: code }]),
  });
  const exactRawLedger = await ledgerBacked(exactRaw.map((row) => row._id));
  if (exactRawLedger.length) {
    return {
      ids: exactRawLedger.slice(0, MATCH_CAP),
      truncated: exactRawLedger.length > MATCH_CAP,
    };
  }

  const exactLoose = await findProducts({
    $or: codes.flatMap((code) => {
      const pattern = new RegExp(`^${escapeRegex(code)}$`, 'i');
      return [{ sku: pattern }, { barcode: pattern }, { hsnCode: pattern }];
    }),
  });
  const exactLooseLedger = await ledgerBacked(exactLoose.map((row) => row._id));
  if (exactLooseLedger.length) {
    return {
      ids: exactLooseLedger.slice(0, MATCH_CAP),
      truncated: exactLooseLedger.length > MATCH_CAP,
    };
  }

  const prefixSensitive = await findProducts({
    $or: codes.flatMap((code) => {
      const pattern = new RegExp(`^${escapeRegex(code)}`);
      return [{ sku: pattern }, { barcode: pattern }];
    }),
  });
  const prefixLoose = await findProducts({
    $or: codes.flatMap((code) => {
      const pattern = new RegExp(`^${escapeRegex(code)}`, 'i');
      return [{ sku: pattern }, { barcode: pattern }];
    }),
  });
  const prefixIds = [];
  const seenPrefix = new Set();
  for (const row of [...prefixSensitive, ...prefixLoose]) {
    const key = String(row._id);
    if (seenPrefix.has(key)) continue;
    seenPrefix.add(key);
    prefixIds.push(row._id);
  }
  const prefixLedger = await ledgerBacked(prefixIds);
  if (prefixLedger.length) {
    return {
      ids: prefixLedger.slice(0, MATCH_CAP),
      truncated: prefixLedger.length > MATCH_CAP,
    };
  }

  const words = titleWords(term);
  if (!words.length) return { ids: [], truncated: false };

  const collected = [];
  const seen = new Set();
  let truncated = false;
  const take = (ids) => {
    for (const id of ids) {
      const key = String(id);
      if (seen.has(key)) continue;
      if (collected.length >= MATCH_CAP) {
        truncated = true;
        return;
      }
      seen.add(key);
      collected.push(id);
    }
  };

  const starts = new RegExp(`^${escapeRegex(term)}`, 'i');
  const wordAnd = words.map((word) => ({
    title: new RegExp(`\\b${escapeRegex(word)}\\b`, 'i'),
  }));
  const wordFilter = wordAnd.length === 1 ? wordAnd[0] : { $and: wordAnd };

  const ownStarts = await findProducts({ title: starts });
  take(await ledgerBacked(ownStarts.map((row) => row._id)));
  if (collected.length < MATCH_CAP) {
    const ownWords = await findProducts(wordFilter);
    take(await ledgerBacked(ownWords.map((row) => row._id)));
    if (ownWords.length === CANDIDATE_LIMIT) truncated = true;
  }

  if (collected.length < MATCH_CAP) {
    const parents = await Product.find({
      productType: 'parent',
      $or: [{ title: starts }, wordFilter.$and ? { $and: wordFilter.$and } : wordFilter],
    })
      .select('_id')
      .limit(40)
      .lean();
    if (parents.length) {
      const parentIds = parents.map((row) => row._id);
      const family = await Product.find({
        $or: [{ _id: { $in: parentIds } }, { parentProductId: { $in: parentIds } }],
      })
        .select('_id')
        .limit(CANDIDATE_LIMIT)
        .lean();
      take(await ledgerBacked(family.map((row) => row._id)));
      if (family.length === CANDIDATE_LIMIT) truncated = true;
    }
  }

  return { ids: collected, truncated };
}

async function idsForBrand(brandName) {
  const parents = await Product.find({ brand: brandName, productType: 'parent' }).select('_id').lean();
  const parentIds = parents.map((row) => row._id);
  const or = [{ brand: brandName }];
  if (parentIds.length) or.push({ parentProductId: { $in: parentIds } });
  const rows = await Product.find({ $or: or }).select('_id').lean();
  return rows.map((row) => row._id);
}

/** A null clause means the search box is empty and the ledger stays unfiltered. */
export async function resolveMovementProductClause({ productId = '', search = '', brand = '' } = {}) {
  const pinned = String(productId || '').trim();
  const term = normalizeMovementSearch(search);
  const brandName = String(brand || '').trim();
  let ids = null;
  let truncated = false;

  if (term) {
    const found = await findMovementProductIds(term);
    ids = found.ids;
    truncated = found.truncated;
  }

  if (brandName) {
    const brandIds = await idsForBrand(brandName);
    if (ids) {
      const allow = new Set(brandIds.map((id) => String(id)));
      ids = ids.filter((id) => allow.has(String(id)));
    } else {
      ids = brandIds;
    }
  }

  if (pinned && mongoose.Types.ObjectId.isValid(pinned)) {
    const pin = new mongoose.Types.ObjectId(pinned);
    if (ids && !ids.some((id) => String(id) === String(pin))) {
      return { clause: { productId: { $in: [] } }, truncated: false };
    }
    return { clause: { productId: pin }, truncated: false };
  }

  if (!ids) return { clause: null, truncated: false };
  if (!ids.length) return { clause: { productId: { $in: [] } }, truncated: false };
  return { clause: { productId: { $in: ids } }, truncated };
}
