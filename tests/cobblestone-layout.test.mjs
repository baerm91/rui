import test from 'node:test';
import assert from 'node:assert/strict';
import { createCobblestoneLayout } from '../src/utils/cobblestoneLayout.js';

for (const [width, columns] of [[1320, 5], [1000, 3], [800, 3], [366, 2]]) {
  test(`cobblestone overview limits row density to ${columns} at ${width}px and keeps all objects scrollable`, () => {
    const stations = [5, 8, 7, 5, 0].map((count) => ({ items: Array.from({ length: count }, (_, id) => ({ id })) }));
    const tiles = createCobblestoneLayout(stations, width);
    assert.equal(tiles.length, 26);
    for (const index of [0]) {
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
    const counts = [...rowCounts.entries()].sort(([a], [b]) => a - b).map(([, count]) => count);
    assert.ok(counts.slice(0, -1).every(count => count === columns));
    assert.equal(counts.at(-1), tiles.length % columns || columns);
  });
}
test('empty or unmeasured cobblestone overview has no tiles', () => {
  assert.deepEqual(createCobblestoneLayout([], 1000), []);
  assert.deepEqual(createCobblestoneLayout([{ items: [] }], 0), []);
});

test('all stones remain identical across full and incomplete rows', () => {
  for (const width of [1320, 800, 366]) {
    const stations = [5, 8, 7, 3].map(count => ({ items: Array.from({ length: count }, (_, id) => ({ id })) }));
    const tiles = createCobblestoneLayout(stations, width);
    assert.equal(new Set(tiles.map(tile => tile.width)).size, 1);
    assert.equal(new Set(tiles.map(tile => tile.height)).size, 1);
    assert.ok(Math.abs(tiles[0].width / tiles[0].height - 16/9) < .00001);
  }
});
