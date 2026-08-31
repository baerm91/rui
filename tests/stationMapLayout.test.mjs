import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationMapLayout, createStationMapGesture, projectStationTile, getStationPreviewCapacity, getStationMapMaxZoom } from '../src/utils/stationMapLayout.js';

test('projected station tiles remain inside the viewport and cover it without gaps during zoom and pan', () => {
  for (const [width, height] of [[360, 520], [1800, 700]]) {
    const tiles = createStationMapLayout(Array.from({ length: 18 }, (_, index) => ({ items: Array(index % 7).fill({}) })), width, height);
    for (const scale of [1, 1.5, 2.12, 4, 6]) {
      for (const direction of [-1, 0, 1]) {
        const view = { scale, x: direction * width * (1 - 1 / scale) / 2, y: -direction * height * (1 - 1 / scale) / 2 };
        const projected = tiles.map((tile) => projectStationTile(tile, width, height, view));
        assert.ok(Math.abs(projected.reduce((area, tile) => area + tile.width * tile.height, 0) - width * height) < .001);
        for (const tile of projected) {
          assert.ok(tile.x >= 0 && tile.y >= 0 && tile.width >= 0 && tile.height >= 0);
          assert.ok(tile.x + tile.width <= width + .001 && tile.y + tile.height <= height + .001);
        }
      }
    }
  }
  const tile = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(projectStationTile(tile, 400, 400), tile);
  assert.deepEqual(projectStationTile(tile, 400, 400, { scale: 2, x: 100, y: 100 }), { x: 0, y: 0, width: 200, height: 200 });
  const hidden = projectStationTile(tile, 400, 400, { scale: 2, x: -100, y: -100 });
  assert.equal(hidden.width * hidden.height, 0);
  const clipped = projectStationTile({ x: 50, y: 50, width: 200, height: 200 }, 400, 400, { scale: 2 });
  assert.deepEqual(clipped, { x: 0, y: 0, width: 300, height: 300 });
});

test('preview capacity follows visible space and never promises missing or unreadably small objects', () => {
  assert.equal(getStationPreviewCapacity(800, 600, 0), 0);
  assert.equal(getStationPreviewCapacity(99, 600, 6), 0);
  assert.equal(getStationPreviewCapacity(600, 99, 6), 0);
  assert.equal(getStationPreviewCapacity(100, 100, 6), 1);
  assert.equal(getStationPreviewCapacity(320, 410, 12), 4);
  assert.equal(getStationPreviewCapacity(1000, 800, 3), 3);
  assert.equal(getStationPreviewCapacity(1000, 800, 20), 6);
  for (let width = 100; width <= 1000; width += 20) {
    for (let height = 100; height <= 800; height += 20) {
      const count = getStationPreviewCapacity(width, height, 12);
      assert.ok(count <= getStationPreviewCapacity(width + 20, height, 12));
      assert.ok(count <= getStationPreviewCapacity(width, height + 20, 12));
    }
  }
});

test('small exhibitions have a useful zoom ceiling while dense maps allow closer inspection', () => {
  for (const [width, height] of [[360, 520], [1800, 700]]) {
    const layout = (count) => createStationMapLayout(Array.from({ length: count }, () => ({ items: [{}] })), width, height);
    const few = getStationMapMaxZoom(layout(3), width, height);
    const many = getStationMapMaxZoom(layout(60), width, height);
    assert.ok(few >= 1.5 && few < 3);
    assert.ok(many > few && many <= 6);
    assert.equal(getStationMapMaxZoom(layout(1000), width, height), 6);
  }
  assert.equal(getStationMapMaxZoom([], 0, 0), 1.5);
});

test('station map fills portrait and landscape surfaces without overlapping or losing stations', () => {
  for (const [width, height] of [[360, 520], [820, 300]]) {
    for (const counts of [[0], [1, 5, 15], Array.from({ length: 60 }, (_, index) => index % 13)]) {
      const stations = counts.map((count) => ({ items: Array(count).fill({}) }));
      const tiles = createStationMapLayout(stations, width, height);
      assert.equal(tiles.length, counts.length);
      assert.ok(Math.abs(tiles.reduce((area, tile) => area + tile.width * tile.height, 0) - width * height) < .001);
      tiles.forEach((tile, index) => {
        assert.equal(tile.index, index);
        assert.ok(tile.width > 0 && tile.height > 0);
        assert.ok(tile.x >= 0 && tile.y >= 0 && tile.x + tile.width <= width + .001 && tile.y + tile.height <= height + .001);
        for (const other of tiles.slice(index + 1)) {
          const overlapWidth = Math.min(tile.x + tile.width, other.x + other.width) - Math.max(tile.x, other.x);
          const overlapHeight = Math.min(tile.y + tile.height, other.y + other.height) - Math.max(tile.y, other.y);
          assert.ok(overlapWidth < .001 || overlapHeight < .001);
          if (counts[index] < counts[other.index]) assert.ok(tile.width * tile.height < other.width * other.height);
        }
      });
    }
  }
  assert.deepEqual(createStationMapLayout([], 360, 520), []);
});

test('station areas are proportional to model counts, not compressed logarithmically', () => {
  const counts = [2, 5, 12];
  for (const [width, height] of [[390, 520], [1280, 390], [1900, 700]]) {
    const tiles = createStationMapLayout(counts.map((count) => ({ items: Array(count).fill({}) })), width, height);
    tiles.forEach((tile, index) => {
      assert.ok(Math.abs(tile.width * tile.height / (width * height) - counts[index] / 19) < 1e-10);
    });
  }
});

test('three or more stations form a two-dimensional mosaic even on wide screens', () => {
  for (const counts of [[3, 1, 1], [1, 1, 1], [2, 5, 12], [1, 2, 3, 4, 5, 6]]) {
    for (const [width, height] of [[1200, 390], [1900, 300], [390, 600]]) {
      const tiles = createStationMapLayout(counts.map((count) => ({ items: Array(count).fill({}) })), width, height);
      assert.ok(new Set(tiles.map((tile) => tile.x)).size > 1, 'not a single column');
      assert.ok(new Set(tiles.map((tile) => tile.y)).size > 1, 'not a single row');
    }
  }
});

test('an already dominant station never shrinks or moves when zooming', () => {
  const stations = [20, 1, 1].map((count) => ({ items: Array(count).fill({}) }));
  const original = createStationMapLayout(stations, 1200, 600);
  assert.deepEqual(createStationMapLayout(stations, 1200, 600, { focusIndex: 0, progress: 1 }), original);
});

test('taps open stations, while drags, pinches and canceled touches never open them', () => {
  const gesture = createStationMapGesture();
  gesture.start(1, 10, 10);
  gesture.move(1, 12, 11);
  gesture.end(1);
  assert.equal(gesture.canOpen(), true);
  gesture.start(1, 10, 10);
  gesture.move(1, 40, 10);
  gesture.end(1);
  assert.equal(gesture.canOpen(), false);
  gesture.start(1, 10, 10);
  gesture.start(2, 40, 40);
  gesture.end(1);
  gesture.end(2);
  assert.equal(gesture.canOpen(), false);
  gesture.start(1, 10, 10);
  gesture.cancel();
  assert.equal(gesture.canOpen(), false);
  gesture.start(1, 10, 10);
  gesture.end(1);
  assert.equal(gesture.canOpen(), true);
});
