const clean = (value, maximum = 500) => String(value || '').trim().slice(0, maximum);

export function normalizeStationRelations(relations, items = []) {
  const itemIds = new Set((Array.isArray(items) ? items : []).map((item) => item?.id).filter(Boolean));
  const seen = new Set();
  return (Array.isArray(relations) ? relations : []).flatMap((relation, index) => {
    const fromItemId = clean(relation?.fromItemId, 80);
    const toItemId = clean(relation?.toItemId, 80);
    if (!fromItemId || !toItemId || fromItemId === toItemId || !itemIds.has(fromItemId) || !itemIds.has(toItemId)) return [];
    const pairKey = [fromItemId, toItemId].sort().join('::');
    if (seen.has(pairKey)) return [];
    seen.add(pairKey);
    return [{
      id: clean(relation?.id, 80) || `relation_${index + 1}`,
      fromItemId,
      toItemId,
      label: clean(relation?.label, 120),
      description: clean(relation?.description, 1000)
    }];
  });
}
