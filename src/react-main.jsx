import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './platform/platform.css';
import { ensureSeedStories, getRouteStory, platformReady } from './platform/platformStore.js';
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
  createRoot(rootElement).render(<App />);
}
