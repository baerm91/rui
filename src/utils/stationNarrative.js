const clean = (value, maximum = 1200) => String(value ?? '').trim().slice(0, maximum);

export function normalizeNarrativeSteps(value, items = []) {
  const validItemIds = new Set((Array.isArray(items) ? items : []).map((item) => item?.id).filter(Boolean));
  return (Array.isArray(value) ? value : []).slice(0, 5).map((step, index) => ({
    id: clean(step?.id, 80) || `step_${index + 1}`,
    eyebrow: clean(step?.eyebrow, 80),
    title: clean(step?.title, 160) || `Moment ${index + 1}`,
    text: clean(step?.text, 1200),
    itemId: validItemIds.has(step?.itemId) ? step.itemId : ''
  }));
}
