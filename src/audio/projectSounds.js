export const BUILTIN_PROJECT_SOUNDS = [
  { id: 'builtin-wind', name: 'Wind', source: 'builtin', url: '/audio/ambience/wind.ogg', volume: 0.35 },
  { id: 'builtin-rain', name: 'Regen', source: 'builtin', url: '/audio/ambience/rain.ogg', volume: 0.32 },
  {
    id: 'builtin-wood',
    name: 'Knarzendes Holz',
    source: 'builtin',
    mode: 'random',
    urls: ['/audio/ambience/wood-squeak-01.ogg', '/audio/ambience/wood-squeak-02.ogg', '/audio/ambience/wood-crack-01.ogg'],
    volume: 0.45
  },
  { id: 'builtin-fire', name: 'Feuer & Knistern', source: 'builtin', url: '/audio/ambience/fireplace.ogg', volume: 0.34 },
  { id: 'builtin-night', name: 'Nacht & Grillen', source: 'builtin', url: '/audio/ambience/crickets.mp3', volume: 0.28 },
  { id: 'builtin-drone', name: 'Dunkle Atmosphäre', source: 'builtin', url: '/audio/ambience/dark-atmosphere.ogg', volume: 0.25 },
  { id: 'builtin-snow', name: 'Schneesturm', source: 'builtin', url: '/audio/ambience/snow-wind.ogg', volume: 0.3 },
  {
    id: 'builtin-thunder',
    name: 'Gewitter mit Blitzen',
    source: 'builtin',
    mode: 'thunder',
    url: '/audio/ambience/rain.ogg',
    thunderUrl: '/audio/ambience/thunderstorm.ogg',
    volume: 0.34
  }
];

const cleanStationIds = (value) => Array.isArray(value)
  ? [...new Set(value.filter((id) => typeof id === 'string' && id))]
  : [];

export function normalizeProjectAudio(audio = {}) {
  const customSounds = Array.isArray(audio.customSounds)
    ? audio.customSounds.filter((sound) => sound?.id && (sound?.url || sound?.storageKey)).map((sound) => ({
      id: String(sound.id),
      name: String(sound.name || 'Eigener Sound'),
      source: 'custom',
      url: String(sound.url || ''),
      storageKey: String(sound.storageKey || ''),
      mimeType: String(sound.mimeType || '')
    }))
    : [];
  const validIds = new Set([...BUILTIN_PROJECT_SOUNDS, ...customSounds].map((sound) => sound.id));
  const assignments = {};
  Object.entries(audio.assignments && typeof audio.assignments === 'object' ? audio.assignments : {})
    .forEach(([soundId, assignment]) => {
      if (!validIds.has(soundId)) return;
      assignments[soundId] = {
        all: !!assignment?.all,
        stationIds: cleanStationIds(assignment?.stationIds),
        intensity: Number.isFinite(Number(assignment?.intensity))
          ? Math.max(0, Math.min(200, Number(assignment.intensity)))
          : 100,
        dynamics: Number.isFinite(Number(assignment?.dynamics))
          ? Math.max(0, Math.min(200, Number(assignment.dynamics)))
          : 100
      };
    });
  return { customSounds, assignments };
}

export function getProjectSounds(audio) {
  const normalized = normalizeProjectAudio(audio);
  return [...BUILTIN_PROJECT_SOUNDS, ...normalized.customSounds];
}

export function getActiveProjectSounds(audio, stationId) {
  const normalized = normalizeProjectAudio(audio);
  return getProjectSounds(normalized).filter((sound) => {
    const assignment = normalized.assignments[sound.id];
    return !!assignment && (assignment.all || assignment.stationIds.includes(stationId));
  }).map((sound) => ({
    ...sound,
    intensity: normalized.assignments[sound.id]?.intensity ?? 100,
    dynamics: normalized.assignments[sound.id]?.dynamics ?? 100
  }));
}
