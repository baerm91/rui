const clean = (value) => String(value || '').trim();

export function resolveLoadingFailureContent(config = {}, error) {
  const project = config.project || config;
  const firstStation = Array.isArray(config.stations) ? config.stations[0] : project.stations?.[0];
  const title = clean(project.branding?.title || project.name) || 'RIU Story';
  const summary = clean(project.description || project.branding?.subtitle || firstStation?.introduction || firstStation?.description)
    || 'Die 3D-Ansicht ist momentan nicht verfügbar. Die Story kann später erneut geöffnet werden.';
  const rights = clean(project.metadata?.license || project.license);
  const coverImage = clean(project.coverImage);
  const technicalMessage = clean(error?.message || error);

  return { title, summary, rights, coverImage, technicalMessage };
}

export function showLoadingFailure(config, error, {
  documentRef = globalThis.document,
  windowRef = globalThis.window
} = {}) {
  if (!documentRef) return;
  const content = resolveLoadingFailureContent(config, error);
  const screen = documentRef.getElementById('loading-screen');
  const loadingState = documentRef.querySelector('.loading-state');
  const failure = documentRef.getElementById('loading-failure');
  if (!failure) return;

  screen?.classList.add('has-loading-failure');
  if (loadingState) loadingState.hidden = true;
  failure.hidden = false;
  Array.from(documentRef.body?.children || []).forEach((element) => {
    if (element === screen || element.tagName === 'SCRIPT') return;
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
  });

  const setText = (id, value) => {
    const element = documentRef.getElementById(id);
    if (element) element.textContent = value;
  };
  setText('loading-failure-title', content.title);
  setText('loading-failure-summary', content.summary);
  setText('loading-failure-rights', content.rights ? `Quelle und Rechte: ${content.rights}` : 'Quellen- und Rechteangaben sind für diese Story noch nicht hinterlegt.');
  setText('loading-failure-detail', content.technicalMessage || 'Das 3D-Modell konnte nicht geladen werden.');

  const poster = documentRef.getElementById('loading-failure-poster');
  if (poster) {
    poster.hidden = !content.coverImage;
    poster.src = content.coverImage;
    poster.alt = content.coverImage ? `Vorschaubild zu „${content.title}“` : '';
  }

  const retry = documentRef.getElementById('loading-failure-retry');
  if (retry && !retry.dataset.bound) {
    retry.dataset.bound = 'true';
    retry.addEventListener('click', () => windowRef?.location?.reload());
  }
  documentRef.getElementById('loading-failure-heading')?.focus();
}
