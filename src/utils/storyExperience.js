export function isRoomStory(story) {
  if (!story) return false;
  return story.settings?.experienceType === 'room' || !String(story.models?.primary || '').trim();
}

