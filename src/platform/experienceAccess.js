import {
  canEditStory,
  getStory,
  getStoryEditors,
  getStoryPermission,
  readSession
} from './platformStore.js';

export function getExperienceAccess(pathname = window.location.pathname) {
  const story = getStory(pathname.split('/')[2] || '');
  const session = readSession();
  const isEditor = pathname.startsWith('/studio/');
  const allowed = !!story && (isEditor
    ? canEditStory(story, session?.id)
    : story.status === 'published' || !!getStoryPermission(story, session?.id));
  return { story, session, isEditor, allowed, editors: getStoryEditors(story) };
}
