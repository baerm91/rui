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
  if (import.meta.env.DEV && window.location.pathname === '/__effects-preview') {
    const [{ default: ScrollingStory }, { SPATIAL_DEMO_STORY }] = await Promise.all([
      import('./scrolling/ScrollingStory.jsx'),
      import('./exhibition/spatialDemo.js')
    ]);
    const rendererPresets = [
      ['cluster', 'pinned', 'Räumlicher Cluster'], ['orbit', 'normal', 'Umlaufbahn'], ['timeline', 'normal', 'Objekte in Folge'],
      ['freeform', 'horizontal', 'Horizontaler Rundgang'], ['grid', 'zoom', 'Zoom durch das Objekt'], ['cluster', 'camera-motion', 'Perspektivwechsel']
    ];
    const sourceItems = SPATIAL_DEMO_STORY.stations[0].items;
    const effectStations = rendererPresets.map(([layout, scroll, title], index) => {
      const items = sourceItems.map((item, itemIndex) => ({
        ...item,
        id: `renderer-${index}-${itemIndex}`,
        ...(index === 0 && itemIndex === 0 ? { modelUrl: 'https://sketchfab.com/models/8524a2cbf60944f6ab768655d91c5229', sourceType: 'sketchfab', thumbnailUrl: '', providerThumbnailUrl: '' } : {})
      }));
      return {
        ...SPATIAL_DEMO_STORY.stations[index % SPATIAL_DEMO_STORY.stations.length], id: `renderer-station-${index}`, title,
        introduction: `Diese Station demonstriert ${layout} mit dem Scrollmodus ${scroll}.`, description: `Diese Station demonstriert ${layout} mit dem Scrollmodus ${scroll}.`, items,
        behavior: { layout, entrance: index % 2 ? 'assemble' : 'from-darkness', scroll, interactions: { hoverTilt: true, objectFocus: true, connections: true, spotlight: index === 0, discoveryMode: false }, motion: { parallax: true, floating: layout !== 'timeline', magneticCursor: true, depthOfField: layout === 'cluster', clusterExplode: true, progressiveText: true }, atmosphere: { theme: index % 2 ? 'daylight' : 'ritual', particles: true, grain: index % 2 === 0, accent: index === 4 ? '#7f9fd1' : '#c99762' }, viewerTransition: 'morph' },
        initialItemId: items[0]?.id,
        narrativeSteps: items.map((item, itemIndex) => ({ id: `step-${index}-${itemIndex}`, eyebrow: `Moment 0${itemIndex + 1}`, title: item.title, text: item.description, itemId: item.id })),
        relations: items.slice(1).map((item, itemIndex) => ({ id: `relation-${index}-${itemIndex}`, fromItemId: items[0].id, toItemId: item.id, label: itemIndex ? 'Form und Erinnerung' : 'Materialwirkung' }))
      };
    });
    app = <ScrollingStory story={{ ...SPATIAL_DEMO_STORY, stations: effectStations }} />;
  } else if (import.meta.env.DEV && window.location.pathname === '/__scroll-preview') {
    const { default: ScrollingStory } = await import('./scrolling/ScrollingStory.jsx');
    app = <ScrollingStory story={{
      id: 'scroll-preview',
      name: 'Leere Station – Regressionstest',
      description: 'Diese Vorschau prüft eine Scrolling-Story ohne Titelbild und ohne Objekte.',
      stations: [{ id: 'empty-station', title: 'Auftakt', description: 'Das Kapitel rendert auch ohne ein zugewiesenes Objekt.', items: [] }]
    }} />;
  } else if (import.meta.env.DEV && window.location.pathname === '/__spatial-preview') {
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
