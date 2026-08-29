import assert from 'node:assert/strict';
import test from 'node:test';
import { getModelFormat } from '../src/models.js';
import { createStory, isValidModelUrl } from '../src/platform/platformStore.js';
import {
  extractModelUrl,
  getSketchfabEmbedUrl,
  getSketchfabModelUid,
  normalizeModelUrl
} from '../src/utils/modelSource.js';

test('detects supported model formats with URL parameters', () => {
  assert.equal(getModelFormat('https://example.org/model.FBX?version=2'), 'fbx');
  assert.equal(getModelFormat('https://example.org/model.glb#asset'), 'gltf');
  assert.equal(getModelFormat('https://example.org/scene.gltf'), 'gltf');
});

test('accepts HTTP(S) URLs for FBX, GLB and glTF models', () => {
  assert.equal(isValidModelUrl('https://example.org/model.fbx'), true);
  assert.equal(isValidModelUrl('http://localhost/model.FBX?cache=1'), true);
  assert.equal(isValidModelUrl('https://example.org/model.glb'), true);
  assert.equal(isValidModelUrl('https://example.org/model.gltf'), true);
});

test('rejects unsupported model URLs and unsafe protocols', () => {
  assert.equal(isValidModelUrl('https://example.org/model.obj'), false);
  assert.equal(isValidModelUrl('file:///model.fbx'), false);
  assert.equal(isValidModelUrl('not-a-url.fbx'), false);
});

test('accepts copied Sketchfab model-page and embed URLs', () => {
  const uid = '0123456789abcdef0123456789abcdef';
  const pageUrl = `https://sketchfab.com/3d-models/ein-modell-${uid}`;
  const embedUrl = `https://sketchfab.com/models/${uid}/embed`;

  assert.equal(isValidModelUrl(pageUrl), true);
  assert.equal(isValidModelUrl(embedUrl), true);
  assert.equal(getSketchfabModelUid(pageUrl), uid);
  assert.equal(normalizeModelUrl(pageUrl), `https://sketchfab.com/models/${uid}`);
  assert.match(getSketchfabEmbedUrl(pageUrl), new RegExp(`^https://sketchfab\\.com/models/${uid}/embed\\?`));
});

test('accepts official Sketchfab alphanumeric viewer UIDs', () => {
  const uid = '7w7pAfrCfjovwykkEeRFLGw5SXS';
  assert.equal(getSketchfabModelUid(`https://sketchfab.com/models/${uid}`), uid.toLowerCase());
  assert.equal(isValidModelUrl(`https://sketchfab.com/models/${uid}/embed`), true);
});

test('extracts Sketchfab model pages from copied share text and embed code', () => {
  const uid = 'ac98adfce999446393ef3bf9dbdbafe6';
  const pageUrl = `https://sketchfab.com/3d-models/test-gltf-${uid}`;
  assert.equal(extractModelUrl(`Test Gltf by gnaz on Sketchfab: ${pageUrl}`), pageUrl);
  assert.equal(extractModelUrl(`<iframe src="https://sketchfab.com/models/${uid}/embed"></iframe>`), `https://sketchfab.com/models/${uid}/embed`);
});

test('extracts the Dog and Hare Sketchfab URL from Markdown clipboard content', () => {
  const pageUrl = 'https://sketchfab.com/3d-models/dog-and-hare-brooch-d5c7f71f3f6a4ae8b7eb6137bda4c0de';
  assert.equal(extractModelUrl(`[${pageUrl}](${pageUrl})`), pageUrl);
  assert.equal(normalizeModelUrl(extractModelUrl(`[${pageUrl}](${pageUrl})`)), 'https://sketchfab.com/models/d5c7f71f3f6a4ae8b7eb6137bda4c0de');
});

test('rejects Sketchfab profile, collection and malformed model URLs', () => {
  assert.equal(isValidModelUrl('https://sketchfab.com/landessammlungen-noe'), false);
  assert.equal(isValidModelUrl('https://sketchfab.com/collections/museum'), false);
  assert.equal(isValidModelUrl('https://sketchfab.example/models/0123456789abcdef0123456789abcdef'), false);
  assert.equal(isValidModelUrl('https://sketchfab.com/models/not-a-model-id'), false);
});

test('creates a room story when no model URL is supplied', () => {
  const story = createStory({
    ownerId: 'owner-1',
    authorName: 'Test',
    name: 'Raumgeschichte',
    description: 'Eine Ausstellung ohne Startmodell.',
    modelUrl: '',
    categories: ['Kunst']
  });
  assert.equal(story.models.primary, '');
  assert.equal(story.settings.experienceType, 'room');
  assert.deepEqual(story.stations[0].cameraPos, { x: 0, y: 1.7, z: 5 });
  assert.deepEqual(story.stations[0].cameraTarget, { x: 0, y: 1.5, z: 0 });
  assert.equal(story.stations[0].spatial.surfaceMaterials.wall.materialId, 'beige-wall-002');
  assert.equal(story.stations[0].spatial.surfaceMaterials.floor.materialId, 'travertine-001');
  assert.equal(story.stations[0].spatial.surfaceMaterials.plinth.materialId, 'warm-white');
});

test('keeps model stories on the existing viewer workflow', () => {
  const story = createStory({
    ownerId: 'owner-1',
    authorName: 'Test',
    name: 'Modellgeschichte',
    description: 'Eine Ausstellung mit Startmodell.',
    modelUrl: 'https://example.org/object.glb',
    categories: ['Kunst']
  });
  assert.equal(story.models.primary, 'https://example.org/object.glb');
  assert.equal(story.settings.experienceType, 'model');
  assert.deepEqual(story.stations[0].cameraPos, { x: 0, y: 5, z: 14 });
  assert.deepEqual(story.stations[0].cameraTarget, { x: 0, y: 2.5, z: 0 });
});
