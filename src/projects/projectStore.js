import { siteConfig } from '../site.config.js';
import { DEFAULT_PROJECT_LIGHTING, NEW_STATION_TEMPLATE } from '../constants.js';
import { cloneStationData } from '../utils/stationEditing.js';
import { collectProjectAnnotations, normalizeStations, prepareStationsForStorage } from '../stations.js';
import { normalizeProjectCameraFov, normalizeProjectOrbitTarget } from './projectSettings.js';
import { resolveProjectLightingSource } from './projectLightingPresets.js';
import { normalizeProjectAudio } from '../audio/projectSounds.js';

export { normalizeProjectCameraFov, normalizeProjectOrbitTarget } from './projectSettings.js';

const PROJECTS_KEY = 'riu_editor_projects_v1';
const ACTIVE_PROJECT_KEY = 'riu_editor_active_project_v1';

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `project_${Date.now()}`;

const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const normalizePosition = (position, fallback) => ({
  x: finiteOr(position?.x, fallback.x),
  y: finiteOr(position?.y, fallback.y),
  z: finiteOr(position?.z, fallback.z)
});

const normalizePresentation = (presentation = {}) => ({
  showStoryTitle: !!presentation.showStoryTitle,
  textAnimation: ['cinematic', 'soft', 'none'].includes(presentation.textAnimation)
    ? presentation.textAnimation
    : 'cinematic'
});

const normalizeAdditionalModels = (models = []) => (
  Array.isArray(models) ? models.map((model, index) => ({
    id: model?.id || `additional-model-${index + 1}`,
    name: model?.name || `Modell ${index + 3}`,
    url: model?.url || ''
  })) : []
);

export function normalizeProjectLighting(lighting, legacyStation = null) {
  const source = lighting && typeof lighting === 'object' ? lighting : (legacyStation ?? {});
  return {
    lightIntensity: finiteOr(source.lightIntensity, DEFAULT_PROJECT_LIGHTING.lightIntensity),
    shadowDiffuse: finiteOr(source.shadowDiffuse, DEFAULT_PROJECT_LIGHTING.shadowDiffuse),
    lightHemiEnabled: typeof source.lightHemiEnabled === 'boolean' ? source.lightHemiEnabled : true,
    lightKeyEnabled: typeof source.lightKeyEnabled === 'boolean' ? source.lightKeyEnabled : true,
    lightKeyFixedToCamera: !!source.lightKeyFixedToCamera,
    lightKeyPos: normalizePosition(source.lightKeyPos, DEFAULT_PROJECT_LIGHTING.lightKeyPos),
    lightFillEnabled: typeof source.lightFillEnabled === 'boolean' ? source.lightFillEnabled : true,
    lightFillFixedToCamera: !!source.lightFillFixedToCamera,
    lightFillPos: normalizePosition(source.lightFillPos, DEFAULT_PROJECT_LIGHTING.lightFillPos),
    lightSpotEnabled: typeof source.lightSpotEnabled === 'boolean' ? source.lightSpotEnabled : true,
    lightSpotFixedToCamera: !!source.lightSpotFixedToCamera,
    lightSpotPos: normalizePosition(source.lightSpotPos, DEFAULT_PROJECT_LIGHTING.lightSpotPos),
    stationConsistencyRevision: Number(source.stationConsistencyRevision) || 0
  };
}

export function normalizeLightingForProject(projectId, lighting, legacyStation = null) {
  return normalizeProjectLighting(
    resolveProjectLightingSource(projectId, lighting, legacyStation)
  );
}

export const createBlankStations = () => normalizeStations([{
  ...cloneStationData(NEW_STATION_TEMPLATE),
  id: `station_${Date.now()}`,
  title: 'Erste Station',
  description: 'Beschreiben Sie hier die erste Szene Ihres Projekts.'
}]);

