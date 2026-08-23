import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './platform/platform.css';
import { ensureSeedStories, platformReady } from './platform/platformStore.js';

await platformReady;
ensureSeedStories();
const isExperiencePath = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname);
document.documentElement.classList.toggle('experience-page', isExperiencePath);
document.documentElement.classList.toggle('platform-page', !isExperiencePath);
document.body.classList.toggle('experience-page', isExperiencePath);
document.body.classList.toggle('platform-page', !isExperiencePath);
if (!isExperiencePath) document.title = 'RIU — Räumliche Geschichten';

const rootElement = document.getElementById('react-root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
