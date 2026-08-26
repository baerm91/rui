import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialItem, getSpatialSourceType, normalizeSpatialStation } from '../src/utils/spatialStory.js';
import { prepareStationsForStorage } from '../src/stations.js';

test('spatial items preserve source metadata and transforms', () => {
  const item = createSpatialItem({
    id: 'fibel-001',
    title: 'Vogelfibel',
    modelUrl: 'https://example.org/fibel.glb',
    thumbnailUrl: 'https://example.org/fibel.jpg',
    thumbnailTransform: { position: [-1.2, 1.5, .05], scale: 1.4 },
    modelTransform: { position: [.8, 1.5, .5], rotation: [0, 1, 0], scale: .7 },
    attribution: 'Museum',
    license: 'CC BY 4.0'
  });
  assert.equal(item.sourceType, 'gltf');
  assert.deepEqual(item.thumbnailTransform.position, [-1.2, 1.5, .05]);
  assert.deepEqual(item.modelTransform.rotation, [0, 1, 0]);
  assert.equal(item.license, 'CC BY 4.0');
});

test('thumbnail defaults wrap into visible rows and repair legacy off-screen positions', () => {
  const fifthItem = createSpatialItem({ modelUrl: 'https://example.org/fifth.glb' }, 4);
  const repairedItem = createSpatialItem({
    modelUrl: 'https://example.org/legacy.glb',
    thumbnailTransform: { position: [5.2, 1.45, .08] }
  }, 4);

  assert.deepEqual(fifthItem.thumbnailTransform.position, [-3.2, -1.25, .08]);
  assert.deepEqual(repairedItem.thumbnailTransform.position, [-3.2, -1.25, .08]);
});

test('Sketchfab and direct glTF sources use separate adapter types', () => {
  assert.equal(getSpatialSourceType('https://sketchfab.com/3d-models/object-0123456789abcdef0123456789abcdef'), 'sketchfab');
  assert.equal(getSpatialSourceType('https://example.org/model.gltf'), 'gltf');
  assert.equal(getSpatialSourceType('https://example.org/model.obj'), 'unknown');
});

test('legacy stations receive complete spatial camera, light, and audio defaults', () => {
  const spatial = normalizeSpatialStation({ cameraPos: { x: 1, y: 2, z: 3 }, cameraTarget: { x: 0, y: 1, z: 0 } }, 2);
  assert.deepEqual(spatial.camera.position, [1, 2, 3]);
  assert.deepEqual(spatial.camera.target, [0, 1, 0]);
  assert.equal(spatial.position[0], 18);
  assert.equal(spatial.lighting.keyLightColor, '#f2dfc3');
  assert.equal(spatial.audio.autoplay, false);
});

test('spatial station fields survive the existing RIU storage pipeline', () => {
  const source = {
    id: 'station-room',
    title: 'Raumstation',
    introduction: 'Ein räumlicher Auftakt.',
    spatial: normalizeSpatialStation({}, 0),
    items: [createSpatialItem({ id: 'object-1', modelUrl: 'https://example.org/object.glb', title: 'Objekt' })],
    selectedItemId: 'object-1'
  };
  const [stored] = prepareStationsForStorage([source]);
  assert.equal(stored.introduction, source.introduction);
  assert.equal(stored.items[0].modelUrl, 'https://example.org/object.glb');
  assert.deepEqual(stored.spatial.camera, source.spatial.camera);
  assert.deepEqual(stored.spatial.lighting, source.spatial.lighting);
  assert.deepEqual(stored.spatial.audio, source.spatial.audio);
});
