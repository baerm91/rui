import { isRoomStory } from './utils/storyExperience.js';
import { loadExperienceUi } from './experienceModules.js';

const isExperienceRoute = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname);

if (isExperienceRoute) await import('../style.css');

let isRoomExperience = false;
if (isExperienceRoute) {
  const { getRouteStory, platformReady } = await import('./platform/platformStore.js');
  await platformReady;
  const routeStory = getRouteStory(window.location.pathname);
  isRoomExperience = isRoomStory(routeStory);
}

if (isExperienceRoute && !isRoomExperience) {
  await Promise.all([import('../main.js'), loadExperienceUi()]).catch((error) => {
    console.error('Der 3D-Viewer konnte nicht gestartet werden.', error);
    throw error;
  });
}

await import('./react-main.jsx');
