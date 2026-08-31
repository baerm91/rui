import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStationMapZoom, createImageMosaicLayout, expandImageMosaic, createStationMapZoomTarget, createStationMapLayout, createStationPreviewLayout } from '../src/utils/stationMapLayout.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('a stationary pointer keeps its object even when another tile moves underneath it', () => {
  const target = createStationMapZoomTarget();
  assert.deepEqual(target.resolve({ x: 100, y: 150, stationIndex: 2, imageIndex: 5 }), { stationIndex: 2, imageIndex: 5 });
  assert.deepEqual(target.resolve({ x: 100, y: 150, stationIndex: 0, imageIndex: 1 }), { stationIndex: 2, imageIndex: 5 });
  assert.deepEqual(target.resolve({ x: 103, y: 152, stationIndex: 0, imageIndex: 1 }), { stationIndex: 2, imageIndex: 5 });
  assert.deepEqual(target.resolve({ x: 112, y: 150, stationIndex: 0, imageIndex: 1 }), { stationIndex: 0, imageIndex: 1 });
  target.reset();
  assert.deepEqual(target.resolve({ x: 112, y: 150, stationIndex: 1, imageIndex: 3 }), { stationIndex: 1, imageIndex: 3 });
});

test('the chosen object is remembered throughout station zoom and into image zoom', () => {
  let view = { focusIndex: 0, progress: 0, imageFocusIndex: 0, imageProgress: 0 };
  for (let step = 0; step < 8; step++) {
    view = advanceStationMapZoom(view, .2, { stationIndex: 1, imageIndex: 4 });
    assert.equal(view.focusIndex, 1);
    assert.equal(view.imageFocusIndex, 4);
  }
  near(view.progress, 1);
  near(view.imageProgress, .6);
});

test('objects keep their overview rows and relative positions throughout station zoom', () => {
  const stations = [3, 12, 5, 8].map((count) => ({ items: Array(count).fill({}) }));
  for (const [width, height] of [[390, 650], [1400, 700]]) {
    const baseTiles = createStationMapLayout(stations, width, height);
    for (let step = 0; step <= 10; step++) {
      const tiles = createStationMapLayout(stations, width, height, { focusIndex: 1, progress: step / 10 });
      tiles.forEach((tile, index) => {
        const ratios = stations[index].items.map((_, i) => [.5, 1, 2][i % 3]);
        const base = createStationPreviewLayout(ratios, baseTiles[index].width, baseTiles[index].height);
        const preview = createStationPreviewLayout(ratios, tile.width, tile.height, {}, baseTiles[index]);
        assert.equal(preview.images.length, ratios.length);
        preview.images.forEach((image, i) => {
          near(image.x / preview.imageWidth, base.images[i].x / base.imageWidth);
          near(image.y / preview.imageHeight, base.images[i].y / base.imageHeight);
          near(image.width / preview.imageWidth, base.images[i].width / base.imageWidth);
          near(image.height / preview.imageHeight, base.images[i].height / base.imageHeight);
        });
      });
    }
  }
});

test('zoom enters the image only after the station is maximized and unwinds in reverse order', () => {
  let view = { focusIndex: 0, progress: .9, imageFocusIndex: 0, imageProgress: 0 };
  view = advanceStationMapZoom(view, .3, { imageIndex: 2 });
  near(view.progress, 1);
  near(view.imageProgress, .2);
  assert.equal(view.imageFocusIndex, 2);
  view = advanceStationMapZoom(view, -.1);
  near(view.progress, 1);
  near(view.imageProgress, .1);
  view = advanceStationMapZoom(view, -.3);
  near(view.progress, .8);
  near(view.imageProgress, 0);
  view = advanceStationMapZoom(view, -10);
  near(view.progress, 0);
  near(view.imageProgress, 0);
});

test('naturally dominant stations can enter image zoom without redundant station zoom', () => {
  const view = advanceStationMapZoom({ focusIndex: 0, progress: 0 }, .2, { stationAtMaximum: true, imageIndex: 1 });
  assert.equal(view.progress, 1);
  assert.equal(view.imageProgress, .2);
  assert.equal(view.imageFocusIndex, 1);
  const single = advanceStationMapZoom({ focusIndex: 0, progress: 1 }, .2, { canZoomImages: false });
  assert.equal(single.imageProgress, 0);
});

test('retargeting resets image emphasis without carrying it to another station', () => {
  const view = { focusIndex: 0, progress: 1, imageFocusIndex: 0, imageProgress: .8 };
  const image = advanceStationMapZoom(view, .2, { imageIndex: 2 });
  assert.equal(image.progress, 1);
  assert.equal(image.imageProgress, .2);
  assert.equal(image.imageFocusIndex, 2);
  const station = advanceStationMapZoom(view, .2, { stationIndex: 1 });
  assert.equal(station.focusIndex, 1);
  assert.equal(station.progress, .2);
  assert.equal(station.imageProgress, 0);
});

test('focused image grows while every sibling shrinks, with unchanged rows and no overlaps', () => {
  for (const [width, height] of [[700, 450], [340, 600]]) {
    const initial = createImageMosaicLayout([.5, 1, 2, .7, 1.5], width, height);
    for (const focusIndex of [0, 2, 4]) {
      let previous = initial;
      for (let step = 1; step <= 10; step++) {
        const images = expandImageMosaic(initial, width, height, focusIndex, step / 10);
        near(images.reduce((sum, image) => sum + image.width * image.height, 0), width * height);
        images.forEach((image, index) => {
          assert.equal(image.index, initial[index].index);
          const oldArea = previous[index].width * previous[index].height;
          const area = image.width * image.height;
          assert.ok(index === focusIndex ? area > oldArea : area < oldArea);
          assert.ok(image.x >= 0 && image.y >= 0 && image.x + image.width <= width + .001 && image.y + image.height <= height + .001);
          for (const other of images.slice(index + 1)) {
            assert.ok(Math.min(image.x + image.width, other.x + other.width) - Math.max(image.x, other.x) < .001 || Math.min(image.y + image.height, other.y + other.height) - Math.max(image.y, other.y) < .001);
          }
        });
        previous = images;
      }
      near(previous[focusIndex].width * previous[focusIndex].height / (width * height), .82);
      assert.deepEqual(expandImageMosaic(initial, width, height, focusIndex, 0), initial);
    }
    assert.deepEqual(expandImageMosaic(initial, width, height, 100, 1), initial);
  }
});
