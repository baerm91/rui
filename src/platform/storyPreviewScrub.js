export function pointerProgress(clientX, left, width) {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - left) / width));
}

export function directionalPointerProgress(clientX, left, width, entrySide = 'left') {
  const absoluteProgress = pointerProgress(clientX, left, width);
  return entrySide === 'right' ? 1 - absoluteProgress : absoluteProgress;
}

export function pointerEntrySide(clientX, left, width) {
  return pointerProgress(clientX, left, width) > 0.5 ? 'right' : 'left';
}

export function resolvePreviewDuration(videoDuration, storedDuration, fallbackDuration = 3) {
  if (Number.isFinite(videoDuration) && videoDuration > 0) return videoDuration;
  if (Number.isFinite(storedDuration) && storedDuration > 0) return storedDuration;
  return fallbackDuration;
}

export function resolveScrubDuration(videoDuration, storedForwardDuration) {
  if (Number.isFinite(storedForwardDuration) && storedForwardDuration > 0) return storedForwardDuration;
  return resolvePreviewDuration(videoDuration, storedForwardDuration);
}
