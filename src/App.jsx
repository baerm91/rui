import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from './hooks/useAppState.js';
import { useScrollMode } from './hooks/useScrollMode.js';
import { useEditorActions } from './hooks/useEditorActions.js';
import { useProjectWorkspace } from './hooks/useProjectWorkspace.js';
import { useEditorWorkspaceMode } from './hooks/useEditorWorkspaceMode.js';
import { AlignmentPanel } from './components/AlignmentPanel.jsx';
import { StationNavDots } from './components/StationNavDots.jsx';
import { VideoOverlay } from './components/VideoOverlay.jsx';
import { BackgroundLayer } from './components/BackgroundLayer.jsx';
import { NarrativeTextBlock } from './components/NarrativeTextBlock.jsx';
import { AnnotationOverlay } from './components/AnnotationOverlay.jsx';
import { EditorSidebar } from './components/editor/EditorSidebar.jsx';
import { EditorWorkspaceChrome } from './components/EditorWorkspaceChrome.jsx';
import { VisitorControls } from './components/VisitorControls.jsx';
import { useStationConfigFile } from './useStationConfigFile.js';
import { audioManager } from './utils/audioManager.js';
import { siteConfig } from './site.config.js';
import PlatformApp, { getExperienceAccess } from './platform/PlatformApp.jsx';
import { recordStoryView, saveStoryPreview } from './platform/platformStore.js';
import { resolveStoryWatermarkOpacity } from './utils/storyWatermark.js';
import { SketchfabViewer } from './components/SketchfabViewer.jsx';
import { isSketchfabModelUrl } from './utils/modelSource.js';
import { recordStoryAnalyticsEvent } from './platform/supabaseStore.js';
import { getAnalyticsSessionId, getDeviceClass } from './platform/storyAnalytics.js';
import ExhibitionRoom from './exhibition/ExhibitionRoom.jsx';
import { isRoomStory } from './utils/storyExperience.js';

