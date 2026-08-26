import { isRoomStory } from './utils/storyExperience.js';

const isExperienceRoute = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname)
  || window.location.pathname === '/edits';

let isRoomExperience = false;
if (isExperienceRoute && window.location.pathname !== '/edits') {
  const { getRouteStory, platformReady } = await import('./platform/platformStore.js');
  await platformReady;
  const routeStory = getRouteStory(window.location.pathname);
  isRoomExperience = isRoomStory(routeStory);
}

if (isExperienceRoute && !isRoomExperience) {
  await import('../main.js').catch((error) => {
    console.error('Der 3D-Viewer konnte nicht gestartet werden.', error);
    throw error;
  });
}

await import('./react-main.jsx');
