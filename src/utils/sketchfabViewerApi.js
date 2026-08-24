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
