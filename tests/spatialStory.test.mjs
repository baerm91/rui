import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialItem, getSpatialSourceType, moveSpatialItem, normalizeSpatialStation, normalizeThumbnailGridSpacing, normalizeThumbnailLayout, resolveSpatialInitialItemId, resolveSpatialOverviewCamera, resolveSpatialOverviewThumbnailLayout, resolveSpatialThumbnailUrl, resolveSpatialVisitorItemId } from '../src/utils/spatialStory.js';
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

test('custom thumbnails override the persistent Sketchfab provider fallback', () => {
  const item = createSpatialItem({
    modelUrl: 'https://sketchfab.com/models/0123456789abcdef0123456789abcdef',
    thumbnailUrl: 'https://example.org/custom.jpg',
    providerThumbnailUrl: 'https://media.sketchfab.com/default.jpg'
  });
  assert.equal(resolveSpatialThumbnailUrl(item), 'https://example.org/custom.jpg');
  assert.equal(resolveSpatialThumbnailUrl({ ...item, thumbnailUrl: '' }), 'https://media.sketchfab.com/default.jpg');
  assert.equal(item.providerThumbnailUrl, 'https://media.sketchfab.com/default.jpg');
});

test('station start model is explicit and visitors get a random fallback', () => {
  const items = [{ id: 'one' }, { id: 'two' }];
  assert.equal(resolveSpatialInitialItemId({ initialItemId: 'two', selectedItemId: 'one' }, items), 'two');
  assert.equal(resolveSpatialInitialItemId({ selectedItemId: 'two' }, items), null);
  assert.equal(resolveSpatialInitialItemId({ initialItemId: 'missing' }, items), null);
  assert.equal(resolveSpatialInitialItemId({}, []), null);
  assert.equal(resolveSpatialVisitorItemId({ initialItemId: 'two' }, items, 0), 'two');
  assert.equal(resolveSpatialVisitorItemId({}, items, 0), 'one');
  assert.equal(resolveSpatialVisitorItemId({}, items, .999), 'two');
  assert.equal(resolveSpatialVisitorItemId({}, [], .5), null);
});

test('carousel items can be reordered without changing their data', () => {
  const items = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.deepEqual(moveSpatialItem(items, 'two', -1).map((item) => item.id), ['two', 'one', 'three']);
  assert.deepEqual(moveSpatialItem(items, 'two', 1).map((item) => item.id), ['one', 'three', 'two']);
  assert.equal(moveSpatialItem(items, 'one', -1), items);
});

test('thumbnail layout defaults to tiles and accepts the explicit carousel mode', () => {
  assert.equal(normalizeThumbnailLayout(), 'tiles');
  assert.equal(normalizeThumbnailLayout('tiles'), 'tiles');
  assert.equal(normalizeThumbnailLayout('carousel'), 'carousel');
  assert.equal(normalizeThumbnailLayout('dock'), 'tiles');
});

test('thumbnail grid spacing is stored as a safe percentage', () => {
  assert.equal(normalizeThumbnailGridSpacing(), 100);
  assert.equal(normalizeThumbnailGridSpacing(45), 60);
  assert.equal(normalizeThumbnailGridSpacing(125.4), 125);
  assert.equal(normalizeThumbnailGridSpacing(180), 140);
});

test('overview thumbnail frames follow each image aspect ratio and remain centered', () => {
  const layout = resolveSpatialOverviewThumbnailLayout([1.8, .72, 1, 1.5]);
  assert.ok(layout[0].cardWidth > layout[0].cardHeight);
  assert.ok(layout[1].cardWidth < layout[1].cardHeight);
  assert.ok(Math.abs(layout[2].cardWidth - layout[2].cardHeight) < .001);
  assert.ok(layout[0].x < layout[1].x && layout[1].x < layout[2].x);
  assert.ok(layout[3].y < layout[0].y);
});

