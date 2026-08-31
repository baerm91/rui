import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageMosaicLayout } from '../src/utils/stationMapLayout.js';

test('image mosaic fills justified rows without overlaps, gaps or missing images', () => {
  for (const [width, height] of [[320, 600], [1200, 700], [900, 300]]) {
    for (const count of [1, 2, 3, 5, 17, 60]) {
      const ratios = Array.from({ length: count }, (_, index) => [.65, 1.5, 1, 2, .75][index % 5]);
      const tiles = createImageMosaicLayout(ratios, width, height);
      assert.deepEqual(tiles.map((tile) => tile.index), ratios.map((_, index) => index));
      assert.ok(Math.abs(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0) - width * height) < .001);
      for (let index = 0; index < tiles.length; index++) {
        const tile = tiles[index];
        assert.ok(tile.width > 0 && tile.height > 0);
        assert.ok(tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= width + .001 && tile.y + tile.height <= height + .001);
        for (const other of tiles.slice(index + 1)) {
          const overlapX = Math.min(tile.x + tile.width, other.x + other.width) - Math.max(tile.x, other.x);
          const overlapY = Math.min(tile.y + tile.height, other.y + other.height) - Math.max(tile.y, other.y);
          assert.ok(overlapX < .001 || overlapY < .001);
          if (Math.abs(tile.y - other.y) < .001) {
            assert.ok(Math.abs(tile.height - other.height) < .001);
            assert.ok(Math.abs(tile.width / other.width - ratios[index] / ratios[other.index]) < .001);
          }
        }
      }
    }
  }
  assert.deepEqual(createImageMosaicLayout([], 100, 100), []);
  assert.deepEqual(createImageMosaicLayout([1], 0, 100), []);
  assert.ok(createImageMosaicLayout([NaN, 0, -1], 300, 100).every((tile) => Number.isFinite(tile.width)));
});
