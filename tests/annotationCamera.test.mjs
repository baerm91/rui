import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAnnotationFocusView } from '../src/three/annotationCamera.js';

test('explicit annotation camera restores the exact saved position and target', () => {
  const annotation = {
    position: { x: 1, y: 2, z: 3 },
    cameraExplicitlySet: true,
    cameraPos: { x: 9, y: 8, z: 7 },
    cameraTarget: { x: 4, y: 5, z: 6 }
  };

  assert.deepEqual(resolveAnnotationFocusView({
    annotation,
    currentCameraPos: { x: 100, y: 100, z: 100 },
    currentCameraTarget: { x: 0, y: 0, z: 0 },
    minDistance: 20,
    maxDistance: 21
  }), {
    cameraPos: annotation.cameraPos,
    cameraTarget: annotation.cameraTarget,
    usesSavedView: true
  });
});

test('annotation without an explicit camera keeps the automatic point focus', () => {
  const result = resolveAnnotationFocusView({
    annotation: { position: { x: 0, y: 0, z: 0 }, cameraExplicitlySet: false },
    currentCameraPos: { x: 0, y: 0, z: 10 },
    currentCameraTarget: { x: 0, y: 0, z: 0 },
    minDistance: 0.25,
    maxDistance: 40
  });

  assert.deepEqual(result.cameraTarget, { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(result.cameraPos.z - 7.2) < 1e-10);
  assert.equal(result.usesSavedView, false);
});
