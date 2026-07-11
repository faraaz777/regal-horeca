/**
 * Run: node scripts/test-locator-layout-utils.mjs
 */
import assert from 'node:assert/strict';
import {
  normaliseRect,
  clampRectToCanvas,
  rectCentre,
  pointInRect,
  findContainingZoneId,
} from '../lib/shared/canvasCoordinates.js';
import {
  DEFAULT_COORDINATE_WIDTH,
  DEFAULT_COORDINATE_HEIGHT,
} from '../lib/shared/floorLayoutConstants.js';

const W = DEFAULT_COORDINATE_WIDTH;
const H = DEFAULT_COORDINATE_HEIGHT;

// normaliseRect
const n = normaliseRect({ x: 120, y: 80, width: 240, height: 160 }, W, H);
assert.equal(n.xRatio, 120 / W);
assert.equal(n.yRatio, 80 / H);

// clampRectToCanvas
const clamped = clampRectToCanvas({ x: -10, y: 0, width: 100, height: 100 }, W, H);
assert.equal(clamped.x, 0);

// rectCentre + pointInRect
const centre = rectCentre({ x: 0, y: 0, width: 200, height: 100 });
assert.deepEqual(centre, { x: 100, y: 50 });
assert.equal(pointInRect(centre, { x: 0, y: 0, width: 200, height: 100 }), true);
assert.equal(pointInRect({ x: 300, y: 300 }, { x: 0, y: 0, width: 200, height: 100 }), false);

// findContainingZoneId — higher zIndex wins
const zones = [
  { id: 'a', x: 0, y: 0, width: 500, height: 500, zIndex: 1, hidden: false },
  { id: 'b', x: 100, y: 100, width: 200, height: 200, zIndex: 2, hidden: false },
];
assert.equal(findContainingZoneId({ x: 150, y: 150 }, zones), 'b');

console.log('locator layout utils: all tests passed');
