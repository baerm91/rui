export const getStoryCreatedAt = (story = {}) => (
  story.createdAt || story.publishedAt || story.updatedAt || null
);

export const getStoryPublishedAt = (story = {}) => (
  story.status === 'published'
    ? (story.publishedAt || story.updatedAt || story.createdAt || null)
    : null
);
