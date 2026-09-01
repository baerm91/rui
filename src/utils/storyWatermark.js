export function resolveStoryWatermarkOpacity({
  scrollProgress = 0,
  stationCount = 0,
  isEditor = false,
  activeIndex = 0
} = {}) {
  if (isEditor) return activeIndex === 0 ? 1 : 0;
  if (stationCount <= 1) return 1;

  const progress = Math.max(0, Math.min(1, Number(scrollProgress) || 0));
  const firstTransitionProgress = progress * (stationCount - 1);
  const fadeProgress = Math.max(0, Math.min(1, (firstTransitionProgress - 0.04) / 0.61));
  const easedFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);

  return 1 - easedFade;
}

export function resolveStoryWatermarkFitSize(watermark = '') {
  const characterCount = Math.max(1, String(watermark).trim().length);
  const viewportSize = Math.min(13.4, 80 / characterCount / 0.6);
  return `${Number(viewportSize.toFixed(4))}vw`;
}
