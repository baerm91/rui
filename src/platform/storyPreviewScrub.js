export function pointerProgress(clientX, left, width) {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.max(0, Math.min(1, (clientX - left) / width));
}

export function directionalPointerProgress(clientX, left, width, entrySide = 'left') {
  const absoluteProgress = pointerProgress(clientX, left, width);
  return entrySide === 'right' ? 1 - absoluteProgress : absoluteProgress;
}

export function relativePointerProgress(clientX, entryX, width, entryProgress = 0, entrySide = 'left') {
  if (!Number.isFinite(width) || width <= 0) return Math.max(0, Math.min(1, entryProgress));
  const direction = entrySide === 'right' ? -1 : 1;
  const delta = ((clientX - entryX) / width) * direction;
  return Math.max(0, Math.min(1, entryProgress + delta));
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

export function resolveVisualPreviewProgress(currentTime, forwardDuration, totalDuration, storedReturnDuration) {
  const forward = Number.isFinite(forwardDuration) && forwardDuration > 0 ? forwardDuration : 3;
  const time = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  if (time <= forward) return Math.max(0, Math.min(1, time / forward));
  const total = Number.isFinite(totalDuration) && totalDuration > forward
    ? totalDuration
    : forward + (Number.isFinite(storedReturnDuration) && storedReturnDuration > 0 ? storedReturnDuration : 3.5);
  const returnProgress = (time - forward) / Math.max(0.001, total - forward);
  return 1 - Math.max(0, Math.min(1, returnProgress));
}

export function storyHasPreview(story) {
  return Boolean(story?.previewVideoUrl || story?.previewVideoAssetId);
}