function ExperienceApp({
  hasInitialStoryPreview = false,
  initialPreviewEndStation = 2,
  storyAuthorId,
  storyAuthorName,
  storyEditors = [],
  storyId,
  storyModelUrl,
  viewerId,
  analyticsEnabled = false
}) {
  const {
    appState,
    introPhase,
    isIntroActive,
    handleRealign,
    handleResetAlignment,
    handleSkipAlignment,
    getActiveStation,
    getActiveIndex
  } = useAppState();

  const { scrollToStation } = useScrollMode(appState);

  const [isMuted, setIsMuted] = useState(true);
  const [thumbnailStatus, setThumbnailStatus] = useState('idle');
  const [previewStatus, setPreviewStatus] = useState('idle');
  const [hasStoryPreview, setHasStoryPreview] = useState(hasInitialStoryPreview);
  const [previewEndStation, setPreviewEndStation] = useState(Math.max(2, initialPreviewEndStation));
  const analyticsStartedAt = useRef(performance.now());
  const analyticsSessionId = useRef(analyticsEnabled ? getAnalyticsSessionId(storyId) : '');
  const trackedStations = useRef(new Set());
  const analyticsViewRecorded = useRef(false);

  const trackAnalytics = (eventType, details = {}) => {
    if (!analyticsEnabled || !analyticsSessionId.current) return;
    recordStoryAnalyticsEvent(storyId, analyticsSessionId.current, eventType, {
      deviceClass: getDeviceClass(),
      ...details
    }).catch(() => {});
  };

  useEffect(() => {
    recordStoryView(storyId, viewerId);
  }, [storyId, viewerId]);

  useEffect(() => {
    if (!analyticsEnabled || appState.mode === 'loading' || analyticsViewRecorded.current) return;
    analyticsViewRecorded.current = true;
    trackAnalytics('story_view', { loadMs: Math.round(performance.now() - analyticsStartedAt.current) });
  }, [analyticsEnabled, appState.mode]);

  useEffect(() => {
    if (!analyticsEnabled || appState.mode === 'loading' || appState.stationMode !== 'scroll') return;
    const station = appState.stations?.[appState.currentStationIndex];
    if (!station?.id || trackedStations.current.has(station.id)) return;
    trackedStations.current.add(station.id);
    trackAnalytics('station_view', { stationId: station.id });
    if (appState.currentStationIndex === appState.stations.length - 1 && appState.stations.length > 1) {
      trackAnalytics('story_complete', {
        durationSeconds: Math.round((performance.now() - analyticsStartedAt.current) / 1000)
      });
    }
  }, [analyticsEnabled, appState.currentStationIndex, appState.mode, appState.stationMode, appState.stations]);

  useEffect(() => {
    if (!analyticsEnabled) return undefined;
    const recordExit = () => trackAnalytics('story_exit', {
      durationSeconds: Math.round((performance.now() - analyticsStartedAt.current) / 1000)
    });
    const handleVisibility = () => { if (document.visibilityState === 'hidden') recordExit(); };
    window.addEventListener('pagehide', recordExit);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', recordExit);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [analyticsEnabled]);

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    audioManager.setMute(nextMute);
  };

  const captureThumbnail = async () => {
    setThumbnailStatus('saving');
    try {
      const coverImage = await window.appState?.captureThumbnail?.();
      if (!coverImage) throw new Error('Die 3D-Ansicht ist noch nicht bereit.');
      projectWorkspace.updateProject({ coverImage });
      setThumbnailStatus('saved');
      window.setTimeout(() => setThumbnailStatus('idle'), 2400);
    } catch (error) {
      console.warn('Vorschaubild konnte nicht erzeugt werden.', error);
      setThumbnailStatus('error');
      window.setTimeout(() => setThumbnailStatus('idle'), 3200);
    }
  };

  const capturePreview = async () => {
    setPreviewStatus('saving');
    try {
      const stationSnapshot = await editor.getEditingStationsSnapshot();
      if ((stationSnapshot?.filter(Boolean).length || 0) < 2) {
        throw new Error('Für eine Preview werden mindestens zwei Stationen benötigt.');
      }
      window.appState?.saveStations?.(stationSnapshot);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const endStationNumber = Math.max(2, Math.min(stationSnapshot.length, previewEndStation));
      const intervalCount = endStationNumber - 1;
      const durationMs = 3000 * intervalCount;
      const returnDurationMs = 3500 * intervalCount;
      const previewBlob = await window.appState?.captureStoryPreview?.({
        durationMs,
        returnDurationMs,
        endStationIndex: endStationNumber - 1,
        fps: 24
      });
      if (!previewBlob) throw new Error('Die 3D-Ansicht ist noch nicht bereit.');
      await saveStoryPreview(storyId, previewBlob, {
        durationSeconds: durationMs / 1000,
        returnDurationSeconds: returnDurationMs / 1000,
        endStationNumber,
        playbackMode: 'ping-pong'
      });
      setHasStoryPreview(true);
      setPreviewStatus('saved');
      window.setTimeout(() => setPreviewStatus('idle'), 2600);
    } catch (error) {
      console.warn('Story-Preview konnte nicht erzeugt werden.', error);
      setPreviewStatus('error');
      window.setTimeout(() => setPreviewStatus('idle'), 3600);
    }
  };

  const editor = useEditorActions(appState);
  const projectWorkspace = useProjectWorkspace({
    appState,
    preferredProjectId: storyId,
    editingStations: editor.editingStations,
    setEditingStations: editor.setEditingStations,
    editingAnnotations: editor.editingAnnotations,
    setEditingAnnotations: editor.setEditingAnnotations,
    setEditingIndex: editor.setEditingIndex
  });
  const editorWorkspace = useEditorWorkspaceMode({ appState, editor });

  useEffect(() => {
    const maximum = Math.max(2, editor.editingStations?.length || 2);
    setPreviewEndStation((current) => Math.min(maximum, Math.max(2, current)));
  }, [editor.editingStations?.length]);

  useEffect(() => {
    const station = appState.stations?.[appState.currentStationIndex];
    audioManager.syncAmbience(projectWorkspace.activeProject?.settings?.audio, station?.id);
  }, [appState.currentStationIndex, appState.stations, projectWorkspace.activeProject?.id, projectWorkspace.activeProject?.settings?.audio]);

  const activeProjectName = projectWorkspace.activeProject?.name?.trim() || siteConfig.title;
  useEffect(() => {
    document.title = activeProjectName;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', `Interaktive 3D-Präsentation des Projekts ${activeProjectName}.`);
    }
    const loadingTitle = document.querySelector('.loading-title');
    if (loadingTitle) loadingTitle.textContent = activeProjectName;
  }, [activeProjectName]);
  
  const configFile = useStationConfigFile({
    alignment: window.appState?.getAlignment?.() ?? appState.alignment,
    editingStations: editor.editingStations,
    editingAnnotations: editor.editingAnnotations,
    onImportAlignment: (alignment) => window.appState?.saveAlignmentConfig?.(alignment),
    onImportStations: editor.setEditingStations,
    onImportAnnotations: editor.setEditingAnnotations,
    onPreviewStation: editor.handleTestStation,
    project: projectWorkspace.activeProject,
    onImportProject: (project) => projectWorkspace.updateProject({
      name: project.name,
      description: project.description,
      branding: project.branding,
      models: project.models,
      settings: project.settings
    })
  });

  if (appState.mode === 'loading') {
    return null; // Rendered inside HTML template loading screen
  }

  // 1. ALIGNMENT MODE INTERFACE
  if (appState.mode === 'aligning') {
    return (
      <AlignmentPanel
        appState={appState}
        projectName={activeProjectName}
        projectSubtitle={projectWorkspace.activeProject?.branding?.subtitle}
        onResetAlignment={handleResetAlignment}
        onSkipAlignment={handleSkipAlignment}
      />
    );
  }

  const activeStation = getActiveStation(editor.editingStations, editor.editingIndex);
  const activeIndex = getActiveIndex(editor.editingIndex);
  const isEditorMode = appState.stationMode === 'editor';
  const isEditorInteractionMode = editorWorkspace.isEditing;
  const usesSketchfabViewer = isSketchfabModelUrl(storyModelUrl);
  const freeNavigationIsActive = appState.stationMode === 'scroll'
    && !!activeStation?.freeNavigation
    && appState.freeNavigationActive
    && appState.freeNavigationStationId === activeStation.id;
  const projectNeedsLocalModel = !!projectWorkspace.activeProject
    && !usesSketchfabViewer
    && projectWorkspace.activeProject.id !== appState.projectConfig?.id
    && appState.localModelStatus !== 'loaded';
  const hasRenderableEditorModel = usesSketchfabViewer
    ? appState.externalViewerStatus === 'ready'
    : !projectNeedsLocalModel
      && (appState.baseModelStatus === 'ready' || appState.localModelStatus === 'loaded');
  const storyWatermarkOpacity = resolveStoryWatermarkOpacity({
    scrollProgress: appState.scrollProgress,
    stationCount: appState.stations.length,
    isEditor: isEditorMode,
    activeIndex
  });
  // 2. MAIN MODES (SCROLL, EDITOR, EXPLORE)
  return (
    <div className="w-full relative text-white">
      <SketchfabViewer
        modelUrl={storyModelUrl}
        title={activeProjectName}
        activeStation={activeStation}
        annotations={isEditorMode ? editor.editingAnnotations : appState.annotations}
        stations={appState.stations}
        scrollProgress={appState.scrollProgress}
        stationMode={appState.stationMode}
        freeNavigationIsActive={freeNavigationIsActive}
      />
      <EditorWorkspaceChrome
        appState={appState}
        canCaptureThumbnail={usesSketchfabViewer
          ? appState.externalViewerStatus === 'ready'
          : hasRenderableEditorModel}
        hasRenderableModel={hasRenderableEditorModel}
        isEditorMode={isEditorMode}
        isEditing={isEditorInteractionMode}
        isMuted={isMuted}
        canCapturePreview={!usesSketchfabViewer && hasRenderableEditorModel && (editor.editingStations?.filter(Boolean).length || 0) >= 2}
        usesExternalViewer={usesSketchfabViewer}
        hasStoryPreview={hasStoryPreview}
        onCaptureThumbnail={captureThumbnail}
        onCapturePreview={capturePreview}
        onToggleMute={toggleMute}
        projectNeedsLocalModel={projectNeedsLocalModel}
        projectName={projectWorkspace.activeProject?.name}
        thumbnailStatus={thumbnailStatus}
        previewStatus={previewStatus}
        previewEndStation={previewEndStation}
        previewStationCount={editor.editingStations?.length || 0}
        onPreviewEndStationChange={setPreviewEndStation}
      />

      <VisitorControls
        activeStation={activeStation}
        appState={appState}
        authorId={storyAuthorId}
        authorName={storyAuthorName}
        editorNames={storyEditors.map((editor) => editor.name || `@${editor.username}`)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        storyTitle={projectWorkspace.activeProject?.branding?.title || activeProjectName}
        showStoryTitle={!!projectWorkspace.activeProject?.settings?.presentation?.showStoryTitle}
      />
      
      {/* ─── BACKGROUNDS, WATERMARKS & NARRATIVE OVERLAY ─── */}
      {(appState.stationMode === 'scroll' || appState.stationMode === 'editor') && (
        <>
          <BackgroundLayer
            stations={appState.stationMode === 'editor' ? editor.editingStations : appState.stations}
            activeIndex={activeIndex}
            watermarkOpacity={storyWatermarkOpacity}
            useIntroWatermarkFade={isIntroActive && activeIndex === 0}
            watermark={activeProjectName}
          />

          <NarrativeTextBlock
            activeStation={activeStation}
            activeIndex={activeIndex}
            appState={appState}
            isIntroActive={isIntroActive}
            introPhase={introPhase}
            onDragStart={editor.setDragState}
            isEditorMode={isEditorInteractionMode}
            isEditorWorkspace={isEditorInteractionMode}
            textAnimation={projectWorkspace.activeProject?.settings?.presentation?.textAnimation}
          />

          <VideoOverlay
            activeStation={activeStation}
            isEditorMode={isEditorInteractionMode}
            isEditorWorkspace={isEditorInteractionMode}
            onDragStart={editor.setDragState}
          />

          <AnnotationOverlay
            activeStation={activeStation}
            annotations={isEditorMode ? editor.editingAnnotations : appState.annotations}
            appState={appState}
            isEditorMode={isEditorInteractionMode}
            onDragAnnotation={editor.handleDragAnnotation}
            onAnnotationOpen={(annotation) => trackAnalytics('annotation_open', {
              stationId: activeStation?.id || null,
              annotationId: annotation?.id || null
            })}
          />
        </>
      )}

      {/* ─── MODE 1: SCROLLABLE LANDING PAGE (VISITOR MODE) ─── */}
      {appState.stationMode === 'scroll' && (
        <>
          {/* Right Navigation Dot List */}
          <StationNavDots
            stations={appState.stations}
            currentStationIndex={appState.currentStationIndex}
            onScrollToStation={scrollToStation}
          />

          <div
            className={`scroll-prompt-capsule fixed left-1/2 bottom-8 -translate-x-1/2 z-40 bg-[#0a0b10]/60 border border-amber-500/20 backdrop-blur-md rounded-full px-5 py-2.5 text-[9px] uppercase font-bold tracking-[0.2em] text-[#c9a96e] animate-bounce shadow-[0_4px_20px_rgba(201,169,110,0.15)] flex items-center gap-2 transition-all duration-700 ease-out hover:border-amber-500/40 hover:shadow-[0_4px_25px_rgba(201,169,110,0.25)] ${
              (appState.scrollProgress ?? 0) < 0.08 && !activeStation?.freeNavigation
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-3 pointer-events-none'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="scroll-prompt-text">Scrollen Sie nach unten ↓</span>
          </div>

          {/* Scroll Spacers (Generates the scroll height of the page) */}
          <div className="w-full relative pointer-events-none">
            {appState.stations.map((s, idx) => (
              <div key={`spacer-${s.id}`} className="h-screen w-full" />
            ))}
          </div>
        </>
      )}

      {/* ─── MODE 3: STATION EDITOR SIDEBAR ─── */}
      {(appState.stationMode === 'editor' || editorWorkspace.isPreviewing) && (
        <EditorSidebar
          editingStations={editor.editingStations}
          editingAnnotations={editor.editingAnnotations}
          editingIndex={editor.editingIndex}
          activeAccordionIndex={editor.activeAccordionIndex}
          activeImageAccordion={editor.activeImageAccordion}
          placingAnnotationId={editor.placingAnnotationId}
          placingOriginPoint={editor.placingOriginPoint}
          configFile={configFile}
          onSetActiveAccordion={editor.setActiveAccordionIndex}
          onSetActiveImageAccordion={editor.setActiveImageAccordion}
          onTestStation={editor.handleTestStation}
          onMoveStation={editor.handleMoveStation}
          onDeleteStation={editor.handleDeleteStation}
          onCaptureCamera={editor.handleCaptureCamera}
          cameraCapturePending={editor.cameraCapturePending}
          onPlaceOriginPoint={() => editor.handlePlaceOriginPoint((position) => {
            projectWorkspace.updateProject({ settings: { orbitTarget: position } });
            window.appState?.setProjectOrbitTarget?.(position);
          })}
          onUpdateText={editor.handleUpdateStationText}
          onUpdateImage={editor.handleUpdateStationImage}
          onUploadImage={editor.handleLocal3DImageUpload}
          onAddAnnotation={editor.handleAddAnnotation}
          onDeleteAnnotation={editor.handleDeleteAnnotation}
          onMoveAnnotation={editor.handleMoveAnnotation}
          onUpdateAnnotation={editor.handleUpdateAnnotation}
          onCaptureAnnotation={editor.handleCaptureAnnotation}
          onPlaceAnnotationInScene={editor.handlePlaceAnnotationInScene}
          onUploadAnnotationImages={editor.handleAnnotationImageUpload}
          onLocalBgUpload={editor.handleLocalImageUpload}
          getBgSelectValue={editor.getBgSelectValue}
          onCancel={editor.cancelEditor}
          onSave={editor.saveAndExitEditor}
          onRealign={handleRealign}
          onRestoreDefaults={editor.handleRestoreDefaults}
          onAddStation={editor.handleAddStation}
          localModelName={appState.localModelName}
          localModelStatus={appState.localModelStatus}
          localModelError={editor.localModelPickerError || appState.localModelError}
          localModelEnvironmentRemoved={appState.localModelEnvironmentRemoved}
          localModelMaterialsConverted={appState.localModelMaterialsConverted}
          onChooseLocalModelFolder={editor.handleLocalModelFolder}
          onLocalModelFiles={editor.handleLocalModelFiles}
          onRemoveLocalModel={editor.handleRemoveLocalModel}
          isPreviewMode={editorWorkspace.isPreviewing}
          previewStationIndex={appState.currentStationIndex}
          onPreviewModeChange={(isPreview) => (
            isPreview ? editorWorkspace.showPreview() : editorWorkspace.showEditor()
          )}
          projects={projectWorkspace.activeProject ? [projectWorkspace.activeProject] : []}
          activeProject={projectWorkspace.activeProject}
          saveStatus={projectWorkspace.saveStatus}
          lastSavedAt={projectWorkspace.lastSavedAt}
          onSwitchProject={projectWorkspace.switchProject}
          onCreateProject={projectWorkspace.createProject}
          onUpdateProject={projectWorkspace.updateProject}
          onDeleteProject={projectWorkspace.deleteProject}
          canCreateProjects={false}
        />
      )}
    </div>
  );
}

function App() {
  const isExperiencePath = /^\/(?:stories\/(?!new(?:\/|$))|studio\/)[A-Za-z0-9_-]+/.test(window.location.pathname);
  const access = getExperienceAccess();

  if (!isExperiencePath) return <PlatformApp />;
  if (!access.allowed) {
    window.location.replace(access.isEditor && !access.session ? '/login' : '/');
    return null;
  }
  if (isRoomStory(access.story)) {
    return (
      <ExhibitionRoom
        storyId={access.story.id}
        storyTitle={access.story.name}
        storyDescription={access.story.description}
        initialMode={access.isEditor ? 'editor' : 'visitor'}
        backHref={access.isEditor ? '/dashboard' : '/discover'}
      />
    );
  }
  return (
    <ExperienceApp
      storyAuthorId={access.story.ownerId}
      hasInitialStoryPreview={!!access.story.previewVideoAssetId}
      initialPreviewEndStation={access.story.previewEndStationNumber || 2}
      storyAuthorName={access.story.authorName}
      storyEditors={access.editors}
      storyId={access.story.id}
      storyModelUrl={access.story.models?.primary}
      viewerId={access.isEditor ? access.story.ownerId : access.session?.id}
      analyticsEnabled={!access.isEditor && access.story.status === 'published'}
    />
  );
}

export default App;
