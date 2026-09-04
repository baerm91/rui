// Pack each theme down two or three staggered rows before moving sideways.
// Choose the band width that gives the largest readable stones in the viewport.
export function createCobblestoneLayout(stations, width, height) {
  const groups = stations.map((station, stationIndex) =>
    Array.from({ length: Math.max(1, station.items?.length || 0) }, (_, itemIndex) => ({ stationIndex, itemIndex })));
  const count = groups.reduce((sum, group) => sum + group.length, 0);
  if (!count || width <= 24 || height <= 24) return [];
  let best = null;
  for (const bandRows of [...new Set([Math.min(2, count), Math.min(3, count)])]) {
    const minimumColumns = Math.ceil(Math.min(6, Math.max(...groups.map((group) => group.length))) / bandRows);
    for (let columns = minimumColumns; columns <= count; columns++) {
      const capacity = columns * bandRows;
      let cursor = 0;
      const positions = [];
      for (const group of groups) {
        // Small themes stay within one band, even at a wrap boundary.
        if (group.length <= capacity && cursor % capacity + group.length > capacity) cursor += capacity - cursor % capacity;
        for (const entry of group) {
          const band = Math.floor(cursor / capacity);
          const local = cursor % capacity;
          positions.push({ ...entry, row: band * bandRows + local % bandRows, column: Math.floor(local / bandRows) });
          cursor++;
        }
      }
      const rows = Math.max(...positions.map((entry) => entry.row)) + 1;
      const unit = Math.min((width - 24) / (columns + (rows > 1 ? .45 : 0)), (height - 24) / rows * 1.5);
      if (!best || unit > best.unit) best = { positions, columns, rows, unit };
    }
  }
  const { positions, columns, rows, unit } = best;
  const gap = Math.min(8, unit * .1);
  const cellHeight = unit / 1.5;
  const offsetX = (width - (columns + (rows > 1 ? .45 : 0)) * unit + gap) / 2;
  const offsetY = (height - rows * cellHeight + gap) / 2;
  return positions.map(({ row, column, ...entry }) => ({ ...entry,
    x: offsetX + (column + (row % 2 ? .45 : 0)) * unit,
    y: offsetY + row * cellHeight, width: unit - gap, height: cellHeight - gap }));
}
