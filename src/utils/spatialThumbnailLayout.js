const round = (value) => Number(value.toFixed(2));
const positionOf = (item) => item?.thumbnailTransform?.position || [0, 0, .08];

export function createThumbnailLayout(items = [], preset = 'grid') {
  const count = items.length;
  if (!count) return {};
  const result = {};
  if (preset === 'circle') {
    const radiusX = Math.min(2.75, Math.max(1.35, count * .48));
    const radiusY = Math.min(1.75, Math.max(1.05, count * .3));
    items.forEach((item, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
      result[item.id] = [round(Math.cos(angle) * radiusX), round(.1 - Math.sin(angle) * radiusY), positionOf(item)[2]];
    });
    return result;
  }

  const columns = Math.min(4, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const gapX = Math.min(2.05, 6.2 / Math.max(1, columns - 1));
  const gapY = Math.min(2.15, 3.7 / Math.max(1, rows - 1));
  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    const entriesInRow = Math.min(columns, count - row * columns);
    const column = index % columns;
    const brickOffset = preset === 'brick' && row % 2 ? gapX * .42 : 0;
    const x = (column - (entriesInRow - 1) / 2) * gapX + brickOffset;
    const y = (rows - 1) * gapY / 2 - row * gapY;
    result[item.id] = [round(Math.max(-3.25, Math.min(3.25, x))), round(y), positionOf(item)[2]];
  });
  return result;
}

export function alignThumbnailSelection(items = [], selectedIds = [], action = 'left') {
  const selected = items.filter((item) => selectedIds.includes(item.id));
  if (selected.length < 2) return {};
  const coordinates = selected.map(positionOf);
  const xs = coordinates.map((position) => position[0]);
  const ys = coordinates.map((position) => position[1]);
  const result = {};
  const targetX = action === 'left' ? Math.min(...xs) : action === 'right' ? Math.max(...xs) : (Math.min(...xs) + Math.max(...xs)) / 2;
  const targetY = action === 'top' ? Math.max(...ys) : action === 'bottom' ? Math.min(...ys) : (Math.min(...ys) + Math.max(...ys)) / 2;

  if (action === 'distribute-horizontal' || action === 'distribute-vertical') {
    if (selected.length < 3) return {};
    const axis = action === 'distribute-horizontal' ? 0 : 1;
    const sorted = [...selected].sort((a, b) => positionOf(a)[axis] - positionOf(b)[axis]);
    const first = positionOf(sorted[0])[axis];
    const last = positionOf(sorted.at(-1))[axis];
    sorted.forEach((item, index) => {
      const position = [...positionOf(item)];
      position[axis] = round(first + ((last - first) * index) / (sorted.length - 1));
      result[item.id] = position;
    });
    return result;
  }

  selected.forEach((item) => {
    const position = [...positionOf(item)];
    if (['left', 'center-horizontal', 'right'].includes(action)) position[0] = round(targetX);
    if (['top', 'center-vertical', 'bottom'].includes(action)) position[1] = round(targetY);
    result[item.id] = position;
  });
  return result;
}
