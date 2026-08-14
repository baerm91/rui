import assert from 'node:assert/strict';
import test from 'node:test';
import { horizontalFovToVertical, normalizeProjectCameraFov } from '../src/projects/projectSettings.js';

test('camera field of view migrates the former vertical default to a natural horizontal default', () => {
  assert.equal(normalizeProjectCameraFov(undefined), 75);
  assert.equal(normalizeProjectCameraFov(45), 75);
});

test('camera field of view supports ultra-wide projects within safe limits', () => {
  assert.equal(normalizeProjectCameraFov(120), 120);
  assert.equal(normalizeProjectCameraFov(160), 160);
  assert.equal(normalizeProjectCameraFov(200), 160);
  assert.equal(normalizeProjectCameraFov(10), 60);
});

test('horizontal field of view is converted to the camera vertical projection', () => {
  const vertical = horizontalFovToVertical(120, 16 / 9);
  assert.ok(vertical > 80 && vertical < 90);
  assert.ok(horizontalFovToVertical(160, 16 / 9) > vertical);
});
