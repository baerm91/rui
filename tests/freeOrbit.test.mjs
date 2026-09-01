import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyFreeNavigationFocus,
  applyFreeOrbitRotation,
  applyFreeViewPan,
  createFreeNavigationActivationState,
  isFreeNavigationActiveState,
  isKeyboardNavigationAllowedState,
  resolveCanvasTouchAction,
  resolveFreeNavigationOrbitControls,
  resolveFreeMovementSpeed,
  resolveFreeNavigationMaxDistance,
  shouldUseCustomFreeOrbitPointer
} from '../src/three/freeOrbit.js';

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('free movement remains responsive nearby and scales for editor and wide-angle views', () => {
  const nearby = resolveFreeMovementSpeed({ targetDistance: 1, cameraFov: 45 });
  assert.equal(nearby, 0.75);
  assert.equal(resolveFreeMovementSpeed({ targetDistance: 1, cameraFov: 45, isEditor: true }), nearby * 2.5);
  assert.equal(resolveFreeMovementSpeed({ targetDistance: 1, cameraFov: 160 }), nearby * 2.4);
  assert.equal(resolveFreeMovementSpeed({ targetDistance: 1, cameraFov: 45, sprinting: true }), nearby * 4);
});

test('activation selects the project pivot without mutating the camera view', () => {
  const cameraPosition = new THREE.Vector3(8, 7, -3);
  const cameraTarget = new THREE.Vector3(1, 4, 2);
  const beforePosition = cameraPosition.clone();
  const beforeTarget = cameraTarget.clone();
  const pivot = { x: -2, y: 5, z: 6 };

  const state = createFreeNavigationActivationState({ id: 'free-station' }, pivot);

  assert.deepEqual(state, {
    freeNavigationActive: true,
    freeNavigationStationId: 'free-station',
    freeNavigationOrbitPivot: pivot,
    hasUserManipulatedCamera: false
  });
  assert.deepEqual(cameraPosition, beforePosition);
  assert.deepEqual(cameraTarget, beforeTarget);
});

test('free navigation points the camera and controls at the selected project pivot', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(8, 7, -3);
  const target = new THREE.Vector3(1, 4, 2);
  const pivot = { x: -2, y: 5, z: 6 };

  assert.equal(applyFreeNavigationFocus({ camera, target, pivot }), true);
  assert.deepEqual(target, new THREE.Vector3(-2, 5, 6));
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const expectedDirection = target.clone().sub(camera.position).normalize();
  assert.ok(direction.distanceTo(expectedDirection) < 1e-10);
});

test('free-navigation state is recognized so OrbitControls cannot reorient it per frame', () => {
  const station = { id: 'free-station', freeNavigation: false };
  assert.equal(isFreeNavigationActiveState({
    stationMode: 'scroll',
    stations: [station],
    currentStationIndex: 0,
    freeNavigationActive: true,
    freeNavigationStationId: station.id
  }), true);
  assert.equal(isFreeNavigationActiveState({
    stationMode: 'scroll',
    stations: [station],
    currentStationIndex: 0,
    freeNavigationActive: false,
    freeNavigationStationId: null
  }), false);
});

test('WASD stays enabled in active free navigation but not on the scroll timeline', () => {
  const station = { id: 'free-station', freeNavigation: false };
  const scrollState = {
    stationMode: 'scroll',
    stations: [station],
    currentStationIndex: 0,
    freeNavigationActive: false,
    freeNavigationStationId: null
  };

  assert.equal(isKeyboardNavigationAllowedState(scrollState), false);
  assert.equal(isKeyboardNavigationAllowedState({
    ...scrollState,
    freeNavigationActive: true,
    freeNavigationStationId: station.id
  }), true);
  assert.equal(isKeyboardNavigationAllowedState({
    ...scrollState,
    stationMode: 'editor'
  }), true);
});

