import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_EXHIBITION, MODEL_LIBRARY, normalizeExhibition } from '../src/exhibition/exhibitionData.js';

test('the exhibition prototype starts with one complete station and linked models', () => {
  const exhibition = normalizeExhibition(null);
  assert.equal(exhibition.stations.length, 1);
  assert.equal(exhibition.stations[0].thumbnails.length, 3);
  assert.ok(exhibition.stations[0].thumbnails.every((thumbnail) => (
    MODEL_LIBRARY.some((model) => model.id === thumbnail.modelId)
  )));
});

test('saved exhibition layouts are bounded and preserve additional stations', () => {
  const secondStation = {
    ...structuredClone(DEFAULT_EXHIBITION.stations[0]),
    id: 'station-two',
    thumbnails: [{ id: 'outside', modelId: 'unknown', x: 200, y: -20, width: 4 }]
  };
  const exhibition = normalizeExhibition({ stations: [DEFAULT_EXHIBITION.stations[0], secondStation] });
  assert.equal(exhibition.stations.length, 2);
  assert.equal(exhibition.stations[1].order, 2);
  assert.deepEqual(
    {
      modelId: exhibition.stations[1].thumbnails[0].modelId,
      x: exhibition.stations[1].thumbnails[0].x,
      y: exhibition.stations[1].thumbnails[0].y,
      width: exhibition.stations[1].thumbnails[0].width
    },
    { modelId: 'vessel', x: 88, y: 0, width: 16 }
  );
});

