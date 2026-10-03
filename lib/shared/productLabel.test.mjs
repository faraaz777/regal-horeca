/**
 * Node built-in tests for product label helpers.
 * Run: node --test lib/shared/productLabel.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectProductLabelItems,
  getLabelSize,
  labelQrValue,
  productPageUrl,
  toProductLabelItem,
  variantLineFromAttrs,
} from './productLabel.js';

describe('variantLineFromAttrs', () => {
  it('joins size and color and skips blanks', () => {
    assert.equal(variantLineFromAttrs({ size: '12"', color: 'Silver', weight: '' }), '12" / Silver');
  });
});

describe('productPageUrl', () => {
  it('builds an absolute PDP URL', () => {
    assert.equal(
      productPageUrl('mixing-bowl', 'https://regalhoreca.com'),
      'https://regalhoreca.com/products/mixing-bowl'
    );
  });

  it('returns empty when there is no slug', () => {
    assert.equal(productPageUrl('', 'https://regalhoreca.com'), '');
  });
});

describe('labelQrValue', () => {
  it('prefers the product page over SKU', () => {
    assert.equal(
      labelQrValue({ slug: 'bowl', sku: 'SKU-1' }, 'https://regalhoreca.com'),
      'https://regalhoreca.com/products/bowl'
    );
  });

  it('falls back to SKU when the row has no slug', () => {
    assert.equal(labelQrValue({ sku: 'SKU-1' }, 'https://regalhoreca.com'), 'SKU-1');
  });
});

describe('collectProductLabelItems', () => {
  it('prints the standalone product itself', () => {
    const items = collectProductLabelItems({ _id: 'a', title: 'Bowl', sku: 'B1', slug: 'bowl' });
    assert.equal(items.length, 1);
    assert.equal(items[0].sku, 'B1');
  });

  it('does not print a parent carrier with no variants', () => {
    const items = collectProductLabelItems(
      { _id: 'p', title: 'Bowl', productType: 'parent' },
      [],
      true
    );
    assert.equal(items.length, 0);
  });

  it('expands a parent into its children and inherits the parent slug', () => {
    const items = collectProductLabelItems(
      { _id: 'p', title: 'Bowl', slug: 'bowl', productType: 'parent' },
      [{ _id: 'c1', title: 'Bowl - Red', sku: 'B-R', variationAttributes: { color: 'Red' } }],
      true
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].slug, 'bowl');
    assert.equal(items[0].variantLine, 'Red');
  });
});

describe('getLabelSize', () => {
  it('defaults unknown ids to 60x40', () => {
    assert.equal(getLabelSize('nope').id, '60x40');
  });
});

describe('toProductLabelItem', () => {
  it('uses fallback title when the row has none', () => {
    const item = toProductLabelItem({ sku: 'X' }, { fallbackTitle: 'Parent name' });
    assert.equal(item.title, 'Parent name');
  });
});
