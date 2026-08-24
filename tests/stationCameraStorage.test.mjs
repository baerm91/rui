import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStationConfig, serializeStationConfig } from '../src/stations.js';

test('explicit station camera survives the complete storage roundtrip', () => {
  const source = {
    id: 'station-camera',
    viewMode: 'ruin',
    cameraPos: { x: 1.25, y: -2.5, z: 3.75 },
    cameraTarget: { x: 4.5, y: 5.25, z: -6.75 },
    cameraExplicitlySet: true
  };

  const serialized = JSON.parse(JSON.stringify(serializeStationConfig([source], null)));
  const restored = normalizeStationConfig(serialized).stations[0];

  assert.deepEqual(restored.cameraPos, source.cameraPos);
  assert.deepEqual(restored.cameraTarget, source.cameraTarget);
  assert.equal(restored.cameraExplicitlySet, true);
});
