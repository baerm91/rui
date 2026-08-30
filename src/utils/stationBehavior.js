export const STATION_BEHAVIOR_OPTIONS = Object.freeze({
  layout: ['grid', 'cluster', 'orbit', 'timeline', 'freeform'],
  entrance: ['fade', 'rise', 'scatter', 'from-darkness', 'assemble'],
  scroll: ['normal', 'pinned', 'horizontal', 'zoom', 'camera-motion'],
  viewerTransition: ['morph', 'zoom', 'fade'],
  atmosphere: ['ritual', 'daylight', 'nocturne', 'archive', 'network'],
  stationTransition: ['veil', 'crossfade', 'light-shift', 'none']
});

export const DEFAULT_STATION_BEHAVIOR = Object.freeze({
  layout: 'cluster',
  entrance: 'from-darkness',
  scroll: 'pinned',
  interactions: Object.freeze({
    hoverTilt: true,
    objectFocus: true,
    connections: true,
    spotlight: false,
    discoveryMode: false
  }),
  motion: Object.freeze({
    parallax: true,
    floating: true,
    magneticCursor: true,
    depthOfField: true,
    clusterExplode: true,
    progressiveText: true
  }),
  atmosphere: Object.freeze({
    theme: 'ritual',
    particles: true,
    grain: true,
    accent: '#c99762'
  }),
  viewerTransition: 'morph',
  stationTransition: 'veil'
});

const enumValue = (value, choices, fallback) => choices.includes(value) ? value : fallback;

export function normalizeStationBehavior(value) {
  const source = value && typeof value === 'object' ? value : {};
  const interactions = source.interactions && typeof source.interactions === 'object' ? source.interactions : {};
  const motion = source.motion && typeof source.motion === 'object' ? source.motion : {};
  const atmosphere = source.atmosphere && typeof source.atmosphere === 'object' ? source.atmosphere : {};
  const accent = /^#[0-9a-f]{6}$/i.test(String(atmosphere.accent || '')) ? atmosphere.accent : DEFAULT_STATION_BEHAVIOR.atmosphere.accent;
  return {
    layout: enumValue(source.layout, STATION_BEHAVIOR_OPTIONS.layout, DEFAULT_STATION_BEHAVIOR.layout),
    entrance: enumValue(source.entrance, STATION_BEHAVIOR_OPTIONS.entrance, DEFAULT_STATION_BEHAVIOR.entrance),
    scroll: enumValue(source.scroll, STATION_BEHAVIOR_OPTIONS.scroll, DEFAULT_STATION_BEHAVIOR.scroll),
    interactions: {
      hoverTilt: typeof interactions.hoverTilt === 'boolean' ? interactions.hoverTilt : DEFAULT_STATION_BEHAVIOR.interactions.hoverTilt,
      objectFocus: typeof interactions.objectFocus === 'boolean' ? interactions.objectFocus : DEFAULT_STATION_BEHAVIOR.interactions.objectFocus,
      connections: typeof interactions.connections === 'boolean' ? interactions.connections : DEFAULT_STATION_BEHAVIOR.interactions.connections,
      spotlight: typeof interactions.spotlight === 'boolean' ? interactions.spotlight : DEFAULT_STATION_BEHAVIOR.interactions.spotlight,
      discoveryMode: typeof interactions.discoveryMode === 'boolean' ? interactions.discoveryMode : DEFAULT_STATION_BEHAVIOR.interactions.discoveryMode
    },
    motion: Object.fromEntries(Object.entries(DEFAULT_STATION_BEHAVIOR.motion).map(([name, fallback]) => [name, typeof motion[name] === 'boolean' ? motion[name] : fallback])),
    atmosphere: {
      theme: enumValue(atmosphere.theme, STATION_BEHAVIOR_OPTIONS.atmosphere, DEFAULT_STATION_BEHAVIOR.atmosphere.theme),
      particles: typeof atmosphere.particles === 'boolean' ? atmosphere.particles : DEFAULT_STATION_BEHAVIOR.atmosphere.particles,
      grain: typeof atmosphere.grain === 'boolean' ? atmosphere.grain : DEFAULT_STATION_BEHAVIOR.atmosphere.grain,
      accent
    },
    viewerTransition: enumValue(source.viewerTransition, STATION_BEHAVIOR_OPTIONS.viewerTransition, DEFAULT_STATION_BEHAVIOR.viewerTransition),
    stationTransition: enumValue(source.stationTransition, STATION_BEHAVIOR_OPTIONS.stationTransition, DEFAULT_STATION_BEHAVIOR.stationTransition)
  };
}

export function getStationRendererDescriptor(value) {
  const behavior = normalizeStationBehavior(value);
  const pin = ['pinned', 'horizontal', 'zoom', 'camera-motion'].includes(behavior.scroll);
  const distance = behavior.scroll === 'horizontal' ? 2.2 : behavior.scroll === 'zoom' ? 2 : behavior.scroll === 'camera-motion' ? 1.9 : behavior.scroll === 'pinned' ? 1.65 : 1.15;
  return {
    layoutClass: `stage-scene-${behavior.layout}`,
    scrollClass: `stage-scroll-${behavior.scroll}`,
    motionClass: behavior.motion.parallax ? 'motion-parallax' : 'motion-static',
    pin,
    distance
  };
}
