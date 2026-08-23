export function resolveRelightPointer(clientX, clientY, left, top, width, height) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  return {
    x: Math.max(0, Math.min(1, (clientX - left) / safeWidth)),
    y: Math.max(0, Math.min(1, (clientY - top) / safeHeight))
  };
}

export function resolveCoverUvScale(imageAspect, viewportAspect) {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0
    || !Number.isFinite(viewportAspect) || viewportAspect <= 0) {
    return { x: 1, y: 1 };
  }
  return viewportAspect > imageAspect
    ? { x: 1, y: imageAspect / viewportAspect }
    : { x: viewportAspect / imageAspect, y: 1 };
}
