/**
 * Quick sanity checks for barcode validation helpers (no database).
 * Run: node scripts/testBarcodeValidation.mjs
 */

function normalizeBarcode(value) {
  return String(value ?? '').trim();
}

function findDuplicateBarcodesInRows(rows) {
  const seen = new Map();
  for (let i = 0; i < (rows || []).length; i += 1) {
    const barcode = normalizeBarcode(rows[i]?.barcode);
    if (!barcode) continue;
    if (seen.has(barcode)) {
      return `Duplicate barcode "${barcode}" in variant rows #${seen.get(barcode) + 1} and #${i + 1}.`;
    }
    seen.set(barcode, i);
  }
  return null;
}

let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    failed += 1;
  } else {
    console.log('OK:', message);
  }
}

assert(findDuplicateBarcodesInRows([]) === null, 'empty rows');
assert(findDuplicateBarcodesInRows([{ barcode: 'A' }, { barcode: 'B' }]) === null, 'unique barcodes');
assert(
  findDuplicateBarcodesInRows([{ barcode: 'X' }, { barcode: 'X' }])?.includes('Duplicate'),
  'detect duplicate in rows'
);
assert(
  findDuplicateBarcodesInRows([{ barcode: ' 123 ' }, { barcode: '123' }])?.includes('Duplicate'),
  'trim before duplicate check'
);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll barcode validation sanity checks passed.');
