import { getSketchfabModelUid, isSketchfabModelUrl, isSupportedModelUrl, normalizeModelUrl } from './modelSource.js';

const number = (value, fallback, min = -Infinity, max = Infinity) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

const vector = (value, fallback) => {
  if (Array.isArray(value)) return fallback.map((entry, index) => number(value[index], entry));
  return fallback.map((entry, index) => number(value?.[['x', 'y', 'z'][index]], entry));
};

const defaultThumbnailPosition = (index) => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return [Number((-3.2 + column * 2.1).toFixed(2)), Number((1.45 - row * 2.7).toFixed(2)), 0.08];
};

const visibleThumbnailPosition = (value, index) => {
  const fallback = defaultThumbnailPosition(index);
  const position = vector(value, fallback);
  const outsideStation = position[0] < -3.5 || position[0] > 3.5 || position[1] < -2.2 || position[1] > 2.4;
  return outsideStation ? fallback : position;
};

export function getSpatialSourceType(url = '') {
  if (isSketchfabModelUrl(url)) return 'sketchfab';
  if (isSupportedModelUrl(url)) return 'gltf';
  return 'unknown';
}

export function createSpatialItem(input = {}, index = 0) {
  const modelUrl = normalizeModelUrl(String(input.modelUrl || '').trim());
  const sourceType = input.sourceType || getSpatialSourceType(modelUrl);
  return {
    id: input.id || `item_${Date.now()}_${index}`,
    modelUrl,
    sourceType,
    sourceId: sourceType === 'sketchfab' ? getSketchfabModelUid(modelUrl) : '',
    title: String(input.title || `Objekt ${index + 1}`).trim(),
    description: String(input.description || '').trim(),
    thumbnailUrl: String(input.thumbnailUrl || '').trim(),
    thumbnailTransform: {
      position: visibleThumbnailPosition(input.thumbnailTransform?.position, index),
      rotation: vector(input.thumbnailTransform?.rotation, [0, 0, 0]),
      scale: number(input.thumbnailTransform?.scale, 1, 0.35, 2.5)
    },
    modelTransform: {
      position: vector(input.modelTransform?.position, [1.35, 1.35, 0.55]),
      rotation: vector(input.modelTransform?.rotation, [0, 0, 0]),
      scale: number(input.modelTransform?.scale, 1, 0.02, 20)
    },
    attribution: String(input.attribution || '').trim(),
    license: String(input.license || '').trim()
  };
}

export function normalizeSpatialStation(station = {}, index = 0) {
  const stationPosition = vector(station.spatial?.position ?? station.position, [index * 9, 0, 0]);
  const stationRotation = vector(station.spatial?.rotation ?? station.rotation, [0, index % 2 ? Math.PI : 0, 0]);
  const cameraPosition = vector(station.spatial?.camera?.position ?? station.cameraPos, [stationPosition[0], 1.7, stationPosition[2] + 5]);
  const cameraTarget = vector(station.spatial?.camera?.target ?? station.cameraTarget, [stationPosition[0], 1.5, stationPosition[2]]);
  return {
    position: stationPosition,
    rotation: stationRotation,
    movementRadius: number(station.spatial?.movementRadius, 5, 1, 30),
    wallMaterial: station.spatial?.wallMaterial || 'warm-white',
    camera: {
      position: cameraPosition,
      target: cameraTarget,
      fov: number(station.spatial?.camera?.fov, 45, 25, 100)
    },
    lighting: {
      ambientIntensity: number(station.spatial?.lighting?.ambientIntensity, 0.55, 0, 3),
      keyLightColor: station.spatial?.lighting?.keyLightColor || '#f2dfc3',
      keyLightIntensity: number(station.spatial?.lighting?.keyLightIntensity, 1.2, 0, 8),
      keyLightPosition: vector(station.spatial?.lighting?.keyLightPosition, [2, 4, 3]),
      keyLightTarget: vector(station.spatial?.lighting?.keyLightTarget, [0, 1.3, 0])
    },
    audio: {
      url: String(station.spatial?.audio?.url || '').trim(),
      volume: number(station.spatial?.audio?.volume, 0.6, 0, 1),
      spatial: station.spatial?.audio?.spatial !== false,
      range: number(station.spatial?.audio?.range, 8, 1, 50),
      autoplay: !!station.spatial?.audio?.autoplay
    }
  };
}

export function normalizeSpatialItems(items) {
  return (Array.isArray(items) ? items : []).map(createSpatialItem).filter((item) => item.modelUrl);
}

export function resolveSpatialInitialItemId(station = {}, items = station.items) {
  const availableItems = Array.isArray(items) ? items : [];
  const availableIds = new Set(availableItems.map((item) => item?.id).filter(Boolean));
  return [station.initialItemId, station.selectedItemId, availableItems[0]?.id]
    .find((id) => availableIds.has(id)) || null;
}

export function isValidSpatialModelUrl(url) {
  return getSpatialSourceType(String(url || '').trim()) !== 'unknown';
}
