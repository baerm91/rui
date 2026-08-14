import * as THREE from 'three';

const MIN_MECHANICAL_KEYS = 120;
const REFERENCE_STEP_COUNT = 24;
const MIN_MECHANICAL_ROTATION = Math.PI * 2;
const MAX_STABLE_AXIS_DEVIATION = THREE.MathUtils.degToRad(15);
const MIN_BROKEN_AXIS_DEVIATION = THREE.MathUtils.degToRad(45);

function quaternionStep(track, index) {
  const previous = new THREE.Quaternion().fromArray(track.values, (index - 1) * 4);
  const current = new THREE.Quaternion().fromArray(track.values, index * 4);
  const delta = previous.invert().multiply(current).normalize();
  if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(delta.w, -1, 1));
  const sine = Math.sqrt(Math.max(0, 1 - delta.w * delta.w));
  const axis = sine > 0.000001
    ? new THREE.Vector3(delta.x / sine, delta.y / sine, delta.z / sine)
    : null;
  return { angle, axis };
}

function stabilizeMechanicalQuaternionTrack(track) {
  if (!(track instanceof THREE.QuaternionKeyframeTrack) || track.times.length < MIN_MECHANICAL_KEYS) return track;

  const steps = [];
  for (let index = 1; index < track.times.length; index += 1) {
    const step = quaternionStep(track, index);
    if (step.axis && step.angle > 0.00001) steps.push({ ...step, index });
  }
  if (steps.length < REFERENCE_STEP_COUNT) return track;

  const firstAxis = steps[0].axis;
  const referenceAxis = new THREE.Vector3();
  steps.slice(0, REFERENCE_STEP_COUNT).forEach(({ axis, angle }) => {
    referenceAxis.addScaledVector(axis, Math.sign(axis.dot(firstAxis)) * angle);
  });
  if (referenceAxis.lengthSq() < 0.000001) return track;
  referenceAxis.normalize();

  const deviation = ({ axis }) => Math.acos(THREE.MathUtils.clamp(Math.abs(axis.dot(referenceAxis)), -1, 1));
  const earlyDeviation = Math.max(...steps.slice(0, REFERENCE_STEP_COUNT).map(deviation));
  const maximumDeviation = Math.max(...steps.map(deviation));
  const totalRotation = steps.reduce((sum, { angle }) => sum + angle, 0);
  const looksLikeBrokenMechanicalRotation = totalRotation >= MIN_MECHANICAL_ROTATION
    && earlyDeviation <= MAX_STABLE_AXIS_DEVIATION
    && maximumDeviation >= MIN_BROKEN_AXIS_DEVIATION;
  if (!looksLikeBrokenMechanicalRotation) return track;

  const values = new Float32Array(track.values.length);
  const initial = new THREE.Quaternion().fromArray(track.values, 0).normalize();
  initial.toArray(values, 0);
  const accumulated = new THREE.Quaternion();
  let direction = 1;

  for (let index = 1; index < track.times.length; index += 1) {
    const { angle, axis } = quaternionStep(track, index);
    const alignment = axis?.dot(referenceAxis) ?? 0;
    if (Math.abs(alignment) > 0.05) direction = Math.sign(alignment);
    const fixedStep = new THREE.Quaternion().setFromAxisAngle(referenceAxis, direction * angle);
    accumulated.multiply(fixedStep).normalize();
    initial.clone().multiply(accumulated).normalize().toArray(values, index * 4);
  }

  return new THREE.QuaternionKeyframeTrack(
    track.name,
    track.times,
    values,
    track.getInterpolation()
  );
}

export function stabilizeMechanicalRotationClip(clip) {
  const tracks = clip.tracks.map(stabilizeMechanicalQuaternionTrack);
  if (tracks.every((track, index) => track === clip.tracks[index])) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

export function createModelAnimationController(root, clips = [], options = {}) {
  const usableClips = Array.isArray(clips)
    ? clips.filter((clip) => clip?.tracks?.length && Number.isFinite(clip.duration) && clip.duration > 0)
    : [];
  if (!root || usableClips.length === 0) return null;

  const mixer = new THREE.AnimationMixer(root);
  const preparedClips = options.stabilizeMechanicalRotations
    ? usableClips.map(stabilizeMechanicalRotationClip)
    : usableClips;
  const actions = preparedClips.map((clip) => {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    return action;
  });
  return { mixer, actions, root };
}

function stopControllers(controllers) {
  controllers.forEach(({ mixer }) => mixer.stopAllAction());
}

function startControllers(controllers) {
  controllers.forEach(({ mixer, actions }) => {
    mixer.stopAllAction();
    actions.forEach((action) => action.reset().play());
  });
}

export function updateModelAnimations(context, station, deltaSeconds) {
  const controllers = context.modelAnimationControllers ?? [];
  const stationKey = station?.playModelAnimation ? String(station.id || 'active-station') : '';

  if (context.activeModelAnimationStationId !== stationKey) {
    stopControllers(controllers);
    if (stationKey) startControllers(controllers);
    context.activeModelAnimationStationId = stationKey;
  }

  if (stationKey && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
    const speedPercent = Number.isFinite(Number(station?.modelAnimationSpeed))
      ? THREE.MathUtils.clamp(Number(station.modelAnimationSpeed), 10, 200)
      : 100;
    controllers.forEach(({ mixer }) => mixer.update(deltaSeconds * speedPercent / 100));
  }
}

export function disposeModelAnimations(context) {
  const controllers = context.modelAnimationControllers ?? [];
  stopControllers(controllers);
  controllers.forEach(({ mixer, root }) => mixer.uncacheRoot(root));
  context.modelAnimationControllers = [];
  context.activeModelAnimationStationId = null;
}
