const isExperienceRoute = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname)
  || window.location.pathname === '/edits';

if (isExperienceRoute) {
  await import('../main.js').catch((error) => {
    console.error('Der 3D-Viewer konnte nicht gestartet werden.', error);
    throw error;
  });
}

await import('./react-main.jsx');
