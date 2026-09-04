// Keep neighbouring topic objects in staggered rows, then justify each row
// using the source images' proportions, including the final incomplete row.
export function createCobblestoneLayout(stations, width) {
  if (width <= 24) return [];
  const columns = width < 560 ? 2 : width < 960 ? 3 : 5;
  const bandRows = columns === 2 ? 3 : 2;
  const capacity = columns * bandRows;
  const gap = width < 560 ? 6 : 8;
  const rows = new Map();
  let cursor = 0;
  stations.forEach((station, stationIndex) => {
    const count = Math.max(1, station.items?.length || 0);
    if (count <= 5 && cursor % capacity + count > capacity) cursor += capacity - cursor % capacity;
    for (let itemIndex = 0; itemIndex < count; itemIndex++, cursor++) {
      const row = Math.floor(cursor / capacity) * bandRows + cursor % bandRows;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row).push({ stationIndex, itemIndex });
    }
  });
  const tiles = [];
  const stagger = Math.min(64, width * .055);
  const tileWidth = (width - 24 - stagger - (columns - 1) * gap) / columns;
  const height = tileWidth * 9 / 16;
  let y = 16;
  for (const [row, entries] of [...rows.entries()].sort(([a], [b]) => a - b)) {
    const rowWidth = entries.length * tileWidth + (entries.length - 1) * gap;
    let x = (width - stagger - rowWidth) / 2 + (row % 2 ? stagger : 0);
    for (const entry of entries) {
      tiles.push({ ...entry, x, y, width: tileWidth, height });
      x += tileWidth + gap;
    }
    y += height + gap;
  }
  return tiles.sort((a, b) => a.stationIndex - b.stationIndex || a.itemIndex - b.itemIndex);
}
