/**
 * Run: node --test lib/client/productFormDraft.test.mjs
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductAddDraft,
  isMeaningfulProductDraft,
  sanitizeDraftValue,
  saveProductAddDraft,
  readProductAddDraft,
  clearProductAddDraft,
  PRODUCT_ADD_DRAFT_STORAGE_KEY,
} from './productFormDraft.js';

const memory = new Map();

beforeEach(() => {
  memory.clear();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => {
        memory.set(key, String(value));
      },
      removeItem: (key) => {
        memory.delete(key);
      },
    },
  };
});

afterEach(() => {
  delete globalThis.window;
});

describe('sanitizeDraftValue', () => {
  it('strips blob: URLs', () => {
    assert.equal(sanitizeDraftValue('blob:http://localhost/abc'), '');
  });

  it('keeps http image URLs', () => {
    assert.equal(sanitizeDraftValue('https://cdn.example.com/hero.jpg'), 'https://cdn.example.com/hero.jpg');
  });
});

describe('isMeaningfulProductDraft', () => {
  it('is false for empty draft', () => {
    assert.equal(isMeaningfulProductDraft(buildProductAddDraft({})), false);
  });

  it('is true when title is set', () => {
    assert.equal(
      isMeaningfulProductDraft(buildProductAddDraft({ formData: { title: 'Napkin Holder' } })),
      true
    );
  });

  it('is true when variant rows exist', () => {
    assert.equal(
      isMeaningfulProductDraft(
        buildProductAddDraft({
          variantRows: [{ size: 'S', color: 'Black', sku: '' }],
        })
      ),
      true
    );
  });

  it('is true when variant axes are selected', () => {
    assert.equal(
      isMeaningfulProductDraft(
        buildProductAddDraft({
          variantFieldSelection: { size: true, color: false, weight: false, unitCount: false },
        })
      ),
      true
    );
  });
});

describe('save / read / clear', () => {
  it('round-trips a meaningful draft', () => {
    const result = saveProductAddDraft({
      formData: { title: 'Tray', heroImage: 'https://cdn.example.com/a.jpg' },
      variantRows: [{ size: 'L', color: 'Gold' }],
      variantFieldSelection: { size: true, color: true, weight: false, unitCount: false },
      hasVariantsChoice: true,
      currentStep: 'selling',
    });
    assert.equal(result.ok, true);
    assert.equal(memory.has(PRODUCT_ADD_DRAFT_STORAGE_KEY), true);

    const loaded = readProductAddDraft();
    assert.equal(loaded.formData.title, 'Tray');
    assert.equal(loaded.variantRows.length, 1);
    assert.equal(loaded.hasVariantsChoice, true);
    assert.equal(loaded.currentStep, 'selling');
  });

  it('clears storage when saving an empty draft', () => {
    saveProductAddDraft({ formData: { title: 'Keep me' } });
    const cleared = saveProductAddDraft({ formData: { title: '' } });
    assert.equal(cleared.ok, true);
    assert.equal(cleared.cleared, true);
    assert.equal(readProductAddDraft(), null);
  });

  it('clearProductAddDraft removes the key', () => {
    saveProductAddDraft({ formData: { title: 'X' } });
    clearProductAddDraft();
    assert.equal(readProductAddDraft(), null);
  });
});
