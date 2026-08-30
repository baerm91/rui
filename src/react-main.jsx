import React from 'react';
import { createRoot } from 'react-dom/client';
import './fonts.css';
import './platform/platform.css';
import { loadExperienceUi } from './experienceModules.js';
import { ensureSeedStories, getRouteStory, platformReady, saveStory } from './platform/platformStore.js';
import { getExperienceAccess } from './platform/experienceAccess.js';
import { isRoomStory } from './utils/storyExperience.js';

await platformReady;
ensureSeedStories();
const isExperiencePath = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname);
const routeStory = isExperiencePath ? getRouteStory(window.location.pathname) : null;
const isRoomExperience = isRoomStory(routeStory);
const usesModelViewer = isExperiencePath && !isRoomExperience;
document.documentElement.classList.toggle('experience-page', usesModelViewer);
document.documentElement.classList.toggle('platform-page', !usesModelViewer);
document.body.classList.toggle('experience-page', usesModelViewer);
document.body.classList.toggle('platform-page', !usesModelViewer);
if (!usesModelViewer) document.title = 'RIU — Räumliche Geschichten';

const rootElement = document.getElementById('react-root');
if (rootElement) {
  let app;
  if (import.meta.env.DEV && window.location.pathname === '/__spatial-preview') {
    const [{ default: ExhibitionRoom }, { SPATIAL_DEMO_STORY }] = await Promise.all([
      import('./exhibition/ExhibitionRoom.jsx'),
      import('./exhibition/spatialDemo.js')
    ]);
    const initialMode = new URLSearchParams(window.location.search).get('mode') === 'visitor' ? 'visitor' : 'editor';
    app = <ExhibitionRoom story={SPATIAL_DEMO_STORY} initialMode={initialMode} backHref="/" onSaveStory={() => Promise.resolve()} />;
  } else if (!isExperiencePath) {
    const { default: PlatformApp } = await import('./platform/PlatformApp.jsx');
    app = <PlatformApp />;
  } else {
    const access = getExperienceAccess();
    if (!access.allowed) {
      window.location.replace(access.isEditor && !access.session ? '/login' : '/');
    } else if (isRoomStory(access.story)) {
      const { default: ScrollingStory } = await import('./scrolling/ScrollingStory.jsx');
      app = (
        <ScrollingStory
          story={access.story}
          initialMode={access.isEditor ? 'editor' : 'visitor'}
          backHref={access.isEditor ? '/dashboard' : '/discover'}
          onSaveStory={saveStory}
        />
      );
    } else {
      const { ExperienceApp } = await loadExperienceUi();
      app = (
        <ExperienceApp
          storyAuthorId={access.story.ownerId}
          hasInitialStoryPreview={!!access.story.previewVideoAssetId}
          initialPreviewEndStation={access.story.previewEndStationNumber || 2}
          storyAuthorName={access.story.authorName}
          storyEditors={access.editors}
          storyId={access.story.id}
          storyModelUrl={access.story.models?.primary}
          viewerId={access.isEditor ? access.story.ownerId : access.session?.id}
          analyticsEnabled={!access.isEditor && access.story.status === 'published'}
        />
      );
    }
  }
  if (app) createRoot(rootElement).render(app);
}
