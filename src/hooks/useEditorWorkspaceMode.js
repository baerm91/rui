import { useCallback, useEffect, useState } from 'react';

const EDIT_MODE = 'edit';
const PREVIEW_MODE = 'preview';

function clampStationIndex(index, stationCount) {
  return Math.min(Math.max(index, 0), Math.max(stationCount - 1, 0));
}

export function useEditorWorkspaceMode({ appState, editor }) {
  const [mode, setMode] = useState(EDIT_MODE);

  const showPreview = useCallback(() => {
    window.appState?.cancelAnnotationPlacement?.();
    if (document.pointerLockElement) document.exitPointerLock?.();

    const previewIndex = clampStationIndex(editor.editingIndex, editor.editingStations.length);
    const previewProgress = editor.editingStations.length > 1
      ? previewIndex / (editor.editingStations.length - 1)
      : 0;

    window.appState?.update?.({
      stations: editor.editingStations,
      annotations: editor.editingAnnotations,
      currentStationIndex: previewIndex,
      scrollProgress: previewProgress,
      hasUserManipulatedCamera: false,
      freeNavigationActive: false,
      freeNavigationStationId: null,
      hasIntroPlayed: true,
      introPhase: 'done'
    });
    setMode(PREVIEW_MODE);
    window.appState?.setStationMode?.('scroll');
    window.appState?.snapToStation?.(editor.editingStations[previewIndex], previewIndex);
    window.requestAnimationFrame(() => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: previewProgress * maxScroll, behavior: 'auto' });
    });
  }, [editor.editingAnnotations, editor.editingIndex, editor.editingStations]);

  const showEditor = useCallback(() => {
    editor.setEditingIndex(clampStationIndex(
      window.appState?.currentStationIndex ?? 0,
      editor.editingStations.length
    ));
    setMode(EDIT_MODE);
    window.appState?.setStationMode?.('editor');
  }, [editor.editingStations.length, editor.setEditingIndex]);

  useEffect(() => {
    if (appState.mode !== 'reveal') return;
    const isEditPage = window.location.pathname === '/edits' || window.location.pathname.startsWith('/studio/');
    if (isEditPage && mode === EDIT_MODE && appState.stationMode !== 'editor') {
      editor.enterEditorMode();
    }
  }, [appState.mode, appState.stationMode, editor.enterEditorMode, mode]);

  useEffect(() => {
    const isEditor = appState.stationMode === 'editor';
    document.body.classList.toggle('editor-workspace-mode', isEditor && mode === EDIT_MODE);
    document.body.classList.toggle('editor-preview-mode', mode === PREVIEW_MODE);
    return () => {
      document.body.classList.remove('editor-workspace-mode', 'editor-preview-mode');
    };
  }, [appState.stationMode, mode]);

  useEffect(() => {
    if (appState.stationMode !== 'editor' || mode !== EDIT_MODE) return undefined;

    const updateEditorViewport = () => {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const panelWidth = Number.parseFloat(rootStyles.getPropertyValue('--editor-panel-width')) || 0;
      const stageWidth = Math.max(1, window.innerWidth - panelWidth);
      const demoWidth = Math.max(1, window.innerWidth);
      const demoHeight = Math.max(1, window.innerHeight);
      const demoAspect = demoWidth / demoHeight;
      const stageHeight = Math.min(window.innerHeight, stageWidth / demoAspect);
      const stageTop = Math.max(0, (window.innerHeight - stageHeight) / 2);
      const previewScale = stageWidth / demoWidth;

      document.documentElement.style.setProperty('--editor-stage-width', `${stageWidth}px`);
      document.documentElement.style.setProperty('--editor-stage-height', `${stageHeight}px`);
      document.documentElement.style.setProperty('--editor-stage-top', `${stageTop}px`);
      document.documentElement.style.setProperty('--editor-preview-scale', `${previewScale}`);
    };

    updateEditorViewport();
    window.addEventListener('resize', updateEditorViewport);
    return () => window.removeEventListener('resize', updateEditorViewport);
  }, [appState.stationMode, mode]);

  return {
    mode,
    isEditing: appState.stationMode === 'editor' && mode === EDIT_MODE,
    isPreviewing: mode === PREVIEW_MODE,
    showEditor,
    showPreview
  };
}
