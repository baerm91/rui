export function resolvePreviewLookOffset(clientX, left, width, maximumOffset = 2.2) {
  if (!Number.isFinite(width) || width <= 0) return 0;
  const horizontalPosition = Math.max(-1, Math.min(1, ((clientX - left) / width - 0.5) * 2));
  const offset = horizontalPosition * -maximumOffset;
  return Math.abs(offset) < 0.0001 ? 0 : offset;
}

export function resolvePreviewDuration(videoDuration, storedDuration, fallbackDuration = 3) {
  if (Number.isFinite(videoDuration) && videoDuration > 0) return videoDuration;
  if (Number.isFinite(storedDuration) && storedDuration > 0) return storedDuration;
  return fallbackDuration;
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
