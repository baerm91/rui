import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStationConfig, prepareStationsForStorage } from '../src/stations.js';

const annotation = {
  id: 'point-a',
  title: 'Punkt A',
  position: { x: 0, y: 1, z: 2 }
};

test('legacy station visibility migrates to annotation station assignments', () => {
  const config = normalizeStationConfig({
    annotations: [annotation],
    stations: [
      { id: 'station-a', showAnnotations: true },
      { id: 'station-b', showAnnotations: false }
    ]
  });

  assert.deepEqual(config.annotations[0].visibleStationIds, ['station-a']);
});

test('explicit annotation visibility takes precedence over legacy station flags', () => {
  const config = normalizeStationConfig({
    annotations: [{ ...annotation, visibleStationIds: ['station-b'] }],
    stations: [
      { id: 'station-a', showAnnotations: true },
      { id: 'station-b', showAnnotations: false }
    ]
  });

  assert.deepEqual(config.annotations[0].visibleStationIds, ['station-b']);
});

test('station storage removes the retired annotation visibility field', () => {
  const [station] = prepareStationsForStorage([{ id: 'station-a', showAnnotations: false }]);
  assert.equal('showAnnotations' in station, false);
});
