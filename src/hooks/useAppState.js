import { useState, useEffect } from 'react';

export function useAppState() {
  const [appState, setAppState] = useState({
    mode: 'loading',
    alignStep: 0,
    alignTarget: 'ruin',
    viewMode: 'reveal',
    revealRadius: 0.26,
    revealSoftness: 0.05,
    lensZoom: 1.0,
    stationMode: 'scroll',
    stations: [],
    projectConfig: null,
    alignment: null,
    currentStationIndex: 0,
    scrollProgress: 0,
    scrollSpeed: 1,
    hasUserManipulatedCamera: false,
    freeNavigationActive: false,
    freeNavigationStationId: null,
    introPhase: 'idle',
    hasIntroPlayed: false,
    baseModelStatus: 'loading',
    baseModelError: '',
    activeProjectId: '',
    showBaseModels: true,
    localModelName: '',
    localModelStatus: 'idle',
    localModelError: '',
    localModelEnvironmentRemoved: [],
    localModelMaterialsConverted: 0,
    localModelProjectId: '',
    firstPersonActive: false
  });

  // Synchronize React state with Three.js state bridge
  useEffect(() => {
    if (window.appState) {
      window.appState.onStateChange = (newState) => {
        setAppState({ ...newState });
      };
      setAppState({ ...window.appState });
    }
  }, []);

  // Computed helpers
  const introPhase = appState.introPhase || 'done';
  const isIntroActive = appState.stationMode === 'scroll'
    && !appState.hasIntroPlayed
    && ['title', 'model', 'text'].includes(introPhase);

  // Safe wrapper functions for window.appState triggers
  const handleRealign = () => window.appState?.realign?.();
  const handleResetAlignment = () => window.appState?.resetAlignment?.();
  const handleSkipAlignment = () => window.appState?.skipAlignment?.();
  const handleSetViewMode = (mode) => window.appState?.setViewMode?.(mode);
  const handleSetRadius = (r) => window.appState?.setRevealRadius?.(parseFloat(r));
  const handleSetSoftness = (s) => window.appState?.setRevealSoftness?.(parseFloat(s));
  const handleSetLensZoom = (z) => window.appState?.setLensZoom?.(parseFloat(z));

  /**
   * Get the currently active station depending on whether we're in editor or scroll mode.
   */
  const getActiveStation = (editingStations, editingIndex) => {
    if (appState.stationMode === 'editor') {
      return editingStations[editingIndex];
    }
    return appState.stations[appState.currentStationIndex];
  };

  const getActiveIndex = (editingIndex) => {
    if (appState.stationMode === 'editor') {
      return editingIndex;
    }
    return appState.currentStationIndex;
  };

  return {
    appState,
    introPhase,
    isIntroActive,
    handleRealign,
    handleResetAlignment,
    handleSkipAlignment,
    handleSetViewMode,
    handleSetRadius,
    handleSetSoftness,
    handleSetLensZoom,
    getActiveStation,
    getActiveIndex
  };
}
