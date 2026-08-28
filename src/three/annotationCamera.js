const isFiniteVector = (value) => (
  value && [value.x, value.y, value.z].every(Number.isFinite)
);

const subtract = (left, right) => ({
  x: left.x - right.x,
  y: left.y - right.y,
  z: left.z - right.z
});

const lengthSquared = (value) => value.x ** 2 + value.y ** 2 + value.z ** 2;

export function resolveAnnotationFocusView({
  annotation,
  currentCameraPos,
  currentCameraTarget,
  orbitAroundAnnotation = false,
  minDistance = 0.25,
  maxDistance = Infinity
}) {
  if (!isFiniteVector(annotation?.position)) return null;

  if (
    annotation.cameraExplicitlySet === true
    && isFiniteVector(annotation.cameraPos)
    && isFiniteVector(annotation.cameraTarget)
  ) {
    return {
      cameraPos: { ...annotation.cameraPos },
      cameraTarget: orbitAroundAnnotation
        ? { ...annotation.position }
        : { ...annotation.cameraTarget },
      usesSavedView: true
    };
  }

  let offset = isFiniteVector(currentCameraPos)
    ? subtract(currentCameraPos, annotation.position)
    : { x: 0, y: 0.35, z: 1 };
  if (lengthSquared(offset) < 0.0001 && isFiniteVector(currentCameraTarget)) {
    offset = subtract(currentCameraPos, currentCameraTarget);
  }
  if (lengthSquared(offset) < 0.0001) offset = { x: 0, y: 0.35, z: 1 };

  const distance = Math.sqrt(lengthSquared(offset));
  const safeMin = Math.max(0.25, Number.isFinite(minDistance) ? minDistance : 0.25);
  const safeMax = Number.isFinite(maxDistance) ? Math.max(safeMin, maxDistance) : distance;
  const focusDistance = Math.max(safeMin, Math.min(safeMax, distance * 0.72));
  const scale = focusDistance / distance;

  return {
    cameraPos: {
      x: annotation.position.x + offset.x * scale,
      y: annotation.position.y + offset.y * scale,
      z: annotation.position.z + offset.z * scale
    },
    cameraTarget: { ...annotation.position },
    usesSavedView: false
  };
}
