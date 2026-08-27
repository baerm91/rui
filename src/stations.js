import bundledStations from '../heidentor-stations.json' with { type: 'json' };
import { siteConfig } from './site.config.js';
import { preserveDistinctAnnotations } from './utils/annotationIdentity.js';
import { findCrossStoryStationSource, getRouteStory, platformReady, readStories } from './platform/platformStore.js';
import { normalizeSpatialItems, normalizeSpatialStation, normalizeThumbnailGridSpacing, normalizeThumbnailLayout, resolveSpatialInitialItemId } from './utils/spatialStory.js';

const STATIONS_DRAFT_KEY = `${siteConfig.storagePrefix}_custom_stations`;
export const getStationsDraftKey = (projectId = '') => (
  projectId ? `${STATIONS_DRAFT_KEY}_${projectId}` : STATIONS_DRAFT_KEY
);

const DEFAULT_ALIGNMENT_MATRIX = [
  -0.16408309158164905,
  0,
  0.7482956953574085,
  0,
  0,
  0.7660742187499977,
  0,
  0,
  -0.7482956953574085,
  0,
  -0.16408309158164905,
  0,
  -2.5640625,
  0.6219292827544601,
  -1.8394531249999966,
  1
];

export const normalizeAlignment = (alignment) => {
  const matrix = Array.isArray(alignment)
    ? alignment
    : alignment?.reconstructionMatrix;

  if (!Array.isArray(matrix) || matrix.length !== 16 || matrix.some((value) => typeof value !== 'number')) {
    return null;
  }

  return {
    reconstructionMatrix: matrix
  };
};

const hasCompletePosition = (position) => (
  ['x', 'y', 'z'].every((axis) => Number.isFinite(position?.[axis]))
);

const normalizePosition = (position, fallback) => ({
  x: Number.isFinite(position?.x) ? position.x : fallback.x,
  y: Number.isFinite(position?.y) ? position.y : fallback.y,
  z: Number.isFinite(position?.z) ? position.z : fallback.z
});

const normalizeLegacyLightingPosition = (position, fallback) => ({
  x: typeof position?.x === 'number' ? position.x : fallback.x,
  y: typeof position?.y === 'number' ? position.y : fallback.y,
  z: typeof position?.z === 'number' ? position.z : fallback.z
});

const DEFAULT_CAMERA_POSITION = { x: 0, y: 10, z: 22 };
const DEFAULT_CAMERA_TARGET = { x: 0, y: 3.5, z: 0 };
const DEFAULT_ANNOTATION_POSITION = { x: 0, y: 3.5, z: 0 };
const DEFAULT_KEY_LIGHT_POSITION = { x: 8, y: 16, z: 10 };
const DEFAULT_FILL_LIGHT_POSITION = { x: -8, y: 12, z: -10 };
const DEFAULT_SPOT_LIGHT_POSITION = { x: 0, y: 15, z: 0 };

const normalizeStationCamera = (station) => ({
  cameraPos: normalizePosition(station.cameraPos, DEFAULT_CAMERA_POSITION),
  cameraTarget: normalizePosition(station.cameraTarget, DEFAULT_CAMERA_TARGET),
  cameraExplicitlySet: typeof station.cameraExplicitlySet === 'boolean'
    ? station.cameraExplicitlySet
      && hasCompletePosition(station.cameraPos)
      && hasCompletePosition(station.cameraTarget)
    : hasCompletePosition(station.cameraPos) && hasCompletePosition(station.cameraTarget)
});

