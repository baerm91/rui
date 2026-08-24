import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSketchfabCamera, objectToVector, positionKey, shouldSketchfabCapturePointer, vectorToObject } from '../src/utils/sketchfabViewerApi.js';

test('converts Sketchfab vectors to RIU coordinate objects and back', () => {
  assert.deepEqual(vectorToObject([1.25, -2, 3]), { x: 1.25, y: -2, z: 3 });
  assert.deepEqual(objectToVector({ x: 1.25, y: -2, z: 3 }), [1.25, -2, 3]);
});

test('normalizes Sketchfab camera data for RIU stations', () => {
  assert.deepEqual(normalizeSketchfabCamera({ position: [1, 2, 3], target: [4, 5, 6] }), {
    cameraPos: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 4, y: 5, z: 6 }
  });
});

test('yields pointer input to the RIU station timeline outside placement mode', () => {
  assert.equal(shouldSketchfabCapturePointer('scroll'), false);
  assert.equal(shouldSketchfabCapturePointer('scroll', true), true);
  assert.equal(shouldSketchfabCapturePointer('editor'), true);
});

test('uses a stable rounded cache key for projected annotation positions', () => {
  assert.equal(positionKey({ x: 1.000001, y: 2, z: -3 }), '1.00000:2.00000:-3.00000');
});
