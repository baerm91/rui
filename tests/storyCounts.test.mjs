import assert from 'node:assert/strict';
import test from 'node:test';
import { getStoryAnnotationCount, getStoryCounts, getStoryModelCount } from '../src/platform/storyCounts.js';

test('counts connected models in a classic model story', () => {
  assert.equal(getStoryModelCount({
    models: {
      primary: 'https://example.com/base.glb',
      reconstruction: 'https://example.com/reconstruction.glb',
      additional: [{ id: 'detail', url: 'https://example.com/detail.glb' }]
    }
  }), 3);
});

test('ignores empty model placeholders', () => {
  assert.equal(getStoryModelCount({
    models: { additional: [{ id: 'empty', url: '' }] },
    stations: [{ items: [{ id: 'empty-item', modelUrl: '' }] }]
  }), 0);
});

test('counts unique station objects in room stories without duplicating reused sources', () => {
  assert.equal(getStoryModelCount({
    stations: [
      { items: [{ id: 'a', modelUrl: 'https://example.com/a.glb' }, { id: 'b', modelUrl: 'https://example.com/b.glb' }] },
      { items: [{ id: 'a-copy', modelUrl: 'https://example.com/a.glb' }] }
    ]
  }), 2);
});

test('counts a locally loaded primary model without a remote URL', () => {
  assert.equal(getStoryModelCount({ models: { primary: '', localModelName: 'Fundstück.glb' } }), 1);
});

test('returns the shared model, station, and deduplicated annotation facts', () => {
  const story = {
    models: { primary: 'https://example.com/model.glb' },
    annotations: [{ id: 'shared' }, { title: 'Ohne ID' }],
    stations: [
      { annotations: [{ id: 'shared' }, { id: 'station-only' }] },
      { annotations: [] }
    ]
  };
  assert.equal(getStoryAnnotationCount(story), 3);
  assert.deepEqual(getStoryCounts(story), { models: 1, stations: 2, annotations: 3 });
});
