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
      position: vector(input.modelTransform?.position, [1.35, 0.18, 0.55]),
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
    wallBackground: {
      url: String(station.spatial?.wallBackground?.url || station.spatial?.wallBackgroundImage || '').trim(),
      opacity: number(station.spatial?.wallBackground?.opacity, 0.72, 0.05, 1)
    },
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

export function moveSpatialItem(items, itemId, direction) {
  const source = Array.isArray(items) ? items : [];
  const currentIndex = source.findIndex((item) => item?.id === itemId);
  const nextIndex = currentIndex + Math.sign(Number(direction) || 0);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= source.length || nextIndex === currentIndex) return source;
  const reordered = [...source];
  const [item] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, item);
  return reordered;
}

export function normalizeThumbnailLayout(value) {
  return value === 'carousel' ? 'carousel' : 'tiles';
}

export function normalizeThumbnailGridSpacing(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(60, Math.min(140, Math.round(parsed))) : 100;
}

export function resolveSpatialOverviewThumbnailLayout(aspects = [], options = {}) {
  const columns = Math.max(1, Math.round(number(options.columns, 3, 1, 6)));
  const gap = number(options.gap, .22, 0, 1);
  const centerX = number(options.centerX, .85);
  const centerY = number(options.centerY, 2.4);
  const availableWidth = number(options.availableWidth, 4.15, 1, 12);
  const borderSize = number(options.borderSize, .18, 0, .8);
  const maxImageHeight = number(options.maxImageHeight, 1.08, .2, 3);
  const normalizedAspects = (Array.isArray(aspects) ? aspects : []).map((aspect) => number(aspect, 1, .58, 1.9));
  const rows = [];
  for (let rowStart = 0; rowStart < normalizedAspects.length; rowStart += columns) {
    const rowAspects = normalizedAspects.slice(rowStart, rowStart + columns);
    const aspectSum = rowAspects.reduce((sum, aspect) => sum + aspect, 0);
    const imageHeight = Math.max(.56, Math.min(maxImageHeight, (availableWidth - gap * (rowAspects.length - 1) - borderSize * rowAspects.length) / Math.max(.7, aspectSum)));
    const entries = rowAspects.map((aspect, rowIndex) => ({
      index: rowStart + rowIndex,
      imageWidth: imageHeight * aspect,
      imageHeight,
      cardWidth: imageHeight * aspect + borderSize,
      cardHeight: imageHeight + borderSize
    }));
    rows.push({ entries, height: Math.max(...entries.map((entry) => entry.cardHeight)) });
  }
  const totalHeight = rows.reduce((sum, row) => sum + row.height, 0) + gap * Math.max(0, rows.length - 1);
  let rowTop = centerY + totalHeight / 2;
  const layout = [];
  rows.forEach((row) => {
    const rowWidth = row.entries.reduce((sum, entry) => sum + entry.cardWidth, 0) + gap * Math.max(0, row.entries.length - 1);
    let itemLeft = centerX - rowWidth / 2;
    row.entries.forEach((entry) => {
      layout[entry.index] = { ...entry, x: itemLeft + entry.cardWidth / 2, y: rowTop - row.height / 2 };
      itemLeft += entry.cardWidth + gap;
    });
    rowTop -= row.height + gap;
  });
  return layout;
}

export function resolveSpatialInitialItemId(station = {}, items = station.items) {
  const availableItems = Array.isArray(items) ? items : [];
  const availableIds = new Set(availableItems.map((item) => item?.id).filter(Boolean));
  return availableIds.has(station.initialItemId) ? station.initialItemId : null;
}

export function resolveSpatialVisitorItemId(station = {}, items = station.items, randomValue = Math.random()) {
  const availableItems = Array.isArray(items) ? items.filter((item) => item?.id) : [];
  const initialItemId = resolveSpatialInitialItemId(station, availableItems);
  if (initialItemId || !availableItems.length) return initialItemId;
  const safeRandomValue = Math.max(0, Math.min(.999999999, Number(randomValue) || 0));
  return availableItems[Math.floor(safeRandomValue * availableItems.length)].id;
}

export function shouldAutoRotateSpatialModel(lastInteractionAt, now, delay = 10000) {
  return Number.isFinite(lastInteractionAt) && Number.isFinite(now) && now - lastInteractionAt >= delay;
}

export function resolveSpatialOverviewCamera(stations = []) {
  const positions = (Array.isArray(stations) ? stations : [])
    .map((station) => vector(station?.spatial?.position ?? station?.position, [0, 0, 0]));
  if (!positions.length) return { position: [0, 3.35, 13], target: [0, 2.4, -5], fov: 52 };
  const xs = positions.map((position) => position[0]);
  const zs = positions.map((position) => position[2]);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  const span = Math.max(7.4, (positions.length - 1) * 7.2);
  return {
    position: [centerX, Math.max(3.35, span * .045 + 2.7), centerZ + Math.max(13, span * .55 + 6)],
    target: [centerX, 2.4, centerZ - 5],
    fov: Math.min(56, 50 + span * .14)
  };
}

export function isValidSpatialModelUrl(url) {
  return getSpatialSourceType(String(url || '').trim()) !== 'unknown';
}
