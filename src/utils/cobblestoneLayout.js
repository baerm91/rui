// A readable, scrollable wall: five stones per row on desktop, fewer on mobile.
// Fill neighbouring rows first so a topic's objects form a connected cluster.
export function createCobblestoneLayout(stations, width) {
  if (width <= 24) return [];
  const columns = width < 560 ? 2 : width < 960 ? 3 : 5;
  const bandRows = columns === 2 ? 3 : 2;
  const capacity = columns * bandRows;
  const gap = width < 560 ? 10 : 16;
  const unit = (width - 24) / (columns + .35);
  const tileWidth = unit - gap;
  const tileHeight = tileWidth * .78 + 48;
  let cursor = 0;
  const tiles = [];
  stations.forEach((station, stationIndex) => {
    const count = Math.max(1, station.items?.length || 0);
    // Keep small topics within two or three rows at band boundaries, too.
    if (count <= 5 && cursor % capacity + count > capacity) cursor += capacity - cursor % capacity;
    for (let itemIndex = 0; itemIndex < count; itemIndex++, cursor++) {
      const band = Math.floor(cursor / capacity);
      const local = cursor % capacity;
      const row = band * bandRows + local % bandRows;
      const column = Math.floor(local / bandRows);
      tiles.push({ stationIndex, itemIndex, x: 12 + (column + (row % 2 ? .35 : 0)) * unit,
        y: 16 + row * (tileHeight + gap), width: tileWidth, height: tileHeight });
    }
  });
  return tiles;
}
