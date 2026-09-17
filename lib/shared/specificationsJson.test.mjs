/**
 * Run: node --test lib/shared/specificationsJson.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { convertSpecsToJson, parseSpecificationsJson } from './specificationsJson.js';

describe('convertSpecsToJson', () => {
  it('serializes non-empty specs', () => {
    const json = convertSpecsToJson([
      { label: 'Material', value: 'SS', unit: '' },
      { label: 'Capacity', value: '1.5', unit: 'L' },
    ]);
    assert.equal(
      json,
      JSON.stringify(
        {
          specifications: [
            { label: 'Material', value: 'SS', unit: '' },
            { label: 'Capacity', value: '1.5', unit: 'L' },
          ],
        },
        null,
        2
      )
    );
  });

  it('drops fully empty rows', () => {
    const parsed = JSON.parse(convertSpecsToJson([{ label: '', value: '', unit: '' }]));
    assert.deepEqual(parsed.specifications, []);
  });
});

describe('parseSpecificationsJson', () => {
  it('accepts object format and applies specs', () => {
    const result = parseSpecificationsJson(`{
      "specifications": [
        { "label": "Material", "value": "Brass", "unit": "" }
      ]
    }`);
    assert.equal(result.ok, true);
    assert.deepEqual(result.specifications, [{ label: 'Material', value: 'Brass', unit: '' }]);
  });

  it('accepts legacy array format', () => {
    const result = parseSpecificationsJson(
      `[{ "label": "Size", "value": "10", "unit": "in" }]`
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.specifications, [{ label: 'Size', value: '10', unit: 'in' }]);
  });

  it('treats blank input as empty specs (apply clears)', () => {
    const result = parseSpecificationsJson('   ');
    assert.equal(result.ok, true);
    assert.deepEqual(result.specifications, []);
  });

  it('rejects invalid JSON', () => {
    const result = parseSpecificationsJson('{ specifications: [}');
    assert.equal(result.ok, false);
    assert.match(result.error, /Invalid JSON/);
  });

  it('rejects object without specifications key', () => {
    const result = parseSpecificationsJson('{"foo": []}');
    assert.equal(result.ok, false);
    assert.match(result.error, /specifications/);
  });

  it('rejects non-object items in the array', () => {
    const result = parseSpecificationsJson('{"specifications": ["bad"]}');
    assert.equal(result.ok, false);
    assert.match(result.error, /index 0/);
  });

  it('defaults missing fields to empty strings', () => {
    const result = parseSpecificationsJson('{"specifications": [{}]}');
    assert.equal(result.ok, true);
    assert.deepEqual(result.specifications, [{ label: '', value: '', unit: '' }]);
  });
});
