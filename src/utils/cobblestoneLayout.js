// Keep neighbouring topic objects in staggered rows, then justify each row
// using the source images' proportions, including the final incomplete row.
export function createCobblestoneLayout(stations, width, imageRatios = {}) {
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
      const ratio = imageRatios[`${stationIndex}:${itemIndex}`];
      rows.get(row).push({ stationIndex, itemIndex, ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9 });
    }
  });
  const tiles = [];
  let y = 16;
  for (const [row, entries] of [...rows.entries()].sort(([a], [b]) => a - b)) {
    const inset = row % 2 ? Math.min(64, width * .055) : 0;
    const availableWidth = width - 24 - inset;
    const height = (availableWidth - (entries.length - 1) * gap) / entries.reduce((sum, entry) => sum + entry.ratio, 0);
    let x = 12 + inset;
    for (const { ratio, ...entry } of entries) {
      tiles.push({ ...entry, x, y, width: height * ratio, height });
      x += height * ratio + gap;
    }
    y += height + gap;
  }
  return tiles.sort((a, b) => a.stationIndex - b.stationIndex || a.itemIndex - b.itemIndex);
}
