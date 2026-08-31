// Weighted rectangles cover one continuous surface, without gaps left by a grid.
// Alternate split directions to form a mosaic rather than a single strip.
// Keep both the partition tree and station order stable while zooming.
export function createStationMapLayout(stations, width, height, focus = {}) {
  if (!stations.length || width <= 0 || height <= 0) return [];
  // Model counts determine area directly. Empty stations retain a small,
  // selectable tile without receiving as much space as populated stations.
  const entries = stations.map((station, index) => ({ index, weight: Math.max(.5, station.items?.length || 0) }));
  const progress = Math.max(0, Math.min(1, focus.progress || 0));
  const selected = entries[focus.focusIndex];
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  // At full detail, the chosen station gets up to 78% of the surface. Keep
  // the original partition tree and split directions so neighbours never jump.
  const baseShare = selected ? selected.weight / totalWeight : 0;
  const share = baseShare + Math.max(0, .78 - baseShare) * progress;
  const extraWeight = selected && progress > 0 && baseShare < .78 && share < 1 ? Math.max(0, (totalWeight - selected.weight) * share / (1 - share) - selected.weight) : 0;
  entries.forEach((entry) => { entry.areaWeight = entry.weight + (entry === selected ? extraWeight : 0); });
  const result = [];
  function partition(group, x, y, w, h, splitVertically) {
    if (group.length === 1) {
      result.push({ index: group[0].index, x, y, width: w, height: h });
      return;
    }
    const total = group.reduce((sum, entry) => sum + entry.weight, 0);
    let accumulated = 0;
    let split = 1;
    let nearest = Infinity;
    for (let i = 1; i < group.length; i++) {
      accumulated += group[i - 1].weight;
      const distance = Math.abs(total / 2 - accumulated);
      if (distance < nearest) { nearest = distance; split = i; }
    }
    const first = group.slice(0, split);
    const second = group.slice(split);
    const ratio = first.reduce((sum, entry) => sum + entry.areaWeight, 0) / group.reduce((sum, entry) => sum + entry.areaWeight, 0);
    if (splitVertically) {
      partition(first, x, y, w * ratio, h, false);
      partition(second, x + w * ratio, y, w * (1 - ratio), h, false);
    } else {
      partition(first, x, y, w, h * ratio, true);
      partition(second, x, y + h * ratio, w, h * (1 - ratio), true);
    }
  }
  partition(entries, 0, 0, width, height, width >= height);
  return result.sort((a, b) => a.index - b.index);
}

export function getSemanticPreviewCount(itemCount, progress = 0, { width = 0, height = 0 } = {}) {
  if (itemCount < 1) return 0;
  // Show a small collection immediately when the tile has room for legible
  // previews. Reserve some height for its caption; never pack tiny tiles.
  const columns = Math.max(0, Math.floor((width - 6) / 150));
  const rows = Math.max(0, Math.floor((height - 50) / 150));
  const overviewCount = Math.min(itemCount, 4, Math.max(1, columns * rows));
  const detail = Math.max(0, Math.min(1, progress));
  return Math.min(itemCount, overviewCount + Math.floor(detail * (itemCount - overviewCount)));
}

// Arrange image rectangles in balanced, justified rows. Aspect ratios influence
// widths; each row meets both edges and no incomplete last row leaves a hole.
export function createImageMosaicLayout(ratios, width, height) {
  if (!ratios.length || width <= 0 || height <= 0) return [];
  const normalized = ratios.map((ratio) => Number.isFinite(ratio) && ratio > 0 ? Math.max(.4, Math.min(3, ratio)) : 1);
  const total = normalized.reduce((sum, ratio) => sum + ratio, 0);
  const rowCount = Math.min(ratios.length, Math.max(1, Math.round(Math.sqrt(total * height / width))));
  const rows = [];
  let start = 0;
  let remaining = total;
  for (let row = 0; row < rowCount; row++) {
    const rowsLeft = rowCount - row;
    const target = remaining / rowsLeft;
    let end = start + 1;
    let sum = normalized[start];
    while (end < normalized.length - rowsLeft + 1 && (rowsLeft === 1 || Math.abs(sum + normalized[end] - target) < Math.abs(sum - target))) sum += normalized[end++];
    rows.push({ start, end, sum });
    start = end;
    remaining -= sum;
  }
  const naturalHeight = rows.reduce((sum, row) => sum + width / row.sum, 0);
  const result = [];
  let y = 0;
  for (const row of rows) {
    const rowHeight = width / row.sum * height / naturalHeight;
    let x = 0;
    for (let index = row.start; index < row.end; index++) {
      const tileWidth = width * normalized[index] / row.sum;
      result.push({ index, x, y, width: tileWidth, height: rowHeight });
      x += tileWidth;
    }
    y += rowHeight;
  }
  return result;
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