const normalizeAnnotation = (annotation, station, stationIndex, annotationIndex) => ({
  id: annotation.id ?? `annotation_${stationIndex}_${annotationIndex}`,
  title: annotation.title ?? `Annotation ${annotationIndex + 1}`,
  text: annotation.text ?? "",
  position: annotation.position
    ? {
      x: typeof annotation.position.x === 'number' ? annotation.position.x : 0,
      y: typeof annotation.position.y === 'number' ? annotation.position.y : 3.5,
      z: typeof annotation.position.z === 'number' ? annotation.position.z : 0
    }
    : { ...DEFAULT_ANNOTATION_POSITION },
  positionExplicitlySet: typeof annotation.positionExplicitlySet === 'boolean'
    ? annotation.positionExplicitlySet
    : !!annotation.position,
  cameraExplicitlySet: typeof annotation.cameraExplicitlySet === 'boolean'
    ? annotation.cameraExplicitlySet
    : !!(annotation.cameraPos && annotation.cameraTarget),
  cameraPos: annotation.cameraPos
    ? {
      x: typeof annotation.cameraPos.x === 'number' ? annotation.cameraPos.x : (station.cameraPos?.x ?? 0),
      y: typeof annotation.cameraPos.y === 'number' ? annotation.cameraPos.y : (station.cameraPos?.y ?? 10),
      z: typeof annotation.cameraPos.z === 'number' ? annotation.cameraPos.z : (station.cameraPos?.z ?? 22)
    }
    : (station.cameraPos ? { ...station.cameraPos } : { ...DEFAULT_CAMERA_POSITION }),
  cameraTarget: annotation.cameraTarget
    ? {
      x: typeof annotation.cameraTarget.x === 'number' ? annotation.cameraTarget.x : (station.cameraTarget?.x ?? 0),
      y: typeof annotation.cameraTarget.y === 'number' ? annotation.cameraTarget.y : (station.cameraTarget?.y ?? 3.5),
      z: typeof annotation.cameraTarget.z === 'number' ? annotation.cameraTarget.z : (station.cameraTarget?.z ?? 0)
    }
    : (station.cameraTarget ? { ...station.cameraTarget } : { ...DEFAULT_CAMERA_TARGET }),
  images: Array.isArray(annotation.images) ? annotation.images.slice(0, 4).filter(Boolean) : [],
  visibleStationIds: Array.isArray(annotation.visibleStationIds)
    ? [...new Set(annotation.visibleStationIds.filter((id) => typeof id === 'string'))]
    : null
});

const normalizeAnnotationsForStation = (station, stationIndex) => (
  Array.isArray(station.annotations)
    ? station.annotations.map((annotation, annotationIndex) => (
      normalizeAnnotation(annotation, station, stationIndex, annotationIndex)
    ))
    : []
);

const normalizeStationLighting = (station) => ({
  lightIntensity: typeof station.lightIntensity === 'number' ? station.lightIntensity : 1.0,
  shadowDiffuse: typeof station.shadowDiffuse === 'number' ? station.shadowDiffuse : 1.0,
  lightHemiEnabled: typeof station.lightHemiEnabled === 'boolean' ? station.lightHemiEnabled : true,
  lightKeyEnabled: typeof station.lightKeyEnabled === 'boolean' ? station.lightKeyEnabled : true,
  lightKeyFixedToCamera: !!station.lightKeyFixedToCamera,
  lightKeyPos: normalizeLegacyLightingPosition(station.lightKeyPos, DEFAULT_KEY_LIGHT_POSITION),
  lightFillEnabled: typeof station.lightFillEnabled === 'boolean' ? station.lightFillEnabled : true,
  lightFillFixedToCamera: !!station.lightFillFixedToCamera,
  lightFillPos: normalizeLegacyLightingPosition(station.lightFillPos, DEFAULT_FILL_LIGHT_POSITION),
  lightSpotEnabled: typeof station.lightSpotEnabled === 'boolean' ? station.lightSpotEnabled : true,
  lightSpotFixedToCamera: !!station.lightSpotFixedToCamera,
  lightSpotPos: normalizeLegacyLightingPosition(station.lightSpotPos, DEFAULT_SPOT_LIGHT_POSITION)
});

const normalizeStationImage = (image) => {
  const source = image || {};
  return {
    url: source.url ?? "",
    posX: typeof source.posX === 'number' ? source.posX : 0,
    posY: typeof source.posY === 'number' ? source.posY : 3.5,
    posZ: typeof source.posZ === 'number' ? source.posZ : 0,
    scale: typeof source.scale === 'number' ? source.scale : 1.0,
    fixToCamera: !!source.fixToCamera
  };
};

const normalizeStationImages = (images) => {
  if (!Array.isArray(images)) return Array.from({ length: 3 }, () => normalizeStationImage());
  return images
    .slice(0, 3)
    .concat(Array(Math.max(0, 3 - images.length)).fill(null))
    .map(normalizeStationImage);
};

