const list = (value) => Array.isArray(value) ? value : [];

const normalizedSource = (value) => String(value || '').trim().toLocaleLowerCase('de');

export function getStoryModelCount(story = {}) {
  const sources = new Set();
  const addSource = (value, fallback = '') => {
    const source = normalizedSource(value);
    if (source) sources.add(source);
    else if (fallback) sources.add(fallback);
  };

  const models = story.models || {};
  addSource(models.primary, models.localModelName ? `local:${normalizedSource(models.localModelName)}` : '');
  addSource(models.reconstruction);
  list(models.additional).forEach((model) => addSource(model?.url || model?.modelUrl));

  list(story.stations).forEach((station) => {
    const items = [...list(station?.items), ...list(station?.spatial?.items)];
    items.forEach((item) => addSource(item?.modelUrl || item?.url || item?.sourceId));
  });

  return sources.size;
}

export function getStoryStationCount(story = {}) {
  return list(story.stations).length;
}

export function getStoryAnnotationCount(story = {}) {
  const annotations = [
    ...list(story.annotations),
    ...list(story.stations).flatMap((station) => list(station?.annotations))
  ];
  const identified = new Set(annotations.map((annotation) => annotation?.id).filter(Boolean));
  return identified.size + annotations.filter((annotation) => !annotation?.id).length;
}

export function getStoryCounts(story = {}) {
  return {
    models: getStoryModelCount(story),
    stations: getStoryStationCount(story),
    annotations: getStoryAnnotationCount(story)
  };
}
