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
    const effectStations = SPATIAL_DEMO_STORY.stations.map((station, index) => ({
      ...station,
      items: station.items.map((item, itemIndex) => index === 0 && itemIndex === 0 ? {
        ...item,
        modelUrl: 'https://sketchfab.com/models/8524a2cbf60944f6ab768655d91c5229',
        sourceType: 'sketchfab',
        thumbnailUrl: '',
        providerThumbnailUrl: ''
      } : item),
      behavior: { layout: index === 0 ? 'cluster' : 'orbit', entrance: 'from-darkness', scroll: index === 0 ? 'pinned' : 'normal', interactions: { hoverTilt: true, objectFocus: true, connections: true, spotlight: index === 0, discoveryMode: false }, atmosphere: { theme: index === 0 ? 'ritual' : index === 1 ? 'daylight' : 'nocturne', particles: true, grain: index !== 1, accent: index === 2 ? '#7f9fd1' : '#c99762' }, viewerTransition: 'morph' },
      narrativeSteps: index === 0 ? [
        { id: 'surface', eyebrow: 'Lesart 01', title: 'Oberfläche als Spur', text: 'Gebrauch und Zeit schreiben sich in Material ein.', itemId: station.items[0]?.id },
        { id: 'translation', eyebrow: 'Lesart 02', title: 'Digital übersetzt', text: 'Licht und Textur machen diese Spuren neu lesbar.', itemId: station.items[1]?.id },
        { id: 'memory', eyebrow: 'Lesart 03', title: 'Erinnerung wird Beziehung', text: 'Erst im Vergleich entsteht eine gemeinsame Geschichte.', itemId: station.items[2]?.id }
      ] : [],
      relations: index === 0 ? [
        { id: 'material', fromItemId: station.items[0]?.id, toItemId: station.items[1]?.id, label: 'Materialwirkung', description: 'Oberflächen lassen Gebrauch, Alterung und digitale Rekonstruktion unterschiedlich lesbar werden.' },
        { id: 'form', fromItemId: station.items[0]?.id, toItemId: station.items[2]?.id, label: 'Form und Erinnerung', description: 'Die Silhouette verbindet sehr verschiedene Objekte zu einer gemeinsamen Erzählung über Bewahrung.' }
      ] : []
    }));
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
