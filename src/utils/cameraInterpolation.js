const isFinitePoint = (point) => point
  && Number.isFinite(point.x)
  && Number.isFinite(point.y)
  && Number.isFinite(point.z);

export const hasExplicitStationCamera = (station) => station?.cameraExplicitlySet !== false
  && isFinitePoint(station?.cameraPos)
  && isFinitePoint(station?.cameraTarget);

export function resolveExplicitStationCamera(stations, stationIndex) {
  const list = Array.isArray(stations) ? stations : [];
  for (let index = Math.min(stationIndex, list.length - 1); index >= 0; index -= 1) {
    if (hasExplicitStationCamera(list[index])) {
      return {
        cameraPos: list[index].cameraPos,
        cameraTarget: list[index].cameraTarget
      };
    }
  }
  return null;
}

/**
 * Interpolate around the viewed subject instead of cutting straight through it.
 * The target and distance still interpolate linearly; only the viewing direction
 * follows the shortest spherical arc.
 */
export function interpolateCameraView(camera0, camera1, progress) {
  if (!camera0 || !camera1) return camera0 ?? camera1 ?? null;
  const t = Math.max(0, Math.min(1, Number(progress) || 0));
  if (t <= 0) return camera0;
  if (t >= 1) return camera1;

  const target = {
    x: camera0.cameraTarget.x + (camera1.cameraTarget.x - camera0.cameraTarget.x) * t,
    y: camera0.cameraTarget.y + (camera1.cameraTarget.y - camera0.cameraTarget.y) * t,
    z: camera0.cameraTarget.z + (camera1.cameraTarget.z - camera0.cameraTarget.z) * t
  };
  const offset0 = {
    x: camera0.cameraPos.x - camera0.cameraTarget.x,
    y: camera0.cameraPos.y - camera0.cameraTarget.y,
    z: camera0.cameraPos.z - camera0.cameraTarget.z
  };
  const offset1 = {
    x: camera1.cameraPos.x - camera1.cameraTarget.x,
    y: camera1.cameraPos.y - camera1.cameraTarget.y,
    z: camera1.cameraPos.z - camera1.cameraTarget.z
  };
  const distance0 = Math.hypot(offset0.x, offset0.y, offset0.z);
  const distance1 = Math.hypot(offset1.x, offset1.y, offset1.z);

  if (distance0 < 0.000001 || distance1 < 0.000001) {
    return {
      cameraPos: {
        x: camera0.cameraPos.x + (camera1.cameraPos.x - camera0.cameraPos.x) * t,
        y: camera0.cameraPos.y + (camera1.cameraPos.y - camera0.cameraPos.y) * t,
        z: camera0.cameraPos.z + (camera1.cameraPos.z - camera0.cameraPos.z) * t
      },
      cameraTarget: target
    };
  }

  const direction0 = { x: offset0.x / distance0, y: offset0.y / distance0, z: offset0.z / distance0 };
  const direction1 = { x: offset1.x / distance1, y: offset1.y / distance1, z: offset1.z / distance1 };
  const dot = Math.max(-1, Math.min(1,
    direction0.x * direction1.x + direction0.y * direction1.y + direction0.z * direction1.z
  ));
  let direction;

  if (dot > 0.9995) {
    direction = {
      x: direction0.x + (direction1.x - direction0.x) * t,
      y: direction0.y + (direction1.y - direction0.y) * t,
      z: direction0.z + (direction1.z - direction0.z) * t
    };
  } else if (dot < -0.9995) {
    const basis = Math.abs(direction0.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const orthogonal = {
      x: direction0.y * basis.z - direction0.z * basis.y,
      y: direction0.z * basis.x - direction0.x * basis.z,
      z: direction0.x * basis.y - direction0.y * basis.x
    };
    const orthogonalLength = Math.hypot(orthogonal.x, orthogonal.y, orthogonal.z);
    const angle = Math.PI * t;
    direction = {
      x: direction0.x * Math.cos(angle) + orthogonal.x / orthogonalLength * Math.sin(angle),
      y: direction0.y * Math.cos(angle) + orthogonal.y / orthogonalLength * Math.sin(angle),
      z: direction0.z * Math.cos(angle) + orthogonal.z / orthogonalLength * Math.sin(angle)
    };
  } else {
    const angle = Math.acos(dot);
    const angleSin = Math.sin(angle);
    const weight0 = Math.sin((1 - t) * angle) / angleSin;
    const weight1 = Math.sin(t * angle) / angleSin;
    direction = {
      x: direction0.x * weight0 + direction1.x * weight1,
      y: direction0.y * weight0 + direction1.y * weight1,
      z: direction0.z * weight0 + direction1.z * weight1
    };
  }

  const directionLength = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const distance = distance0 + (distance1 - distance0) * t;
  const position = {
    x: target.x + direction.x / directionLength * distance,
    y: target.y + direction.y / directionLength * distance,
    z: target.z + direction.z / directionLength * distance
  };

  return {
    cameraPos: position,
    cameraTarget: target
  };
}

export function interpolateStationCameras(stations, progress) {
  const list = Array.isArray(stations) ? stations : [];
  if (list.length === 0) return null;
  if (list.length === 1) return resolveExplicitStationCamera(list, 0);

  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const scaled = clamped * (list.length - 1);
  const index = Math.min(Math.floor(scaled), list.length - 2);
  const rawIntervalProgress = Math.max(0, Math.min(1, scaled - index));
  const smoothProgress = rawIntervalProgress * rawIntervalProgress * (3 - 2 * rawIntervalProgress);
  const current = resolveExplicitStationCamera(list, index);
  const next = resolveExplicitStationCamera(list, index + 1);
  return interpolateCameraView(current, next, smoothProgress);
}
