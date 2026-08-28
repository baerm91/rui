export function hasVisibleStationAnnotations(annotations = [], stationId) {
  if (!stationId) return false;
  return annotations.some((annotation) => (
    annotation?.positionExplicitlySet !== false
    && (!Array.isArray(annotation?.visibleStationIds) || annotation.visibleStationIds.includes(stationId))
  ));
}
