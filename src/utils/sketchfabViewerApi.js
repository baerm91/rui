export const SKETCHFAB_VIEWER_VERSION = '1.12.1';
export const SKETCHFAB_VIEWER_SCRIPT = `https://static.sketchfab.com/api/sketchfab-viewer-${SKETCHFAB_VIEWER_VERSION}.js`;

let scriptPromise;

export function loadSketchfabViewerApi() {
  if (window.Sketchfab) return Promise.resolve(window.Sketchfab);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SKETCHFAB_VIEWER_SCRIPT}"]`);
    const script = existing || document.createElement('script');
    const handleLoad = () => window.Sketchfab
      ? resolve(window.Sketchfab)
      : reject(new Error('Die Sketchfab Viewer API konnte nicht geladen werden.'));
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Die Sketchfab Viewer API konnte nicht geladen werden.')), { once: true });
    if (!existing) {
      script.src = SKETCHFAB_VIEWER_SCRIPT;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export function vectorToObject(vector) {
  return { x: Number(vector?.[0]) || 0, y: Number(vector?.[1]) || 0, z: Number(vector?.[2]) || 0 };
}

export function objectToVector(point) {
  return [Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0];
}

export function normalizeSketchfabCamera(camera) {
  return { cameraPos: vectorToObject(camera?.position), cameraTarget: vectorToObject(camera?.target) };
}

export function getSketchfabCamera(api) {
  return new Promise((resolve, reject) => api.getCameraLookAt((error, camera) => {
    if (error) reject(error);
    else resolve(normalizeSketchfabCamera(camera));
  }));
}

export function setSketchfabCamera(api, camera, duration = 0) {
  return new Promise((resolve, reject) => api.setCameraLookAt(
    objectToVector(camera?.cameraPos),
    objectToVector(camera?.cameraTarget),
    duration,
    (error) => error ? reject(error) : resolve()
  ));
}

export function rotateSketchfabCamera(camera, angle) {
  const position = Array.isArray(camera?.position) ? camera.position : [0, 0, 0];
  const target = Array.isArray(camera?.target) ? camera.target : [0, 0, 0];
  const cosine = Math.cos(Number(angle) || 0);
  const sine = Math.sin(Number(angle) || 0);
  const offsetX = (Number(position[0]) || 0) - (Number(target[0]) || 0);
  const offsetY = (Number(position[1]) || 0) - (Number(target[1]) || 0);
  return {
    position: [
      (Number(target[0]) || 0) + offsetX * cosine - offsetY * sine,
      (Number(target[1]) || 0) + offsetX * sine + offsetY * cosine,
      Number(position[2]) || 0
    ],
    target: target.map((value) => Number(value) || 0)
  };
}

export function orbitSketchfabCamera(camera, deltaX, deltaY, sensitivity = .006) {
  const position = Array.isArray(camera?.position) ? camera.position.map((value) => Number(value) || 0) : [0, 0, 0];
  const target = Array.isArray(camera?.target) ? camera.target.map((value) => Number(value) || 0) : [0, 0, 0];
  const offset = position.map((value, index) => value - target[index]);
  const radius = Math.max(.001, Math.hypot(...offset));
  const azimuth = Math.atan2(offset[1], offset[0]) - (Number(deltaX) || 0) * sensitivity;
  const nextZ = Math.max(-radius * .96, Math.min(radius * .96, offset[2] + (Number(deltaY) || 0) * radius * sensitivity));
  const horizontalRadius = Math.sqrt(Math.max(0, radius * radius - nextZ * nextZ));
  return {
    position: [
      target[0] + Math.cos(azimuth) * horizontalRadius,
      target[1] + Math.sin(azimuth) * horizontalRadius,
      target[2] + nextZ
    ],
    target
  };
}

export function zoomSketchfabCamera(camera, deltaY) {
  const position = Array.isArray(camera?.position) ? camera.position.map((value) => Number(value) || 0) : [0, 0, 0];
  const target = Array.isArray(camera?.target) ? camera.target.map((value) => Number(value) || 0) : [0, 0, 0];
  const factor = Math.exp(Math.max(-600, Math.min(600, Number(deltaY) || 0)) * .001);
  return {
    position: position.map((value, index) => target[index] + (value - target[index]) * factor),
    target
  };
}

export function isSketchfabModelHit(event) {
  return Number.isInteger(event?.instanceID) || (Array.isArray(event?.position3D) && event.position3D.length >= 3);
}

export function getSketchfabScreenshot(api, width, height) {
  return new Promise((resolve, reject) => api.getScreenShot(width, height, 'image/png', (error, result) => {
    if (error) reject(error);
    else resolve(result);
  }));
}

export function positionKey(position) {
  return ['x', 'y', 'z'].map((axis) => (Number(position?.[axis]) || 0).toFixed(5)).join(':');
}

export function shouldSketchfabCapturePointer(
  stationMode,
  isPlacingAnnotation = false,
  freeNavigationIsActive = false
) {
  return stationMode !== 'scroll' || isPlacingAnnotation || freeNavigationIsActive;
}
