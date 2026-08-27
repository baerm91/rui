import assert from 'node:assert/strict';
import test from 'node:test';
import { isSketchfabModelHit, normalizeSketchfabCamera, objectToVector, orbitSketchfabCamera, positionKey, rotateSketchfabCamera, shouldSketchfabCapturePointer, vectorToObject, zoomSketchfabCamera } from '../src/utils/sketchfabViewerApi.js';

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
  assert.equal(shouldSketchfabCapturePointer('scroll', false, true), true);
  assert.equal(shouldSketchfabCapturePointer('editor'), true);
});

test('uses a stable rounded cache key for projected annotation positions', () => {
  assert.equal(positionKey({ x: 1.000001, y: 2, z: -3 }), '1.00000:2.00000:-3.00000');
});

test('rotates a Sketchfab camera around its target without changing height or distance', () => {
  const quarterTurn = rotateSketchfabCamera({ position: [2, 1, 4], target: [1, 1, 2] }, Math.PI / 2);
  assert.deepEqual(quarterTurn.position.map((value) => Math.round(value)), [1, 2, 4]);
  assert.deepEqual(quarterTurn.target, [1, 1, 2]);
});

test('custom Sketchfab controls preserve orbit distance and zoom around the target', () => {
  const camera = { position: [3, 0, 1], target: [1, 0, 1] };
  const orbited = orbitSketchfabCamera(camera, 100, 0);
  const orbitDistance = Math.hypot(...orbited.position.map((value, index) => value - orbited.target[index]));
  assert.ok(Math.abs(orbitDistance - 2) < 1e-9);

  const zoomed = zoomSketchfabCamera(camera, 100);
  const zoomDistance = Math.hypot(...zoomed.position.map((value, index) => value - zoomed.target[index]));
  assert.ok(zoomDistance > 2);
});

test('recognizes only confirmed Sketchfab geometry hits', () => {
  assert.equal(isSketchfabModelHit({ instanceID: 0 }), true);
  assert.equal(isSketchfabModelHit({ position3D: [0, 1, 2] }), true);
  assert.equal(isSketchfabModelHit({ position2D: [12, 24] }), false);
  assert.equal(isSketchfabModelHit(null), false);
});
