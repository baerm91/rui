import test from 'node:test';
import assert from 'node:assert/strict';
import heidentorConfig from '../heidentor-stations.json' with { type: 'json' };
import { normalizeStationConfig, prepareStationsForStorage } from '../src/stations.js';

test('legacy Heidentor story normalizes without manual station re-entry', () => {
  const normalized = normalizeStationConfig(heidentorConfig);
  assert.equal(normalized.stations.length, 4);
  assert.equal(normalized.stations[0].title, 'Alter Ego');
  assert.equal(normalized.stations[0].annotations.length, 1);
  assert.equal(normalized.stations[0].cameraExplicitlySet, true);
  assert.equal(normalized.alignment.reconstructionMatrix.length, 16);
});

test('legacy lighting is lifted out of serialized stations without losing narrative data', () => {
  const normalized = normalizeStationConfig(heidentorConfig);
  const stored = prepareStationsForStorage(normalized.stations);
  assert.equal(stored[0].title, normalized.stations[0].title);
  assert.equal(stored[0].description, normalized.stations[0].description);
  assert.equal('lightIntensity' in stored[0], false);
  assert.equal('annotations' in stored[0], false);
});