const normalizeStation = (station, index, stationCount) => {
  const items = normalizeSpatialItems(station.items);
  return {
    id: station.id ?? `station_${index}`,
    title: station.title ?? `Station ${index + 1}`,
    description: station.description ?? "",
    introduction: station.introduction ?? station.description ?? "",
    spatial: normalizeSpatialStation(station, index),
    items,
    thumbnailLayout: normalizeThumbnailLayout(station.thumbnailLayout),
    thumbnailGridSpacing: normalizeThumbnailGridSpacing(station.thumbnailGridSpacing),
    selectedItemId: station.selectedItemId ?? station.items?.[0]?.id ?? null,
    initialItemId: resolveSpatialInitialItemId(station, items),
    viewMode: station.viewMode ?? "reveal",
    ...normalizeStationCamera(station),
    revealRadius: typeof station.revealRadius === 'number' ? station.revealRadius : 0.26,
    revealSoftness: typeof station.revealSoftness === 'number' ? station.revealSoftness : 0.05,
    portalRadius: typeof station.portalRadius === 'number' ? station.portalRadius : 3.2,
    portalSoftness: typeof station.portalSoftness === 'number' ? station.portalSoftness : 0.2,
    portalTransitionDuration: typeof station.portalTransitionDuration === 'number' ? station.portalTransitionDuration : 2.8,
    portalMouseStart: typeof station.portalMouseStart === 'number' ? station.portalMouseStart : 0.2,
    portalRuinFadeEnd: typeof station.portalRuinFadeEnd === 'number' ? station.portalRuinFadeEnd : 0.22,
    portalRevealRuinFadeStart: typeof station.portalRevealRuinFadeStart === 'number' ? station.portalRevealRuinFadeStart : 0.18,
    portalRevealRuinFadeEnd: typeof station.portalRevealRuinFadeEnd === 'number' ? station.portalRevealRuinFadeEnd : 0.85,
    portalReconFadeStart: typeof station.portalReconFadeStart === 'number' ? station.portalReconFadeStart : 0.08,
    portalReconFadeEnd: typeof station.portalReconFadeEnd === 'number' ? station.portalReconFadeEnd : 0.46,
    bgImage: station.bgImage ?? "",
    textX: typeof station.textX === 'number' ? station.textX : 10,
    textY: typeof station.textY === 'number' ? station.textY : 35,
    textWidth: typeof station.textWidth === 'number' ? station.textWidth : 512,
    subTitle: station.subTitle ?? "",
    subDescription: station.subDescription ?? "",
    videoUrl: station.videoUrl ?? "",
    videoX: typeof station.videoX === 'number' ? station.videoX : 58,
    videoY: typeof station.videoY === 'number' ? station.videoY : 22,
    videoWidth: typeof station.videoWidth === 'number' ? station.videoWidth : 28,
    videoHeight: typeof station.videoHeight === 'number' ? station.videoHeight : 18,
    textLayer: station.textLayer ?? "front",
    milkyBg: !!station.milkyBg,
    highContrastBg: !!station.highContrastBg,
    playModelAnimation: !!station.playModelAnimation,
    modelAnimationSpeed: Number.isFinite(Number(station.modelAnimationSpeed))
      ? Math.max(10, Math.min(200, Number(station.modelAnimationSpeed)))
      : 100,
    freeNavigation: typeof station.freeNavigation === 'boolean' ? station.freeNavigation : index === stationCount - 1,
    freeNavigationTargetOffsetY: Number.isFinite(station.freeNavigationTargetOffsetY)
      ? station.freeNavigationTargetOffsetY
      : 0,
    freeNavigationMaxDistance: Number.isFinite(station.freeNavigationMaxDistance)
      ? Math.max(2, Math.min(200, station.freeNavigationMaxDistance))
      : 40,
    showAnnotationNavigation: typeof station.showAnnotationNavigation === 'boolean'
      ? station.showAnnotationNavigation
      : true,
    showAnnotations: typeof station.showAnnotations === 'boolean' ? station.showAnnotations : true,
    annotations: normalizeAnnotationsForStation(station, index),
    ...normalizeStationLighting(station),
    images: normalizeStationImages(station.images)
  };
};

export const normalizeStations = (stations) => {
  if (!Array.isArray(stations)) return [];
  return stations.map((station, index) => normalizeStation(station, index, stations.length));
};

export const normalizeAnnotations = (annotations) => {
  if (!Array.isArray(annotations) || annotations.length === 0) return [];
  const normalized = normalizeStations([{ annotations }]);
  return normalized[0]?.annotations ?? [];
};

export const collectProjectAnnotations = (stations, annotations = []) => {
  const combined = [
    ...(Array.isArray(annotations) ? annotations : []),
    ...(Array.isArray(stations)
      ? stations.flatMap((station) => Array.isArray(station?.annotations) ? station.annotations : [])
      : [])
  ];
  const normalized = preserveDistinctAnnotations(normalizeAnnotations(combined));
  const stationList = Array.isArray(stations) ? stations : [];
  const hasLegacyVisibility = stationList.some((station) => station?.showAnnotations === false);
  if (!hasLegacyVisibility) return normalized;

  const legacyVisibleStationIds = stationList
    .filter((station) => station?.showAnnotations !== false)
    .map((station) => station.id);
  return normalized.map((annotation) => (
    Array.isArray(annotation.visibleStationIds)
      ? annotation
      : { ...annotation, visibleStationIds: legacyVisibleStationIds }
  ));
};

