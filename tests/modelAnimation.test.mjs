import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createModelAnimationController,
  disposeModelAnimations,
  stabilizeMechanicalRotationClip,
  updateModelAnimations
} from '../src/three/modelAnimation.js';

function createAnimationContext() {
  const root = new THREE.Object3D();
  root.name = 'AnimatedRoot';
  const track = new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 10]);
  const clip = new THREE.AnimationClip('Move', 1, [track]);
  return {
    root,
    context: {
      modelAnimationControllers: [createModelAnimationController(root, [clip])],
      activeModelAnimationStationId: null
    }
  };
}

test('station animation starts only for enabled stations', () => {
  const { root, context } = createAnimationContext();
  updateModelAnimations(context, { id: 'station-a', playModelAnimation: false }, 0.5);
  assert.equal(root.position.x, 0);

  updateModelAnimations(context, { id: 'station-b', playModelAnimation: true }, 0.5);
  assert.ok(root.position.x > 4.9 && root.position.x < 5.1);
});

test('entering another enabled station restarts the animation', () => {
  const { root, context } = createAnimationContext();
  updateModelAnimations(context, { id: 'station-a', playModelAnimation: true }, 0.8);
  assert.ok(root.position.x > 7.9);

  updateModelAnimations(context, { id: 'station-b', playModelAnimation: true }, 0.1);
  assert.ok(root.position.x > 0.9 && root.position.x < 1.1);
});

test('station animation speed scales from normal to 200 percent', () => {
  const normal = createAnimationContext();
  updateModelAnimations(normal.context, { id: 'normal', playModelAnimation: true, modelAnimationSpeed: 100 }, 0.25);
  assert.ok(normal.root.position.x > 2.4 && normal.root.position.x < 2.6);

  const fast = createAnimationContext();
  updateModelAnimations(fast.context, { id: 'fast', playModelAnimation: true, modelAnimationSpeed: 200 }, 0.25);
  assert.ok(fast.root.position.x > 4.9 && fast.root.position.x < 5.1);
});

test('leaving an animated station stops and resets the model', () => {
  const { root, context } = createAnimationContext();
  updateModelAnimations(context, { id: 'station-a', playModelAnimation: true }, 0.5);
  updateModelAnimations(context, { id: 'station-b', playModelAnimation: false }, 0.5);
  assert.equal(root.position.x, 0);

  disposeModelAnimations(context);
  assert.deepEqual(context.modelAnimationControllers, []);
  assert.equal(context.activeModelAnimationStationId, null);
});

test('FBX-style mechanical rotation is constrained to its initial local axis', () => {
  const times = Array.from({ length: 181 }, (_, index) => index / 30);
  const values = [];
  let orientation = new THREE.Quaternion();
  times.forEach((_, index) => {
    const axis = index < 60
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    if (index > 0) orientation = orientation.multiply(
      new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(3))
    );
    values.push(...orientation.toArray());
  });
  const clip = new THREE.AnimationClip('Mechanical', 6, [
    new THREE.QuaternionKeyframeTrack('Wheel.quaternion', times, values)
  ]);

  const stabilized = stabilizeMechanicalRotationClip(clip);
  const track = stabilized.tracks[0];
  const before = new THREE.Quaternion().fromArray(track.values, 120 * 4);
  const after = new THREE.Quaternion().fromArray(track.values, 121 * 4);
  const delta = before.invert().multiply(after).normalize();
  const axis = new THREE.Vector3(delta.x, delta.y, delta.z).normalize();

  assert.notEqual(stabilized, clip);
  assert.ok(Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) > 0.999);
});
