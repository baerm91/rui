import assert from 'node:assert/strict';
import test from 'node:test';
import { getModelFormat } from '../src/models.js';
import { isValidModelUrl } from '../src/platform/platformStore.js';

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
