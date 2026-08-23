import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCoverUvScale, resolveRelightPointer } from '../src/platform/storyRelightMath.js';

test('relight pointer is normalized and clamped to the image bounds', () => {
  assert.deepEqual(resolveRelightPointer(300, 250, 100, 100, 400, 300), { x: 0.5, y: 0.5 });
  assert.deepEqual(resolveRelightPointer(0, 700, 100, 100, 400, 300), { x: 0, y: 1 });
});

test('cover UV scale crops the image around its center', () => {
  assert.deepEqual(resolveCoverUvScale(1, 2), { x: 1, y: 0.5 });
  assert.deepEqual(resolveCoverUvScale(2, 1), { x: 0.5, y: 1 });
  assert.deepEqual(resolveCoverUvScale(0, 1), { x: 1, y: 1 });
});
