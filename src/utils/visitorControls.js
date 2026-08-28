export function resolveStoryFreeNavigationStationIndex(stations = [], currentIndex = 0) {
  if (stations[currentIndex]?.freeNavigation) return currentIndex;
  return stations.findIndex((station) => station?.freeNavigation);
}

export function hasVisibleStationAnnotations(annotations = [], stationId) {
  if (!stationId) return false;
  return annotations.some((annotation) => (
    annotation?.positionExplicitlySet !== false
    && (!Array.isArray(annotation?.visibleStationIds) || annotation.visibleStationIds.includes(stationId))
  ));
}
