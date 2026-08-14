import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HEIDENTOR_LIGHTING_REVISION,
  HEIDENTOR_STABLE_LIGHTING,
  resolveProjectLightingSource
} from '../src/projects/projectLightingPresets.js';

test('legacy Heidentor lighting migrates to a camera-relative project rig', () => {
  const migrated = resolveProjectLightingSource('demo-heidentor', {
    lightIntensity: 0.9,
    lightKeyFixedToCamera: false,
    lightFillFixedToCamera: false
  });
  assert.equal(migrated.lightKeyFixedToCamera, true);
  assert.equal(migrated.lightFillFixedToCamera, true);
  assert.equal(migrated.stationConsistencyRevision, HEIDENTOR_LIGHTING_REVISION);
});

test('edited Heidentor lighting is preserved after the migration', () => {
  const edited = {
    ...HEIDENTOR_STABLE_LIGHTING,
    lightIntensity: 1.3
  };
  assert.equal(resolveProjectLightingSource('demo-heidentor', edited), edited);
});

test('other project lighting remains unchanged', () => {
  const lighting = { lightIntensity: 0.7 };
  assert.equal(resolveProjectLightingSource('demo-starhemberg', lighting), lighting);
});
