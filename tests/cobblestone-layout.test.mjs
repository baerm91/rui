import test from 'node:test';
import assert from 'node:assert/strict';
import { createCobblestoneLayout } from '../src/utils/cobblestoneLayout.js';

for (const [width, height] of [[1320, 640], [366, 470], [1000, 160]]) {
  test(`cobblestone topics keep all models in bounds without overlap at ${width}x${height}`, () => {
    const stations = [5, 10, 7, 6, 0].map((count) => ({ items: Array.from({ length: count }, (_, id) => ({ id })) }));
    const tiles = createCobblestoneLayout(stations, width, height);
    assert.equal(tiles.length, 29);
    const rows = new Set(tiles.filter((tile) => tile.stationIndex === 0).map((tile) => tile.y));
    assert.ok(rows.size >= 2 && rows.size <= 3);
    tiles.forEach((tile, index) => {
      assert.ok(tile.width > 0 && tile.height > 0);
      assert.ok(tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= width && tile.y + tile.height <= height);
      for (const other of tiles.slice(index + 1)) {
        assert.ok(tile.x + tile.width <= other.x || other.x + other.width <= tile.x || tile.y + tile.height <= other.y || other.y + other.height <= tile.y);
      }
    });
  });
}
test('empty or unmeasured cobblestone overview has no tiles', () => {
  assert.deepEqual(createCobblestoneLayout([], 1000, 600), []);
  assert.deepEqual(createCobblestoneLayout([{ items: [] }], 0, 0), []);
});
