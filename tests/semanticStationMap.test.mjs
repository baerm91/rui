import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationMapLayout, getSemanticPreviewCount } from '../src/utils/stationMapLayout.js';

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

test('without measured tile space, one preview is shown and zoom reveals the rest', () => {
  for (const count of [0, 1, 2, 6, 32]) {
    assert.equal(getSemanticPreviewCount(count, 0), Math.min(1, count));
    let previous = 0;
    for (let step = 0; step <= 100; step++) {
      const current = getSemanticPreviewCount(count, step / 100);
      assert.ok(current >= previous && current <= count);
      previous = current;
    }
    assert.equal(previous, count);
  }
});

test('overview preview density follows tile space and remains capped at four objects', () => {
  assert.equal(getSemanticPreviewCount(12, 0, { width: 180, height: 160 }), 1);
  assert.equal(getSemanticPreviewCount(12, 0, { width: 330, height: 230 }), 2);
  assert.equal(getSemanticPreviewCount(12, 0, { width: 480, height: 230 }), 3);
  assert.equal(getSemanticPreviewCount(12, 0, { width: 500, height: 420 }), 4);
  assert.equal(getSemanticPreviewCount(12, 0, { width: 1200, height: 140 }), 1);
  assert.equal(getSemanticPreviewCount(12, 0, { width: 100, height: 900 }), 1);
  assert.equal(getSemanticPreviewCount(2, 0, { width: 1000, height: 700 }), 2);
  assert.equal(getSemanticPreviewCount(0, 0, { width: 1000, height: 700 }), 0);
  for (const size of [{ width: 180, height: 160 }, { width: 330, height: 230 }, { width: 500, height: 420 }]) {
    let previous = 0;
    for (let step = 0; step <= 100; step++) {
      const count = getSemanticPreviewCount(12, step / 100, size);
      assert.ok(count >= previous && count <= 12);
      previous = count;
    }
    assert.equal(previous, 12);
  }
});
