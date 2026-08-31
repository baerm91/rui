import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationMapLayout, createStationPreviewLayout } from '../src/utils/stationMapLayout.js';

test('semantic zoom grows the selected station and shrinks every neighbour without losing the overview', () => {
  for (const [width, height] of [[360, 580], [1400, 650]]) {
    for (const count of [3, 18, 60]) {
      const stations = Array.from({ length: count }, (_, index) => ({ items: Array(index % 8).fill({}) }));
      for (const focusIndex of [0, Math.floor(count / 2), count - 1]) {
        let previous = createStationMapLayout(stations, width, height);
        const original = previous;
        for (let step = 1; step <= 20; step++) {
          const tiles = createStationMapLayout(stations, width, height, { focusIndex, progress: step / 20 });
          assert.ok(Math.abs(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0) - width * height) < .001);
          for (let index = 0; index < count; index++) {
            const tile = tiles[index];
            const area = tile.width * tile.height;
            const oldArea = previous[index].width * previous[index].height;
            assert.ok(index === focusIndex ? area > oldArea : area < oldArea);
            assert.ok(tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= width + .001 && tile.y + tile.height <= height + .001);
            for (const other of tiles.slice(index + 1)) {
              assert.ok(Math.min(tile.x + tile.width, other.x + other.width) - Math.max(tile.x, other.x) < .001 || Math.min(tile.y + tile.height, other.y + other.height) - Math.max(tile.y, other.y) < .001);
            }
          }
          previous = tiles;
        }
        assert.ok(Math.abs(previous[focusIndex].width * previous[focusIndex].height / (width * height) - .78) < .001);
        assert.deepEqual(createStationMapLayout(stations, width, height, { focusIndex, progress: 0 }), original);
      }
    }
  }
});

test('all previews are present even in small station tiles', () => {
  for (const count of [0, 1, 2, 6, 32]) {
    for (const [width, height] of [[180, 160], [1200, 140], [100, 900], [300, 60]]) {
      const preview = createStationPreviewLayout(Array(count).fill(1), width, height);
      assert.equal(preview.images.length, count);
      assert.ok(preview.images.every((image) => image.width > 0 && image.height > 0));
    }
  }
});

test('station zoom preserves every object in both the selected station and its shrinking neighbours', () => {
  const counts = [0, 1, 3, 6, 12];
  const stations = counts.map((count) => ({ items: Array(count).fill({}) }));
  for (const [width, height] of [[390, 700], [1200, 650]]) {
    for (const progress of [0, .5, 1]) {
      const tiles = createStationMapLayout(stations, width, height, { focusIndex: 3, progress });
      tiles.forEach((tile, index) => {
        const preview = createStationPreviewLayout(Array(counts[index]).fill(1), tile.width, tile.height);
        assert.equal(preview.images.length, counts[index]);
      });
    }
  }
});
