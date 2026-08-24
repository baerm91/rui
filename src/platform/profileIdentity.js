export function applyProfileIdentityToStories(stories, {
  userId,
  previousName,
  name,
  username,
  updatedAt
}) {
  const displayNameChanged = name !== previousName;

  return (stories || []).map((story) => ({
    ...story,
    ...(displayNameChanged && story.ownerId === userId
      ? { authorName: name, updatedAt }
      : {}),
    collaborators: Array.isArray(story.collaborators)
      ? story.collaborators.map((collaborator) => collaborator.userId === userId
        ? { ...collaborator, name, username }
        : collaborator)
      : []
  }));
}

export function getOwnedProfileStoryUpdates(stories, {
  userId,
  previousName,
  name,
  canWriteStories
}) {
  if (!canWriteStories || name === previousName) return [];
  return (stories || []).filter((story) => story.ownerId === userId);
}
