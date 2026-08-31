// Weighted rectangles cover one continuous surface, without gaps left by a grid.
// Split along the longest side, keeping station order stable within each group.
export function createStationMapLayout(stations, width, height) {
  if (!stations.length || width <= 0 || height <= 0) return [];
  const entries = stations.map((station, index) => ({ index, weight: 1 + Math.log2(1 + (station.items?.length || 0)) }));
  const result = [];
  function partition(group, x, y, w, h) {
    if (group.length === 1) {
      result.push({ index: group[0].index, x, y, width: w, height: h });
      return;
    }
    const total = group.reduce((sum, entry) => sum + entry.weight, 0);
    let accumulated = 0;
    let split = 1;
    let nearest = Infinity;
    let firstWeight = group[0].weight;
    for (let i = 1; i < group.length; i++) {
      accumulated += group[i - 1].weight;
      const distance = Math.abs(total / 2 - accumulated);
      if (distance < nearest) { nearest = distance; split = i; firstWeight = accumulated; }
    }
    const ratio = firstWeight / total;
    if (w >= h) {
      partition(group.slice(0, split), x, y, w * ratio, h);
      partition(group.slice(split), x + w * ratio, y, w * (1 - ratio), h);
    } else {
      partition(group.slice(0, split), x, y, w, h * ratio);
      partition(group.slice(split), x, y + h * ratio, w, h * (1 - ratio));
    }
  }
  partition(entries, 0, 0, width, height);
  return result.sort((a, b) => a.index - b.index);
}

// Panzoom scales both the tile and its translation around the viewport centre.
// Content can use this visible rectangle without letting its labels or objects
// disappear beyond the viewport when the containing tile grows larger than it.
export function projectStationTile(tile, viewportWidth, viewportHeight, { scale = 1, x = 0, y = 0 } = {}) {
  const transformedX = viewportWidth / 2 + (tile.x - viewportWidth / 2 + x) * scale;
  const transformedY = viewportHeight / 2 + (tile.y - viewportHeight / 2 + y) * scale;
  const clampX = (value) => Math.max(0, Math.min(viewportWidth, value));
  const clampY = (value) => Math.max(0, Math.min(viewportHeight, value));
  const left = clampX(transformedX);
  const top = clampY(transformedY);
  return {
    x: left,
    y: top,
    width: Math.max(0, clampX(transformedX + tile.width * scale) - left),
    height: Math.max(0, clampY(transformedY + tile.height * scale) - top)
  };
}

// Reveal objects when there is room to recognise them, independent of the
// zoom percentage. Reserve space for the station title and its opening action.
export function getStationPreviewCapacity(width, height, itemCount) {
  if (width < 100 || height < 100 || itemCount < 1) return 0;
  const columns = Math.max(1, Math.floor(width / 160));
  const rows = Math.max(1, Math.floor((height - 90) / 160));
  return Math.min(6, Math.floor(itemCount), columns * rows);
}

// A small exhibition should not require enormous magnification to show its
// previews. Larger exhibitions retain enough zoom to inspect their small tiles.
export function getStationMapMaxZoom(tiles, width, height) {
  const areas = tiles.map((tile) => tile.width * tile.height).filter((area) => area > 0);
  if (!areas.length || width <= 0 || height <= 0) return 1.5;
  const targetArea = Math.min(480, width * .9) * Math.min(360, height * .9);
  return Math.max(1.5, Math.min(6, Math.sqrt(targetArea / Math.min(...areas))));
}

// A pinch or drag must never also open the station under the released finger.
export function createStationMapGesture() {
  const pointers = new Map();
  let moved = false;
  return {
    start(id, x, y) {
      if (!pointers.size) moved = false;
      pointers.set(id, { x, y });
      if (pointers.size > 1) moved = true;
    },
    move(id, x, y) {
      const start = pointers.get(id);
      if (start && Math.hypot(x - start.x, y - start.y) > 6) moved = true;
    },
    end(id) { pointers.delete(id); },
    cancel() { pointers.clear(); moved = true; },
    canOpen() { return !moved; }
  };
}