test('guided mobile stations allow page scrolling until free exploration starts', () => {
  assert.equal(resolveCanvasTouchAction('scroll', false), 'pan-y');
  assert.equal(resolveCanvasTouchAction('scroll', true), 'none');
  assert.equal(resolveCanvasTouchAction('editor', false), 'none');
});

test('touch gestures stay owned by OrbitControls instead of being handled twice', () => {
  assert.equal(shouldUseCustomFreeOrbitPointer('touch'), false);
  assert.equal(shouldUseCustomFreeOrbitPointer('mouse'), true);
  assert.equal(shouldUseCustomFreeOrbitPointer('pen'), true);
  assert.deepEqual(resolveFreeNavigationOrbitControls(true), {
    enableRotate: true,
    leftMouseButton: null
  });
});

test('free rotation is a rigid orbit around the independent project pivot', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(8, 7, -3);
  const target = new THREE.Vector3(1, 4, 2);
  const pivot = new THREE.Vector3(-2, 5, 6);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);

  const originalPosition = camera.position.clone();
  const cameraRadius = camera.position.distanceTo(pivot);
  const targetRadius = target.distanceTo(pivot);
  const viewDistance = camera.position.distanceTo(target);

  assert.equal(applyFreeOrbitRotation({
    camera,
    target,
    pivot,
    deltaX: 73,
    deltaY: -29
  }), true);

  assert.ok(camera.position.distanceTo(originalPosition) > 0.1);
  closeTo(camera.position.distanceTo(pivot), cameraRadius);
  closeTo(target.distanceTo(pivot), targetRadius);
  closeTo(camera.position.distanceTo(target), viewDistance);
  assert.deepEqual(pivot, new THREE.Vector3(-2, 5, 6));
});

test('zoom limit setup can never move or clamp the activation camera', () => {
  assert.equal(resolveFreeNavigationMaxDistance(40, 0.5, 125), 125);
  assert.equal(resolveFreeNavigationMaxDistance(40, 0.5, 4), 40);
  assert.equal(resolveFreeNavigationMaxDistance(undefined, 0.5, 4), 40);
});

test('right-button pan translates camera and view target without moving the orbit pivot', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(8, 7, -3);
  const target = new THREE.Vector3(1, 4, 2);
  const pivot = new THREE.Vector3(-2, 5, 6);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const originalPosition = camera.position.clone();
  const originalTarget = target.clone();
  const originalViewDistance = camera.position.distanceTo(target);

  assert.equal(applyFreeViewPan({
    camera,
    target,
    deltaX: 45,
    deltaY: -20,
    viewportHeight: 900
  }), true);

  const cameraTranslation = camera.position.clone().sub(originalPosition);
  const targetTranslation = target.clone().sub(originalTarget);
  assert.ok(cameraTranslation.length() > 0.01);
  assert.ok(cameraTranslation.distanceTo(targetTranslation) < 1e-10);
  closeTo(camera.position.distanceTo(target), originalViewDistance);
  assert.deepEqual(pivot, new THREE.Vector3(-2, 5, 6));
});

test('repeated movement toward the zenith keeps quaternion orientation continuous', () => {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(7, 3, 5);
  const target = new THREE.Vector3(2, 5, -1);
  const pivot = new THREE.Vector3(0, 0, 0);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);

  const previousQuaternion = new THREE.Quaternion();
  const previousDirection = new THREE.Vector3();
  const currentDirection = new THREE.Vector3();
  for (let step = 0; step < 500; step += 1) {
    previousQuaternion.copy(camera.quaternion);
    camera.getWorldDirection(previousDirection);
    applyFreeOrbitRotation({ camera, target, pivot, deltaX: 0.4, deltaY: 8 });
    camera.getWorldDirection(currentDirection);

    assert.ok(previousQuaternion.angleTo(camera.quaternion) < 0.08, `quaternion jump at step ${step}`);
    assert.ok(previousDirection.dot(currentDirection) > 0.995, `view flipped at step ${step}`);
  }
});
