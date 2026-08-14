const MODEL_MODES = {
  primary: new Set(['ruin', 'portal', 'reveal']),
  reconstruction: new Set(['recon', 'portal', 'reveal'])
};

export function getStationsUsingModel(stations = [], role) {
  const modes = MODEL_MODES[role];
  if (!modes) return [];
  return stations.filter((station) => modes.has(station?.viewMode ?? 'reveal'));
}

export function getStationsUsingModelId(stations = [], modelId) {
  if (!modelId) return [];
  return stations.filter((station) => (
    station?.modelId === modelId
    || station?.secondaryModelId === modelId
    || (Array.isArray(station?.modelIds) && station.modelIds.includes(modelId))
  ));
}
