/**
 * Node built-in tests for variant matrix helpers.
 * Run: node --test lib/shared/variantMatrix.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOptionValues,
  getVariantCombinationKey,
  buildVariantCombinations,
  ensureBlankRowVariantFieldSelection,
  inferVariantFieldSelection,
  buildVariantBuilderInputsFromRows,
  validateVariantRowsAgainstAxes,
} from './variantMatrix.js';

describe('parseOptionValues', () => {
  it('splits, trims, and dedupes case-insensitively', () => {
    assert.deepEqual(parseOptionValues(' S, M, s ,L '), ['S', 'M', 'L']);
  });
});

describe('buildVariantCombinations', () => {
  it('builds m rows for a single axis (3 sizes)', () => {
    const combos = buildVariantCombinations([{ key: 'size', values: ['S', 'M', 'L'] }]);
    assert.equal(combos.length, 3);
    assert.deepEqual(combos.map((c) => c.size), ['S', 'M', 'L']);
  });

  it('builds m×n for size × colour (3×1 = 3)', () => {
    const combos = buildVariantCombinations([
      { key: 'size', values: ['S', 'M', 'L'] },
      { key: 'color', values: ['Black'] },
    ]);
    assert.equal(combos.length, 3);
    assert.deepEqual(combos, [
      { size: 'S', color: 'Black' },
      { size: 'M', color: 'Black' },
      { size: 'L', color: 'Black' },
    ]);
  });

  it('builds m×n for size × colour (2×3 = 6)', () => {
    const combos = buildVariantCombinations([
      { key: 'size', values: ['10"', '12"'] },
      { key: 'color', values: ['Black', 'Gold', 'Chrome'] },
    ]);
    assert.equal(combos.length, 6);
  });

  it('returns [] for empty dimensions', () => {
    assert.deepEqual(buildVariantCombinations([]), []);
    assert.deepEqual(buildVariantCombinations([{ key: 'size', values: [] }]), []);
  });

  it('rejects more than 2 axes', () => {
    assert.throws(
      () =>
        buildVariantCombinations([
          { key: 'size', values: ['S'] },
          { key: 'color', values: ['Red'] },
          { key: 'weight', values: ['1kg'] },
        ]),
      /at most 2/
    );
  });
});

describe('getVariantCombinationKey', () => {
  it('is case-insensitive and order-stable', () => {
    assert.equal(
      getVariantCombinationKey({ size: 'S', color: 'Black' }),
      getVariantCombinationKey({ size: 's', color: 'black' })
    );
  });
});

describe('ensureBlankRowVariantFieldSelection', () => {
  it('defaults to size + colour when nothing is selected', () => {
    assert.deepEqual(ensureBlankRowVariantFieldSelection({}), {
      size: true,
      color: true,
      weight: false,
      unitCount: false,
    });
  });

  it('preserves already-selected axes (e.g. weight only)', () => {
    assert.deepEqual(
      ensureBlankRowVariantFieldSelection({
        size: false,
        color: false,
        weight: true,
        unitCount: false,
      }),
      {
        size: false,
        color: false,
        weight: true,
        unitCount: false,
      }
    );
  });
});

describe('inferVariantFieldSelection', () => {
  it('prefers variationTheme over empty row inference', () => {
    assert.deepEqual(
      inferVariantFieldSelection({
        rows: [{ size: '', color: '' }],
        variationTheme: ['size', 'color'],
      }),
      {
        size: true,
        color: true,
        weight: false,
        unitCount: false,
      }
    );
  });

  it('falls back to non-empty row fields', () => {
    assert.deepEqual(
      inferVariantFieldSelection({
        rows: [{ size: 'L', color: '', weight: '1kg' }],
        variationTheme: [],
      }),
      {
        size: true,
        color: false,
        weight: true,
        unitCount: false,
      }
    );
  });
});

describe('buildVariantBuilderInputsFromRows', () => {
  it('collects unique axis values for regenerate chips', () => {
    assert.deepEqual(
      buildVariantBuilderInputsFromRows([
        { size: 'S', color: 'Black' },
        { size: 'M', color: 'Black' },
        { size: 's', color: 'Gold' },
      ]),
      {
        size: 'S, M',
        color: 'Black, Gold',
        weight: '',
        unitCount: '',
      }
    );
  });
});

describe('validateVariantRowsAgainstAxes', () => {
  it('requires selected axes on every row', () => {
    const msg = validateVariantRowsAgainstAxes(
      [{ size: 'S', color: '' }, { size: 'M', color: 'Black' }],
      { size: true, color: true }
    );
    assert.match(msg, /Colour/);
  });

  it('passes when selected axes are filled', () => {
    assert.equal(
      validateVariantRowsAgainstAxes([{ size: 'S' }, { size: 'M' }], { size: true, color: false }),
      null
    );
  });
});
