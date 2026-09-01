export function isRoomStory(story) {
  if (!story) return false;
  return story.settings?.experienceType === 'room' || !String(story.models?.primary || '').trim();
}

export function getStoryExperienceKind(story) {
  return isRoomStory(story) ? 'exhibition' : 'tour';
}

export function getStoryExperienceLabel(story) {
  return getStoryExperienceKind(story) === 'exhibition' ? 'Ausstellung' : 'Führung';
}

export function filterStoriesByExperienceKind(stories, kind = '') {
  const list = Array.isArray(stories) ? stories : [];
  return kind ? list.filter((story) => getStoryExperienceKind(story) === kind) : list;
}
