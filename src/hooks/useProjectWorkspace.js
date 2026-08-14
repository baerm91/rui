import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cloneStationData } from '../utils/stationEditing.js';
import { siteConfig } from '../site.config.js';
import { normalizeStations, prepareStationsForStorage } from '../stations.js';
import {
  cloneProject,
  createBlankStations,
  createBundledProject,
  createProjectRecord,
  normalizeProjectCameraFov,
  normalizeProjectLighting,
  normalizeProjectOrbitTarget,
  readActiveProjectId,
  readProjects,
  writeActiveProjectId,
  writeProjects
} from '../projects/projectStore.js';
import {
  copyProjectModelFiles,
  deleteProjectModelFiles,
  readProjectModelFiles
} from '../projects/projectModelStore.js';
import { findCrossStoryStationSource, readStories, updateStoryProject } from '../platform/platformStore.js';

export function useProjectWorkspace({
  appState,
  preferredProjectId = '',
  editingStations,
  setEditingStations,
  editingAnnotations,
  setEditingAnnotations,
  setEditingIndex
}) {
  const [projects, setProjects] = useState(() => readProjects());
  const [activeProjectId, setActiveProjectId] = useState(() => preferredProjectId || readActiveProjectId());
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const hydratedProjectId = useRef('');

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId)
      ?? (preferredProjectId ? null : projects[0])
      ?? null,
    [projects, activeProjectId, preferredProjectId]
  );

  useEffect(() => {
    if (!preferredProjectId) return;
    setActiveProjectId(preferredProjectId);
    writeActiveProjectId(preferredProjectId);
  }, [preferredProjectId]);

  useEffect(() => {
    if (!editingStations.length || projects.length > 0) return;
    const bundled = createBundledProject(
      editingStations,
      appState.alignment,
      appState.annotations,
      appState.projectConfig
    );
    setProjects([bundled]);
    setActiveProjectId(bundled.id);
    writeProjects([bundled]);
    writeActiveProjectId(bundled.id);
    hydratedProjectId.current = bundled.id;
  }, [editingStations, projects.length, appState.alignment, appState.annotations, appState.projectConfig]);

  useEffect(() => {
    if (!appState.projectConfig || !appState.stations?.length) return;
    const bundled = createBundledProject(
      appState.stations,
      appState.alignment,
      appState.annotations,
      appState.projectConfig
    );
    const existingBundled = projects.find((project) => project.id === bundled.id);

    if (existingBundled) {
      const storyRecords = readStories();
      const canonicalStory = storyRecords.find((story) => story.id === bundled.id) ?? null;
      const incomingAnnotationRevision = Number(bundled.annotationRevision) || 0;
      const savedAnnotationRevision = Number(existingBundled.annotationRevision) || 0;
      const incomingStationRevision = Number(bundled.stationRevision) || 0;
      const savedStationRevision = Number(existingBundled.stationRevision) || 0;
      const hasCrossStoryData = !!findCrossStoryStationSource(
        existingBundled.stations,
        bundled.id,
        storyRecords
      );
      const shouldReplaceAnnotations = hasCrossStoryData || incomingAnnotationRevision > savedAnnotationRevision;
      const shouldReplaceStations = hasCrossStoryData || incomingStationRevision > savedStationRevision;
      if (!shouldReplaceAnnotations && !shouldReplaceStations) return;

      const replacementAnnotations = cloneStationData(
        hasCrossStoryData && canonicalStory ? canonicalStory.annotations : bundled.annotations
      );
      const replacementStations = cloneStationData(
        hasCrossStoryData && canonicalStory ? canonicalStory.stations : bundled.stations
      );
      const updated = projects.map((project) => project.id === bundled.id ? {
        ...project,
        ...(hasCrossStoryData && canonicalStory ? {
          models: cloneStationData(canonicalStory.models),
          settings: cloneStationData(canonicalStory.settings),
          alignment: cloneStationData(canonicalStory.alignment)
        } : {}),
        annotationRevision: shouldReplaceAnnotations
          ? incomingAnnotationRevision
          : project.annotationRevision,
        stationRevision: shouldReplaceStations
          ? incomingStationRevision
          : project.stationRevision,
        annotations: shouldReplaceAnnotations ? replacementAnnotations : project.annotations,
        stations: shouldReplaceStations ? replacementStations : project.stations,
        updatedAt: new Date().toISOString()
      } : project);
      setProjects(updated);
      writeProjects(updated);

      if (activeProjectId === bundled.id) {
        const appStatePatch = {};
        if (shouldReplaceAnnotations) {
          setEditingAnnotations(cloneStationData(replacementAnnotations));
          appStatePatch.annotations = cloneStationData(replacementAnnotations);
        }
        if (shouldReplaceStations) {
          const normalizedStations = normalizeStations(replacementStations);
          setEditingStations(cloneStationData(normalizedStations));
          setEditingIndex(0);
          appStatePatch.stations = cloneStationData(normalizedStations);
        }
        if (hasCrossStoryData && canonicalStory) {
          appStatePatch.projectConfig = cloneStationData(canonicalStory);
          appStatePatch.alignment = cloneStationData(canonicalStory.alignment);
          appStatePatch.scrollSpeed = canonicalStory.settings?.scrollSpeed ?? 1;
          appStatePatch.projectOrbitTarget = normalizeProjectOrbitTarget(
            canonicalStory.settings?.orbitTarget,
            replacementStations
          );
        }
        window.appState?.update?.(appStatePatch);
      }
      if (hasCrossStoryData && canonicalStory) {
        const repairKey = `riu_cross_story_repaired_${bundled.id}`;
        if (!sessionStorage.getItem(repairKey)) {
          sessionStorage.setItem(repairKey, '1');
          window.setTimeout(() => window.location.reload(), 50);
        }
      }
      return;
    }

    const updated = [bundled, ...projects];
    setProjects(updated);
    writeProjects(updated);

    if (!activeProjectId || !projects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(bundled.id);
      writeActiveProjectId(bundled.id);
    }
  }, [activeProjectId, appState.annotations, appState.projectConfig, appState.stations, projects, setEditingAnnotations, setEditingIndex, setEditingStations]);

  useEffect(() => {
    if (!activeProject || hydratedProjectId.current === activeProject.id) return;
    hydratedProjectId.current = activeProject.id;
    const stations = cloneStationData(normalizeStations(activeProject.stations));
    const projectOrbitTarget = normalizeProjectOrbitTarget(
      activeProject.settings?.orbitTarget,
      stations
    );
    setEditingStations(stations);
    setEditingAnnotations(cloneStationData(activeProject.annotations ?? []));
    setEditingIndex(0);
    window.appState?.update?.({
      stations,
      annotations: cloneStationData(activeProject.annotations ?? []),
      alignment: activeProject.alignment ?? appState.alignment,
      scrollSpeed: activeProject.settings?.scrollSpeed ?? 1,
      projectOrbitTarget
    });
    window.appState?.removeLocalModel?.({ deleteStored: false });
    const usesBundledModels = activeProject.id === appState.projectConfig?.id;
    window.appState?.update?.({ activeProjectId: activeProject.id });
    window.appState?.setBaseModelsVisible?.(usesBundledModels);
    if (!usesBundledModels) {
      window.appState?.update?.({ localModelStatus: 'loading', localModelError: '' });
      readProjectModelFiles(activeProject.id).then((files) => {
        if (hydratedProjectId.current !== activeProject.id) return;
        if (files.length === 0) {
          window.appState?.update?.({ localModelStatus: 'idle' });
          return;
        }
        return window.appState?.loadLocalModelFiles?.(files, {
          persist: false,
          projectId: activeProject.id
        });
      }).catch((error) => {
        if (hydratedProjectId.current === activeProject.id) {
          window.appState?.update?.({
            localModelStatus: 'error',
            localModelError: `Gespeichertes Modell konnte nicht geladen werden: ${error.message}`
          });
        }
      });
    }
    if (usesBundledModels && stations[0] && appState.baseModelStatus === 'ready') {
      window.appState?.flyToStation?.(stations[0], 0);
    }
  }, [activeProject, appState.alignment, appState.baseModelStatus, appState.localModelStatus, appState.projectConfig?.id, setEditingAnnotations, setEditingIndex, setEditingStations]);

  useEffect(() => {
    if (!activeProject) return;
    window.appState?.update?.({ scrollSpeed: activeProject.settings?.scrollSpeed ?? 1 });
  }, [activeProject?.id, activeProject?.settings?.scrollSpeed]);

  useEffect(() => {
    if (!activeProject) return;
    window.appState?.setCameraFov?.(normalizeProjectCameraFov(activeProject.settings?.cameraFov));
  }, [activeProject?.id, activeProject?.settings?.cameraFov]);

  useEffect(() => {
    if (!activeProject?.settings?.lighting) return;
    window.appState?.applyProjectLighting?.(activeProject.settings.lighting);
  }, [activeProject?.id, activeProject?.settings?.lighting]);

  useEffect(() => {
    if (!activeProject) return;
    const orbitTarget = normalizeProjectOrbitTarget(
      activeProject.settings?.orbitTarget,
      activeProject.stations
    );
    window.appState?.setProjectOrbitTarget?.(orbitTarget);
  }, [activeProject?.id, activeProject?.settings?.orbitTarget]);

  useEffect(() => {
    if (!activeProject || appState.baseModelStatus !== 'ready') return;
    window.appState?.setBaseModelsVisible?.(activeProject.id === appState.projectConfig?.id);
  }, [activeProject, appState.baseModelStatus, appState.projectConfig?.id]);

  useEffect(() => {
    if (!activeProject || hydratedProjectId.current !== activeProject.id || !editingStations.length) return undefined;
    const projectId = activeProject.id;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      setProjects((current) => {
        const updated = current.map((project) => project.id === projectId ? {
          ...project,
          updatedAt: new Date().toISOString(),
          stations: cloneStationData(prepareStationsForStorage(editingStations)),
          annotations: cloneStationData(editingAnnotations),
          alignment: window.appState?.getAlignment?.() ?? project.alignment,
          models: {
            ...project.models,
            localModelName: appState.localModelProjectId === projectId
              ? appState.localModelName
              : project.models?.localModelName || ''
          }
        } : project);
        const saved = writeProjects(updated);
        const updatedProject = updated.find((project) => project.id === projectId);
        if (updatedProject) updateStoryProject(projectId, updatedProject);
        setSaveStatus(saved ? 'saved' : 'error');
        if (saved) setLastSavedAt(new Date());
        return updated;
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeProject?.id, editingStations, editingAnnotations, appState.localModelName, appState.localModelProjectId]);

  const switchProject = useCallback((projectId) => {
    if (!projects.some((project) => project.id === projectId)) return;
    const saved = projects.map((project) => project.id === activeProject?.id ? {
      ...project,
      stations: cloneStationData(prepareStationsForStorage(editingStations)),
      annotations: cloneStationData(editingAnnotations),
      alignment: window.appState?.getAlignment?.() ?? project.alignment,
      updatedAt: new Date().toISOString()
    } : project);
    const didSave = writeProjects(saved);
    setSaveStatus(didSave ? 'saved' : 'error');
    if (didSave) setLastSavedAt(new Date());
    setProjects(saved);
    setActiveProjectId(projectId);
    writeActiveProjectId(projectId);
  }, [projects, activeProject, editingStations, editingAnnotations]);

  const createProject = useCallback((name, duplicateCurrent = false) => {
    const currentSnapshot = activeProject ? {
      ...activeProject,
      stations: cloneStationData(prepareStationsForStorage(editingStations)),
      annotations: cloneStationData(editingAnnotations),
      alignment: window.appState?.getAlignment?.() ?? activeProject.alignment
    } : null;
    const next = duplicateCurrent && currentSnapshot
      ? cloneProject(currentSnapshot, name)
      : createProjectRecord({ name, stations: createBlankStations() });
    const savedProjects = projects.map((project) => project.id === currentSnapshot?.id ? currentSnapshot : project);
    const updated = [...savedProjects, next];
    if (duplicateCurrent && currentSnapshot) {
      copyProjectModelFiles(currentSnapshot.id, next.id)
        .then(() => readProjectModelFiles(next.id))
        .then((files) => {
          if (hydratedProjectId.current === next.id && files.length > 0) {
            return window.appState?.loadLocalModelFiles?.(files, { persist: false, projectId: next.id });
          }
          return undefined;
        })
        .catch((error) => console.warn('Project model could not be copied.', error));
    }
    const didSave = writeProjects(updated);
    setSaveStatus(didSave ? 'saved' : 'error');
    if (didSave) setLastSavedAt(new Date());
    writeActiveProjectId(next.id);
    setProjects(updated);
    setActiveProjectId(next.id);
    return next;
  }, [activeProject, editingStations, editingAnnotations, projects]);

  const updateProject = useCallback((patch) => {
    if (!activeProject) return;
    setProjects((current) => {
      const updated = current.map((project) => project.id === activeProject.id ? {
        ...project,
        ...patch,
        branding: patch.branding ? { ...project.branding, ...patch.branding } : project.branding,
        models: patch.models ? { ...project.models, ...patch.models } : project.models,
        settings: patch.settings ? {
          ...project.settings,
          ...patch.settings,
          lighting: patch.settings.lighting
            ? normalizeProjectLighting(patch.settings.lighting)
            : project.settings?.lighting,
          orbitTarget: patch.settings.orbitTarget
            ? normalizeProjectOrbitTarget(patch.settings.orbitTarget, project.stations)
            : project.settings?.orbitTarget,
          scrollSpeed: Math.max(
            0.4,
            Math.min(1.6, Number(patch.settings.scrollSpeed ?? project.settings?.scrollSpeed) || 1)
          ),
          cameraFov: normalizeProjectCameraFov(patch.settings.cameraFov ?? project.settings?.cameraFov)
        } : project.settings,
        updatedAt: new Date().toISOString()
      } : project);
      const didSave = writeProjects(updated);
      const updatedProject = updated.find((project) => project.id === activeProject.id);
      if (updatedProject) updateStoryProject(activeProject.id, updatedProject);
      setSaveStatus(didSave ? 'saved' : 'error');
      if (didSave) setLastSavedAt(new Date());
      return updated;
    });
  }, [activeProject]);

  const deleteProject = useCallback((projectId) => {
    if (projects.length <= 1) return;
    const updated = projects.filter((project) => project.id !== projectId);
    const next = updated[0];
    const didSave = writeProjects(updated);
    setSaveStatus(didSave ? 'saved' : 'error');
    if (didSave) setLastSavedAt(new Date());
    writeActiveProjectId(next.id);
    setProjects(updated);
    setActiveProjectId(next.id);
    deleteProjectModelFiles(projectId).catch((error) => {
      console.warn('Project model could not be deleted.', error);
    });
  }, [projects]);

  return {
    projects,
    activeProject,
    saveStatus,
    lastSavedAt,
    switchProject,
    createProject,
    updateProject,
    deleteProject
  };
}
