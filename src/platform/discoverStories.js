export function getPublishedDiscoverStories(stories) {
  return (Array.isArray(stories) ? stories : []).filter((story) => story?.status === 'published');
}

