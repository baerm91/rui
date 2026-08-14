const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
export const DEFAULT_PROJECT_CAMERA_FOV = 75;

export const normalizeProjectCameraFov = (value) => (
  Math.max(60, Math.min(160, Number(value) === 45 ? DEFAULT_PROJECT_CAMERA_FOV : (Number(value) || DEFAULT_PROJECT_CAMERA_FOV)))
);

export const horizontalFovToVertical = (horizontalFov, aspect = 16 / 9) => {
  const safeAspect = Math.max(0.1, Number(aspect) || 16 / 9);
  const horizontalRadians = normalizeProjectCameraFov(horizontalFov) * Math.PI / 180;
  return Math.min(170, 2 * Math.atan(Math.tan(horizontalRadians / 2) / safeAspect) * 180 / Math.PI);
};

export function normalizeProjectOrbitTarget(target, stations = []) {
  if (target && [target.x, target.y, target.z].every(Number.isFinite)) {
    return { x: target.x, y: target.y, z: target.z };
  }

  const legacyStation = stations.find((station) => station?.freeNavigation && station?.cameraTarget)
    ?? stations.find((station) => station?.cameraTarget);
  const legacyTarget = legacyStation?.cameraTarget;
  return {
    x: finiteOr(legacyTarget?.x, 0),
    y: finiteOr(legacyTarget?.y, 0)
      + (Number.isFinite(legacyStation?.freeNavigationTargetOffsetY)
        ? legacyStation.freeNavigationTargetOffsetY
        : 0),
    z: finiteOr(legacyTarget?.z, 0)
  };
}

export function serializeProjectMetadata(project) {
  if (!project) return undefined;
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    annotationRevision: Number(project.annotationRevision) || 0,
    stationRevision: Number(project.stationRevision) || 0,
    branding: project.branding,
    models: project.models,
    settings: project.settings
  };
}
