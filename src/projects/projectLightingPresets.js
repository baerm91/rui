export const HEIDENTOR_LIGHTING_REVISION = 1;

// Camera-space equivalents of the original world-space Heidentor lights at
// station 1. The first scene therefore keeps its established appearance while
// later camera angles receive the same key and fill directions.
export const HEIDENTOR_STABLE_LIGHTING = {
  lightIntensity: 0.9,
  shadowDiffuse: 4,
  lightHemiEnabled: true,
  lightKeyEnabled: true,
  lightKeyFixedToCamera: true,
  lightKeyPos: { x: -11.3424, y: 14.2625, z: -4.174 },
  lightFillEnabled: true,
  lightFillFixedToCamera: true,
  lightFillPos: { x: 13.8174, y: 10.005, z: -8.7412 },
  lightSpotEnabled: false,
  lightSpotFixedToCamera: true,
  lightSpotPos: { x: 1.2375, y: 13.1323, z: -6.5126 },
  stationConsistencyRevision: HEIDENTOR_LIGHTING_REVISION
};

export function resolveProjectLightingSource(projectId, lighting, legacyStation = null) {
  const source = lighting && typeof lighting === 'object' ? lighting : (legacyStation ?? {});
  if (
    projectId === 'demo-heidentor'
    && (Number(source.stationConsistencyRevision) || 0) < HEIDENTOR_LIGHTING_REVISION
  ) {
    return HEIDENTOR_STABLE_LIGHTING;
  }
  return source;
}
