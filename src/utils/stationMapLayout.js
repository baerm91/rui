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

// New previews divide an existing image. Even partial zoom steps fill the
// entire station; hidden previews never reserve empty grid cells.
export function createStationPreviewTree(count, width, height) {
  if (count < 1) return null;
  const root = { index: 0 };
  const leaves = [{ node: root, width, height }];
  for (let index = 1; index < count; index++) {
    leaves.sort((a, b) => b.width * b.height - a.width * a.height);
    const leaf = leaves.shift();
    const direction = leaf.width >= leaf.height ? 'row' : 'column';
    const first = { index: leaf.node.index };
    const second = { index };
    delete leaf.node.index;
    Object.assign(leaf.node, { direction, revealIndex: index, first, second });
    const nextWidth = leaf.width / (direction === 'row' ? 2 : 1);
    const nextHeight = leaf.height / (direction === 'column' ? 2 : 1);
    leaves.push({ node: first, width: nextWidth, height: nextHeight }, { node: second, width: nextWidth, height: nextHeight });
  }
  return root;
}

export function getStationMapDetail(scale) {
  const fade = (start, end) => Math.max(0, Math.min(1, (scale - start) / (end - start)));
  return {
    titleOpacity: fade(1.12, 1.7),
    previewCount: Math.min(6, Math.max(0, Math.ceil((scale - 2) / .85))),
    previewOpacities: Array.from({ length: 6 }, (_, index) => fade(2 + index * .85, 2.6 + index * .85))
  };
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
