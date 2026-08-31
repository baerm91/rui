const placeholderPattern = /^(annotation|station|objekt|object)(\s+\d+)?$|blablabla|lorem ipsum/i;

const hasText = (value) => String(value || '').trim().length > 0;

function issue(code, severity, message, location) {
  return { code, severity, message, location };
}

export function auditStoryReadiness({ project = {}, stations = [], annotations = [], spatialMode = false } = {}) {
  const findings = [];
  const normalizedStations = Array.isArray(stations) ? stations.filter(Boolean) : [];

  if (!hasText(project.name)) findings.push(issue('story-name', 'error', 'Die Story braucht einen Titel.', 'Story'));
  if (!hasText(project.description)) findings.push(issue('story-description', 'warning', 'Eine verständliche Kurzbeschreibung oder 2D-Einordnung fehlt.', 'Story'));
  if (normalizedStations.length === 0) findings.push(issue('stations-empty', 'error', 'Mindestens eine Station ist erforderlich.', 'Story'));

  normalizedStations.forEach((station, stationIndex) => {
    const location = `Station ${stationIndex + 1}`;
    if (!hasText(station.title)) findings.push(issue('station-title', 'error', 'Der Stationstitel fehlt.', location));
    if (!hasText(station.description || station.introduction)) {
      findings.push(issue('station-description', 'warning', 'Eine interpretierende Beschreibung fehlt.', location));
    }

    const camera = spatialMode ? station.spatial?.camera : station;
    if (!camera?.position && !camera?.cameraPos && !station.cameraPos) {
      findings.push(issue('station-camera', 'warning', 'Es ist keine ausdrückliche Einstiegsansicht erkennbar.', location));
    }

    if (spatialMode) {
      const items = Array.isArray(station.items) ? station.items : [];
      if (items.length === 0) findings.push(issue('station-items', 'error', 'Die räumliche Station enthält kein Objekt.', location));
      items.forEach((item, itemIndex) => {
        const itemLocation = `${location} · Objekt ${itemIndex + 1}`;
        if (!hasText(item.modelUrl)) findings.push(issue('item-model', 'error', 'Die Modellquelle fehlt.', itemLocation));
        if (!hasText(item.description)) findings.push(issue('item-description', 'warning', 'Die Bedeutung des Objekts wird nicht beschrieben.', itemLocation));
        if (!hasText(item.attribution) || !hasText(item.license)) {
          findings.push(issue('item-rights', 'warning', 'Urheber- oder Lizenzangabe ist unvollständig.', itemLocation));
        }
      });
    }

    if (hasText(station.videoUrl) && !hasText(station.videoTranscript)) {
      findings.push(issue('video-transcript', 'warning', 'Für das Video fehlt ein Transkript.', location));
    }
  });

  (Array.isArray(annotations) ? annotations : []).filter(Boolean).forEach((annotation, index) => {
    const location = `Annotation ${index + 1}`;
    if (!hasText(annotation.title) || placeholderPattern.test(String(annotation.title).trim())) {
      findings.push(issue('annotation-title', 'warning', 'Die Annotation hat noch keinen aussagekräftigen Titel.', location));
    }
    if (!hasText(annotation.text) || placeholderPattern.test(String(annotation.text).trim())) {
      findings.push(issue('annotation-text', 'warning', 'Die Annotation enthält noch keine belastbare Erklärung.', location));
    }
  });

  const errors = findings.filter((finding) => finding.severity === 'error').length;
  const warnings = findings.length - errors;
  return { findings, errors, warnings, ready: errors === 0 };
}
