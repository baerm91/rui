// Fill every row before the last while keeping neighbouring topic objects
// together across staggered rows. Every stone uses the same dimensions.
export function createCobblestoneLayout(stations, width) {
  if (width <= 24) return [];
  const columns = width < 560 ? 2 : width < 960 ? 3 : 5;
  const bandRows = columns === 2 ? 3 : 2;
  const capacity = columns * bandRows;
  const gap = width < 560 ? 6 : 8;
  const entries = stations.flatMap((station, stationIndex) =>
    Array.from({ length: Math.max(1, station.items?.length || 0) }, (_, itemIndex) => ({ stationIndex, itemIndex }))
  );
  const rows = new Map();
  for (let start = 0; start < entries.length; start += capacity) {
    const count = Math.min(capacity, entries.length - start);
    let cursor = start;
    for (let column = 0; column < columns; column++) {
      for (let offset = 0; offset < bandRows; offset++) {
        const rowLength = Math.min(columns, Math.max(0, count - offset * columns));
        if (column >= rowLength) continue;
        const row = start / capacity * bandRows + offset;
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(entries[cursor++]);
      }
    }
  }
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
