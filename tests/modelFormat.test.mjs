import assert from 'node:assert/strict';
import test from 'node:test';
import { getModelFormat } from '../src/models.js';
import { isValidModelUrl } from '../src/platform/platformStore.js';
import {
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

test('rejects Sketchfab profile, collection and malformed model URLs', () => {
  assert.equal(isValidModelUrl('https://sketchfab.com/landessammlungen-noe'), false);
  assert.equal(isValidModelUrl('https://sketchfab.com/collections/museum'), false);
  assert.equal(isValidModelUrl('https://sketchfab.example/models/0123456789abcdef0123456789abcdef'), false);
  assert.equal(isValidModelUrl('https://sketchfab.com/models/not-a-model-id'), false);
});
