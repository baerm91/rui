import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationMapLayout, createStationMapGesture, getStationMapDetail } from '../src/utils/stationMapLayout.js';

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

test('details fade continuously before more previews become visible', () => {
  assert.equal(getStationMapDetail(1).previewCount, 0);
  assert.equal(getStationMapDetail(1).titleOpacity, 0);
  assert.ok(getStationMapDetail(1.4).titleOpacity > 0 && getStationMapDetail(1.4).titleOpacity < 1);
  assert.equal(getStationMapDetail(1.9).titleOpacity, 1);
  assert.equal(getStationMapDetail(2.3).previewCount, 1);
  assert.equal(getStationMapDetail(3.1).previewCount, 2);
  assert.equal(getStationMapDetail(8).previewCount, 6);
  let previous = getStationMapDetail(1);
  for (let scale = 1.01; scale <= 8; scale += .01) {
    const current = getStationMapDetail(scale);
    assert.ok(current.previewCount >= previous.previewCount);
    for (let index = 0; index < 6; index++) {
      const difference = current.previewOpacities[index] - previous.previewOpacities[index];
      assert.ok(difference >= 0 && difference < .018);
    }
    previous = current;
  }
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