export const normalizeStationConfig = (config) => {
  const stations = Array.isArray(config) ? config : config?.stations;
  const fallbackAlignment = normalizeAlignment({
    reconstructionMatrix: DEFAULT_ALIGNMENT_MATRIX
  });

  return {
    project: config?.project && typeof config.project === 'object' ? config.project : null,
    alignment: normalizeAlignment(config?.alignment) ?? fallbackAlignment,
    stations: normalizeStations(stations),
    annotations: collectProjectAnnotations(stations, config?.annotations)
  };
};

export const defaultStationConfig = normalizeStationConfig(bundledStations);
export const defaultStations = defaultStationConfig.stations;

export async function loadStationConfig() {
  await platformReady;
  const routeStory = getRouteStory();
  if (routeStory) {
    return normalizeStationConfig({
      project: routeStory,
      alignment: routeStory.alignment,
      annotations: routeStory.annotations,
      stations: routeStory.stations
    });
  }
  try {
    const response = await fetch(siteConfig.stationsFile, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const config = normalizeStationConfig(await response.json());
    if (config.stations.length === 0) throw new Error('No stations found.');

    return config;
  } catch (error) {
    console.warn(`Could not load ${siteConfig.stationsFile}; using bundled station data.`, error);
    return defaultStationConfig;
  }
}

export const prepareStationsForStorage = (stations) => normalizeStations(stations).map((station) => {
  const {
    annotations: _legacyAnnotations,
    showAnnotations: _legacyShowAnnotations,
    lightIntensity: _legacyLightIntensity,
    shadowDiffuse: _legacyShadowDiffuse,
    lightHemiEnabled: _legacyLightHemiEnabled,
    lightKeyEnabled: _legacyLightKeyEnabled,
    lightKeyFixedToCamera: _legacyLightKeyFixedToCamera,
    lightKeyPos: _legacyLightKeyPos,
    lightFillEnabled: _legacyLightFillEnabled,
    lightFillFixedToCamera: _legacyLightFillFixedToCamera,
    lightFillPos: _legacyLightFillPos,
    lightSpotEnabled: _legacyLightSpotEnabled,
    lightSpotFixedToCamera: _legacyLightSpotFixedToCamera,
    lightSpotPos: _legacyLightSpotPos,
    ...withoutProjectData
  } = station;
  if (station.cameraExplicitlySet !== false) return withoutProjectData;
  const { cameraPos: _cameraPos, cameraTarget: _cameraTarget, ...withoutImplicitCamera } = withoutProjectData;
  return withoutImplicitCamera;
});

export const serializeStationConfig = (stations, alignment, annotations = []) => ({
  alignment: normalizeAlignment(alignment),
  annotations: normalizeAnnotations(annotations),
  stations: prepareStationsForStorage(stations)
});

export const formatStationConfig = (stations, alignment, annotations = []) =>
  JSON.stringify(serializeStationConfig(stations, alignment, annotations), null, 2);

export const loadDraftStations = (projectId = '') => {
  const draftKey = getStationsDraftKey(projectId);
  const data = localStorage.getItem(draftKey);
  if (!data) return null;

  try {
    const stations = normalizeStations(JSON.parse(data));
    if (projectId && findCrossStoryStationSource(stations, projectId, readStories())) {
      console.warn('Stationsentwurf gehörte zu einer anderen Story und wurde verworfen.');
      localStorage.removeItem(draftKey);
      return null;
    }
    return stations.length > 0 ? stations : null;
  } catch (error) {
    console.warn('Saved station draft is invalid; removing it.', error);
    localStorage.removeItem(draftKey);
    return null;
  }
};

export const saveDraftStations = (stations, projectId = '') => {
  try {
    localStorage.setItem(getStationsDraftKey(projectId), JSON.stringify(prepareStationsForStorage(stations)));
  } catch (error) {
    if (error?.name === 'QuotaExceededError') {
      throw new Error('Die Konfiguration ist für den lokalen Browser-Speicher zu groß. Entfernen oder verkleinern Sie hochgeladene Bilder und versuchen Sie es erneut.');
    }
    throw new Error(`Die Konfiguration konnte nicht lokal gespeichert werden: ${error.message}`);
  }
};
