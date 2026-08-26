import test from 'node:test';
import assert from 'node:assert/strict';
import { alignThumbnailSelection, createThumbnailLayout } from '../src/utils/spatialThumbnailLayout.js';

const items = [
  { id: 'a', thumbnailTransform: { position: [-2, 1, .08] } },
  { id: 'b', thumbnailTransform: { position: [0, -1, .08] } },
  { id: 'c', thumbnailTransform: { position: [3, .5, .08] } },
  { id: 'd', thumbnailTransform: { position: [1, 2, .08] } }
];

test('thumbnail presets arrange every item inside the station wall', () => {
  for (const preset of ['grid', 'brick', 'circle']) {
    const layout = createThumbnailLayout(items, preset);
    assert.deepEqual(Object.keys(layout), ['a', 'b', 'c', 'd']);
    Object.values(layout).forEach(([x, y, z]) => {
      assert.ok(x >= -3.25 && x <= 3.25);
      assert.ok(y >= -2.2 && y <= 2.2);
      assert.equal(z, .08);
    });
  }
});

test('selected thumbnails align and distribute without moving unselected items', () => {
  const aligned = alignThumbnailSelection(items, ['a', 'b', 'c'], 'top');
  assert.equal(aligned.a[1], 1);
  assert.equal(aligned.b[1], 1);
  assert.equal(aligned.c[1], 1);
  assert.equal(aligned.d, undefined);

  const distributed = alignThumbnailSelection(items, ['a', 'b', 'c'], 'distribute-horizontal');
  assert.deepEqual([distributed.a[0], distributed.b[0], distributed.c[0]], [-2, .5, 3]);
});

test('grid spacing changes the distance between tiles', () => {
  const compact = createThumbnailLayout(items, 'grid', 60);
  const spacious = createThumbnailLayout(items, 'grid', 140);
  assert.ok(Math.abs(compact.a[0] - compact.b[0]) < Math.abs(spacious.a[0] - spacious.b[0]));
  assert.ok(Math.abs(compact.a[1] - compact.c[1]) < Math.abs(spacious.a[1] - spacious.c[1]));
});