export function createProjectRecord({
  name,
  description = '',
  coverImage = '',
  annotationRevision = 0,
  stationRevision = 0,
  stations,
  alignment = null,
  branding = {},
  models = {},
  settings = {},
  annotations = [],
  id = makeId()
}) {
  const now = new Date().toISOString();
  const sourceStations = stations?.length ? stations : createBlankStations();
  return {
    id,
    name: name?.trim() || 'Unbenanntes Projekt',
    description,
    coverImage,
    annotationRevision: Number(annotationRevision) || 0,
    stationRevision: Number(stationRevision) || 0,
    createdAt: now,
    updatedAt: now,
    branding: {
      title: branding.title ?? name?.trim() ?? 'Unbenanntes Projekt',
      subtitle: branding.subtitle ?? '',
      watermark: branding.watermark ?? (name?.trim() || 'PROJEKT').toUpperCase()
    },
    models: {
      primary: models.primary ?? '',
      reconstruction: models.reconstruction ?? '',
      localModelName: models.localModelName ?? '',
      primaryName: models.primaryName ?? 'Hauptmodell',
      reconstructionName: models.reconstructionName ?? 'Rekonstruktion',
      additional: normalizeAdditionalModels(models.additional)
    },
    settings: {
      scrollSpeed: Math.max(0.4, Math.min(1.6, Number(settings.scrollSpeed) || 1)),
      cameraFov: normalizeProjectCameraFov(settings.cameraFov),
      lighting: normalizeLightingForProject(id, settings.lighting, sourceStations[0]),
      orbitTarget: normalizeProjectOrbitTarget(settings.orbitTarget, sourceStations),
      presentation: normalizePresentation(settings.presentation),
      audio: normalizeProjectAudio(settings.audio)
    },
    alignment,
    annotations: collectProjectAnnotations(sourceStations, annotations),
    stations: prepareStationsForStorage(sourceStations)
  };
}

export function createBundledProject(stations, alignment, annotations = [], project = null) {
  return createProjectRecord({
    id: project?.id ?? siteConfig.id,
    name: project?.name ?? siteConfig.title,
    description: project?.description ?? '',
    coverImage: project?.coverImage ?? '',
    annotationRevision: project?.annotationRevision,
    stationRevision: project?.stationRevision,
    stations,
    alignment,
    annotations,
    branding: {
      title: project?.branding?.title ?? project?.name ?? siteConfig.title,
      subtitle: project?.branding?.subtitle ?? siteConfig.subtitle,
      watermark: project?.branding?.watermark ?? siteConfig.watermark
    },
    models: {
      ...siteConfig.models,
      ...project?.models
    },
    settings: project?.settings
  });
}

export function readProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((project) => project?.id && project?.name).map((project) => ({
        ...project,
        settings: {
          ...project.settings,
          scrollSpeed: Math.max(0.4, Math.min(1.6, Number(project.settings?.scrollSpeed) || 1)),
          cameraFov: normalizeProjectCameraFov(project.settings?.cameraFov),
          lighting: normalizeLightingForProject(project.id, project.settings?.lighting, project.stations?.[0]),
          orbitTarget: normalizeProjectOrbitTarget(project.settings?.orbitTarget, project.stations),
          presentation: normalizePresentation(project.settings?.presentation),
          audio: normalizeProjectAudio(project.settings?.audio)
        },
        annotations: collectProjectAnnotations(project.stations, project.annotations),
        stations: prepareStationsForStorage(project.stations)
      }))
      : [];
  } catch {
    return [];
  }
}

export function writeProjects(projects) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return true;
  } catch (error) {
    console.warn('Project data could not be stored locally.', error);
    window.dispatchEvent(new CustomEvent('project-storage-error', { detail: { message: error.message } }));
    return false;
  }
}

export function updateProjectListingMetadata(projectId, patch) {
  const projects = readProjects();
  if (!projects.some((project) => project.id === projectId)) return null;
  const updated = projects.map((project) => project.id === projectId ? {
    ...project,
    name: patch.name ?? project.name,
    description: patch.description ?? project.description,
    coverImage: patch.coverImage ?? project.coverImage,
    metadata: patch.metadata ? { ...project.metadata, ...patch.metadata } : project.metadata,
    branding: patch.name ? { ...project.branding, title: patch.name } : project.branding,
    updatedAt: new Date().toISOString()
  } : project);
  writeProjects(updated);
  return updated.find((project) => project.id === projectId) ?? null;
}

export const readActiveProjectId = () => localStorage.getItem(ACTIVE_PROJECT_KEY) || '';

export function writeActiveProjectId(projectId) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
}

export function cloneProject(project, name) {
  return createProjectRecord({
    name,
    description: project.description,
    coverImage: project.coverImage,
    annotationRevision: project.annotationRevision,
    stationRevision: project.stationRevision,
    stations: cloneStationData(project.stations),
    alignment: cloneStationData(project.alignment),
    branding: { ...project.branding, title: name },
    models: { ...project.models },
    settings: { ...project.settings },
    annotations: cloneStationData(project.annotations ?? [])
  });
}
