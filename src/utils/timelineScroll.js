export const MIN_SCROLL_SPEED = 0.4;
export const MAX_SCROLL_SPEED = 1.6;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function normalizeScrollSpeed(value) {
  return clamp(Number(value) || 1, MIN_SCROLL_SPEED, MAX_SCROLL_SPEED);
}

export function getTimelineScrollLimits(viewportHeight, speed = 1) {
  const height = Math.max(320, Number(viewportHeight) || 0);
  const normalizedSpeed = normalizeScrollSpeed(speed);
  return {
    normalizedSpeed,
    // At the highest project setting the timeline still advances by only
    // about one full-screen station per second.
    maxPixelsPerSecond: height * 0.65 * normalizedSpeed,
    // A wheel flick may not queue several stations for later playback.
    maxBufferedDelta: height * 0.32
  };
}

export function getTimelineScrollStep(pendingDelta, elapsedMs, maxPixelsPerSecond) {
  if (!Number.isFinite(pendingDelta) || !Number.isFinite(elapsedMs) || !Number.isFinite(maxPixelsPerSecond)) return 0;
  const frameSeconds = clamp(elapsedMs, 0, 34) / 1000;
  const maxStep = Math.max(0, maxPixelsPerSecond) * frameSeconds;
  return Math.sign(pendingDelta) * Math.min(Math.abs(pendingDelta), maxStep);
}
