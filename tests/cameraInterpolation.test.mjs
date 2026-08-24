import assert from 'node:assert/strict';
import test from 'node:test';
import { interpolateCameraView, interpolateStationCameras } from '../src/utils/cameraInterpolation.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('camera interpolation preserves both captured station endpoints', () => {
  const first = { cameraPos: { x: 0, y: 0, z: 10 }, cameraTarget: { x: 0, y: 0, z: 0 } };
  const second = { cameraPos: { x: 10, y: 2, z: 0 }, cameraTarget: { x: 0, y: 0, z: 0 } };
  assert.equal(interpolateCameraView(first, second, 0), first);
  assert.equal(interpolateCameraView(first, second, 1), second);
});

test('opposite station views orbit around the target instead of crossing through it', () => {
  const first = { cameraPos: { x: 0, y: 0, z: 10 }, cameraTarget: { x: 0, y: 0, z: 0 } };
  const second = { cameraPos: { x: 0, y: 0, z: -10 }, cameraTarget: { x: 0, y: 0, z: 0 } };
  const middle = interpolateCameraView(first, second, 0.5);
  assert.ok(distance(middle.cameraPos, middle.cameraTarget) > 9.99);
});

test('station interpolation reuses the previous explicit camera for implicit stations', () => {
  const stations = [
    { cameraPos: { x: 0, y: 1, z: 10 }, cameraTarget: { x: 0, y: 1, z: 0 }, cameraExplicitlySet: true },
    { cameraExplicitlySet: false },
    { cameraPos: { x: 10, y: 1, z: 0 }, cameraTarget: { x: 0, y: 1, z: 0 }, cameraExplicitlySet: true }
  ];
  assert.deepEqual(interpolateStationCameras(stations, 0.5), {
    cameraPos: stations[0].cameraPos,
    cameraTarget: stations[0].cameraTarget
  });
});
