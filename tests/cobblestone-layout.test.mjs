import test from 'node:test';
import assert from 'node:assert/strict';
import { createCobblestoneLayout } from '../src/utils/cobblestoneLayout.js';

for (const [width, columns] of [[1320, 5], [800, 3], [366, 2]]) {
  test(`cobblestone overview limits row density to ${columns} at ${width}px and keeps all objects scrollable`, () => {
    const stations = [5, 8, 7, 5, 0].map((count) => ({ items: Array.from({ length: count }, (_, id) => ({ id })) }));
    const tiles = createCobblestoneLayout(stations, width);
    assert.equal(tiles.length, 26);
    for (const index of [0, 3]) {
      const rows = new Set(tiles.filter((tile) => tile.stationIndex === index).map((tile) => tile.y));
      assert.ok(rows.size >= 2 && rows.size <= 3);
    }
    const rowCounts = new Map();
    tiles.forEach((tile, index) => {
      rowCounts.set(tile.y, (rowCounts.get(tile.y) || 0) + 1);
      assert.ok(tile.width > 0 && tile.height > 0);
      assert.ok(tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= width);
      for (const other of tiles.slice(index + 1)) {
        assert.ok(tile.x + tile.width <= other.x || other.x + other.width <= tile.x || tile.y + tile.height <= other.y || other.y + other.height <= tile.y);
      }
    });
    assert.equal(Math.max(...rowCounts.values()), columns);
  });
}
test('empty or unmeasured cobblestone overview has no tiles', () => {
  assert.deepEqual(createCobblestoneLayout([], 1000), []);
  assert.deepEqual(createCobblestoneLayout([{ items: [] }], 0), []);
});

test('rows fill the right edge and tiles match original image proportions', () => {
  const stations = [{ items: Array.from({ length: 7 }, (_, id) => ({ id })) }];
  const ratios = { '0:0': 16/9, '0:1': 1, '0:2': .75, '0:3': 2, '0:4': 1.5, '0:5': 16/9, '0:6': 1 };
  const tiles = createCobblestoneLayout(stations, 1320, ratios);
  const rowEnds = new Map();
  for (const tile of tiles) {
    assert.ok(Math.abs(tile.width / tile.height - ratios[`0:${tile.itemIndex}`]) < .00001);
    rowEnds.set(tile.y, Math.max(rowEnds.get(tile.y) || 0, tile.x + tile.width));
  }
  for (const right of rowEnds.values()) assert.ok(Math.abs(right - 1308) < .00001);
});
