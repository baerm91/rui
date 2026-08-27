export function resolveCameraTransitionDuration({
  distance,
  base,
  multiplier,
  minimum,
  maximum,
  reducedMotion = false
}) {
  if (reducedMotion) return 0;
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  return Math.min(maximum, Math.max(minimum, base + safeDistance * multiplier));
}
