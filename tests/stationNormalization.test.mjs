import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStations, prepareStationsForStorage } from '../src/stations.js';

test('incomplete explicit cameras become implicit and are omitted from storage', () => {
  const [normalized] = normalizeStations([{
    id: 'incomplete-camera',
    cameraExplicitlySet: true,
    cameraPos: { x: 1, y: 2 },
    cameraTarget: { x: 0, y: 1, z: 2 }
  }]);

  assert.equal(normalized.cameraExplicitlySet, false);
  assert.deepEqual(normalized.cameraPos, { x: 1, y: 2, z: 22 });

  const [stored] = prepareStationsForStorage([normalized]);
  assert.equal('cameraPos' in stored, false);
  assert.equal('cameraTarget' in stored, false);
});

test('station limits and nested media defaults remain stable', () => {
  const [normalized] = normalizeStations([{
    modelAnimationSpeed: 999,
    freeNavigationMaxDistance: 1,
    annotations: [{ images: ['one', '', 'two', 'three', 'four'] }],
    images: [{ url: 'cover', scale: 0 }]
  }]);

  assert.equal(normalized.modelAnimationSpeed, 200);
  assert.equal(normalized.freeNavigationMaxDistance, 2);
  assert.deepEqual(normalized.annotations[0].images, ['one', 'two', 'three']);
  assert.equal(normalized.images.length, 3);
  assert.deepEqual(normalized.images[0], {
    url: 'cover', posX: 0, posY: 3.5, posZ: 0, scale: 0, fixToCamera: false
  });
});

test('normalization does not mutate input or share generated defaults', () => {
  const source = [{
    id: 'one',
    cameraPos: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 4, y: 5, z: 6 },
    annotations: [{}, {}]
  }, { id: 'two', annotations: [{}] }];
  const snapshot = structuredClone(source);
  const normalized = normalizeStations(source);

  assert.deepEqual(source, snapshot);
  assert.notStrictEqual(normalized[0].cameraPos, normalized[1].cameraPos);
  assert.notStrictEqual(normalized[0].images[0], normalized[0].images[1]);
  assert.notStrictEqual(normalized[0].annotations[0].position, normalized[1].annotations[0].position);
  assert.notStrictEqual(normalized[0].annotations[0].cameraPos, source[0].cameraPos);
  assert.notStrictEqual(normalized[0].annotations[0].cameraPos, normalized[0].annotations[1].cameraPos);
  assert.deepEqual(normalized[0].annotations[0].cameraPos, source[0].cameraPos);
});

test('legacy station lighting keeps configured values and fills missing axes', () => {
  const [normalized] = normalizeStations([{
    lightIntensity: 0.75,
    shadowDiffuse: 0.25,
    lightHemiEnabled: false,
    lightKeyEnabled: false,
    lightKeyFixedToCamera: true,
    lightKeyPos: { x: -1, z: 4 },
    lightFillPos: { y: 7 },
    lightSpotPos: { x: 2, y: 3, z: 4 }
  }]);

  assert.deepEqual({
    lightIntensity: normalized.lightIntensity,
    shadowDiffuse: normalized.shadowDiffuse,
    lightHemiEnabled: normalized.lightHemiEnabled,
    lightKeyEnabled: normalized.lightKeyEnabled,
    lightKeyFixedToCamera: normalized.lightKeyFixedToCamera,
    lightKeyPos: normalized.lightKeyPos,
    lightFillPos: normalized.lightFillPos,
    lightSpotPos: normalized.lightSpotPos
  }, {
    lightIntensity: 0.75,
    shadowDiffuse: 0.25,
    lightHemiEnabled: false,
    lightKeyEnabled: false,
    lightKeyFixedToCamera: true,
    lightKeyPos: { x: -1, y: 16, z: 4 },
    lightFillPos: { x: -8, y: 7, z: -10 },
    lightSpotPos: { x: 2, y: 3, z: 4 }
  });
});