test('room overview camera frames the complete row of station walls', () => {
  const overview = resolveSpatialOverviewCamera([
    { spatial: { position: [0, 0, 0] } },
    { spatial: { position: [9, 0, 0] } },
    { spatial: { position: [18, 0, 0] } }
  ]);
  assert.deepEqual(overview.target, [9, 2.4, -5]);
  assert.equal(overview.position[0], 9);
  assert.ok(overview.position[1] >= 3.3 && overview.position[1] < 4);
  assert.ok(overview.position[2] >= 13 && overview.position[2] < 16);
  assert.ok(overview.fov > 50);
});

test('legacy stations receive complete spatial camera, light, and audio defaults', () => {
  const spatial = normalizeSpatialStation({ cameraPos: { x: 1, y: 2, z: 3 }, cameraTarget: { x: 0, y: 1, z: 0 } }, 2);
  assert.deepEqual(spatial.camera.position, [1, 2, 3]);
  assert.deepEqual(spatial.camera.target, [0, 1, 0]);
  assert.equal(spatial.position[0], 18);
  assert.equal(spatial.lighting.keyLightColor, '#f2dfc3');
  assert.equal(spatial.audio.autoplay, false);
  assert.deepEqual(spatial.wallBackground, { url: '', opacity: 0.72 });
});

test('legacy first room camera migrates to the same framing as later room stations', () => {
  const first = normalizeSpatialStation({
    spatial: {
      position: [0, 0, 0],
      camera: { position: [0, 5, 14], target: [0, 2.5, 0] }
    }
  }, 0, { migrateLegacyRoomCamera: true });
  assert.deepEqual(first.camera.position, [0, 1.7, 5]);
  assert.deepEqual(first.camera.target, [0, 1.5, 0]);

  const authored = normalizeSpatialStation({
    spatial: {
      position: [0, 0, 0],
      camera: { position: [0, 4.9, 14], target: [0, 2.5, 0] }
    }
  }, 0, { migrateLegacyRoomCamera: true });
  assert.deepEqual(authored.camera.position, [0, 4.9, 14]);
});

test('wall background images normalize legacy URLs and safe opacity', () => {
  const legacy = normalizeSpatialStation({ spatial: { wallBackgroundImage: ' https://example.org/mural.jpg ' } }, 0);
  const configured = normalizeSpatialStation({ spatial: { wallBackground: { url: 'data:image/png;base64,abc', opacity: 1.7 } } }, 0);
  assert.deepEqual(legacy.wallBackground, { url: 'https://example.org/mural.jpg', opacity: 0.72 });
  assert.deepEqual(configured.wallBackground, { url: 'data:image/png;base64,abc', opacity: 1 });
});

test('spatial station fields survive the existing RIU storage pipeline', () => {
  const thumbnailTransform = {
    position: [-1.237, 0.684, 0.08],
    rotation: [0, 0, 0.12],
    scale: 1.35
  };
  const source = {
    id: 'station-room',
    title: 'Raumstation',
    introduction: 'Ein räumlicher Auftakt.',
    spatial: normalizeSpatialStation({ spatial: { wallBackground: { url: 'https://example.org/wall.jpg', opacity: 0.55 } } }, 0),
    items: [createSpatialItem({ id: 'object-1', modelUrl: 'https://example.org/object.glb', title: 'Objekt', thumbnailTransform })],
    thumbnailLayout: 'carousel',
    thumbnailGridSpacing: 125,
    selectedItemId: 'object-1',
    initialItemId: 'object-1'
  };
  const [stored] = prepareStationsForStorage([source]);
  assert.equal(stored.introduction, source.introduction);
  assert.equal(stored.items[0].modelUrl, 'https://example.org/object.glb');
  assert.deepEqual(stored.items[0].thumbnailTransform, thumbnailTransform);
  assert.equal(stored.thumbnailLayout, 'carousel');
  assert.equal(stored.thumbnailGridSpacing, 125);
  assert.equal(stored.initialItemId, 'object-1');
  assert.deepEqual(stored.spatial.camera, source.spatial.camera);
  assert.deepEqual(stored.spatial.lighting, source.spatial.lighting);
  assert.deepEqual(stored.spatial.audio, source.spatial.audio);
  assert.deepEqual(stored.spatial.wallBackground, source.spatial.wallBackground);
});
