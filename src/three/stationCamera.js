import { ctx } from './context.js';

const hasFiniteCameraVector = (value) => value
  && Number.isFinite(value.x)
  && Number.isFinite(value.y)
  && Number.isFinite(value.z);

const hasUsableExplicitCamera = (station) => station?.cameraExplicitlySet !== false
  && hasFiniteCameraVector(station.cameraPos)
  && hasFiniteCameraVector(station.cameraTarget);

const withFreeNavigationTarget = (station, camera) => {
  if (!station?.freeNavigation) return camera;
  const targetOffsetY = Number.isFinite(station.freeNavigationTargetOffsetY)
    ? station.freeNavigationTargetOffsetY
    : 0;
  return {
    ...camera,
    cameraTarget: {
      x: camera.cameraTarget.x,
      y: camera.cameraTarget.y + targetOffsetY,
      z: camera.cameraTarget.z
    }
  };
};

/**
 * Resolve the camera used at runtime without turning an implicit editor
 * placeholder into a real station camera. An implicit station keeps the last
 * explicitly defined view; before the first explicit view it uses the safe
 * framing captured when the project model was loaded.
 */
export function resolveStationCamera(stations, stationIndex, stationOverride = null) {
  const list = Array.isArray(stations) ? stations : [];
  const requestedStation = stationOverride ?? list[stationIndex];

  if (hasUsableExplicitCamera(requestedStation)) {
    return withFreeNavigationTarget(requestedStation, {
      cameraPos: requestedStation.cameraPos,
      cameraTarget: requestedStation.cameraTarget
    });
  }

  const matchingIndex = Number.isInteger(stationIndex)
    ? stationIndex
    : list.findIndex((station) => station?.id === requestedStation?.id);

  for (let index = Math.min(matchingIndex - 1, list.length - 1); index >= 0; index -= 1) {
    if (hasUsableExplicitCamera(list[index])) {
      return withFreeNavigationTarget(requestedStation, {
        cameraPos: list[index].cameraPos,
        cameraTarget: list[index].cameraTarget
      });
    }
  }

  return withFreeNavigationTarget(requestedStation, {
    cameraPos: ctx.projectDefaultCameraPos,
    cameraTarget: ctx.projectDefaultCameraTarget
  });
}
