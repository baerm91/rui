export function filterOwnedStories(stories, userId) {
  if (!userId) return [];
  return (stories || []).filter((story) => story.ownerId === userId);
}
