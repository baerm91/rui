import * as THREE from 'three';

const orbitPivot = new THREE.Vector3();
const orbitAxis = new THREE.Vector3();
const orbitCandidate = new THREE.Vector3();
const orbitQuaternion = new THREE.Quaternion();
const panRight = new THREE.Vector3();
const panUp = new THREE.Vector3();
const panOffset = new THREE.Vector3();

const isFiniteVector = (value) => value
  && [value.x, value.y, value.z].every(Number.isFinite);

const rotatePointAroundPivot = (point, quaternion) => {
  point.sub(orbitPivot).applyQuaternion(quaternion).add(orbitPivot);
};

export function createFreeNavigationActivationState(station, projectOrbitTarget) {
  if (!station?.id || !isFiniteVector(projectOrbitTarget)) return null;
  return {
    freeNavigationActive: true,
    freeNavigationStationId: station.id,
    freeNavigationOrbitPivot: { ...projectOrbitTarget },
    hasUserManipulatedCamera: false
  };
}

export function isFreeNavigationActiveState(appState) {
  const station = appState?.stations?.[appState.currentStationIndex];
  return appState?.stationMode === 'scroll'
    && !!station?.id
    && appState.freeNavigationActive
    && appState.freeNavigationStationId === station.id;
}

export function isKeyboardNavigationAllowedState(appState) {
  return appState?.stationMode !== 'scroll' || isFreeNavigationActiveState(appState);
}

export function resolveCanvasTouchAction(stationMode, freeNavigationIsActive = false) {
  return stationMode === 'scroll' && !freeNavigationIsActive ? 'pan-y' : 'none';
}

export function shouldUseCustomFreeOrbitPointer(pointerType = 'mouse') {
  return pointerType !== 'touch';
}

export function resolveFreeNavigationOrbitControls(freeNavigationIsActive = false) {
  return {
    enableRotate: freeNavigationIsActive,
    leftMouseButton: freeNavigationIsActive ? null : THREE.MOUSE.ROTATE
  };
}

export function resolveFreeNavigationMaxDistance(configuredDistance, minDistance, currentDistance) {
  const configured = Number.isFinite(configuredDistance) ? configuredDistance : 40;
  return Math.max(
    (Number.isFinite(minDistance) ? minDistance : 0.5) + 0.1,
    Math.min(200, configured),
    Number.isFinite(currentDistance) ? currentDistance : 0
  );
}

export function resolveFreeMovementSpeed({ targetDistance = 0, cameraFov = 45, isEditor = false, sprinting = false } = {}) {
  const walkingSpeed = Math.max(0.75, Math.max(0, targetDistance) * 0.22);
  const fovMultiplier = Math.max(1, Math.min(2.4, (Number(cameraFov) || 45) / 60));
  return walkingSpeed * fovMultiplier * (isEditor ? 2.5 : 1) * (sprinting ? 4 : 1);
}

export function applyFreeNavigationFocus({ camera, target, pivot }) {
  if (!camera?.position || !camera?.lookAt || !target?.set || !isFiniteVector(pivot)) return false;
  target.set(pivot.x, pivot.y, pivot.z);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return true;
}

export function applyFreeOrbitRotation({
  camera,
  target,
  pivot,
  deltaX,
  deltaY,
  sensitivity = 0.0045
}) {
  if (!camera?.position || !camera?.quaternion || !target || !isFiniteVector(pivot)) return false;
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || (deltaX === 0 && deltaY === 0)) return false;

  orbitPivot.set(pivot.x, pivot.y, pivot.z);
  orbitQuaternion.setFromAxisAngle(camera.up, -deltaX * sensitivity);
  rotatePointAroundPivot(camera.position, orbitQuaternion);
  rotatePointAroundPivot(target, orbitQuaternion);
  camera.quaternion.premultiply(orbitQuaternion);
  camera.updateMatrixWorld(true);

  orbitAxis.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  orbitQuaternion.setFromAxisAngle(orbitAxis, -deltaY * sensitivity);
  orbitCandidate.copy(camera.position).sub(orbitPivot).applyQuaternion(orbitQuaternion);
  const candidateLength = orbitCandidate.length();
  const polarAngle = candidateLength > 0.0001
    ? Math.acos(THREE.MathUtils.clamp(orbitCandidate.y / candidateLength, -1, 1))
    : Math.PI / 2;
  if (polarAngle > 0.04 && polarAngle < Math.PI - 0.04) {
    rotatePointAroundPivot(camera.position, orbitQuaternion);
    rotatePointAroundPivot(target, orbitQuaternion);
    camera.quaternion.premultiply(orbitQuaternion);
  }

  camera.updateMatrixWorld(true);
  return true;
}

export function applyFreeViewPan({ camera, target, deltaX, deltaY, viewportHeight }) {
  if (!camera?.position || !target || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return false;
  if (deltaX === 0 && deltaY === 0) return false;

  camera.updateMatrixWorld(true);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const viewDistance = Math.max(0.1, camera.position.distanceTo(target));
  const verticalFov = THREE.MathUtils.degToRad(Number(camera.fov) || 50);
  const worldUnitsPerPixel = 2 * Math.tan(verticalFov / 2) * viewDistance / height;

  panRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-deltaX * worldUnitsPerPixel);
  panUp.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(deltaY * worldUnitsPerPixel);
  panOffset.copy(panRight).add(panUp);
  camera.position.add(panOffset);
  target.add(panOffset);
  camera.updateMatrixWorld(true);
  return true;
}
