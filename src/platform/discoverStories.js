export function getPublishedDiscoverStories(stories) {
  return (Array.isArray(stories) ? stories : []).filter((story) => story?.status === 'published');
}

export function getRandomFeaturedDiscoverStoryId(stories, random = Math.random) {
  const candidates = Array.isArray(stories) ? stories.filter((story) => story?.id) : [];
  if (!candidates.length) return '';
  const randomValue = Number(random?.());
  const normalized = Number.isFinite(randomValue) ? Math.max(0, Math.min(.999999999, randomValue)) : 0;
  return candidates[Math.floor(normalized * candidates.length)].id;
}
