import React, { useEffect, useRef } from 'react';
import { Check, Eye, EyeOff, MousePointer2, RotateCcw, ScanSearch } from 'lucide-react';
import { InterpretationComparison } from './InterpretationComparison.jsx';
import { VisitorTopControls } from './VisitorTopControls.jsx';
import { isCompactExperienceViewport } from '../utils/revealInteraction.js';

export function VisitorControls({
  activeStation,
  appState,
  authorId,
  authorName,
  editorNames = [],
  annotationsVisible = true,
  canEnterFreeView = false,
  hasAnnotations = false,
  isMuted,
  onEnterFreeView,
  onToggleAnnotations,
  onToggleMute,
  storyTitle,
  showStoryTitle = false
}) {
  const revealExploreButtonRef = useRef(null);
  const revealDoneButtonRef = useRef(null);
  const wasRevealExploringRef = useRef(false);
  const isActiveStationFreeView = canEnterFreeView
    && !!activeStation?.id
    && !!appState.freeNavigationActive
    && appState.freeNavigationStationId === activeStation.id;

  useEffect(() => {
    if (!isCompactExperienceViewport()) return undefined;
    const isRevealExploring = isActiveStationFreeView && appState.viewMode === 'reveal';
    if (isRevealExploring === wasRevealExploringRef.current) return undefined;
    wasRevealExploringRef.current = isRevealExploring;
    const frame = window.requestAnimationFrame(() => {
      if (isRevealExploring) revealDoneButtonRef.current?.focus();
      else revealExploreButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appState.viewMode, isActiveStationFreeView]);

  if (appState.stationMode !== 'scroll') return null;

  const selectInterpretationView = (mode) => {
    const liveState = window.appState;
    const station = liveState?.stations?.[liveState.currentStationIndex];
    if (!station?.interpretationComparison || station.id !== activeStation?.id) return;
    liveState.setInterpretationViewMode?.(station.id, mode);
  };

  return (
    <>
      <div
        className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-[#8a6f3e] via-[#c9a96e] to-[#f5e0b3] z-50 transition-all duration-300 ease-out shadow-[0_1px_12px_rgba(201,169,110,0.5)]"
        style={{ width: `${(appState.scrollProgress ?? 0) * 100}%` }}
      />
      <VisitorTopControls authorId={authorId} authorName={authorName} editorNames={editorNames} isMuted={isMuted} onToggleMute={onToggleMute} storyTitle={storyTitle} showStoryTitle={showStoryTitle} />

      {(canEnterFreeView || hasAnnotations) && (
        <div className="visitor-view-controls fixed top-5 right-5 z-40 flex items-center gap-2 pointer-events-auto" role="group" aria-label="Ansicht steuern">
          {hasAnnotations && (
            <button
              type="button"
              className={`visitor-view-control ${annotationsVisible ? 'is-active' : ''}`}
              aria-pressed={annotationsVisible}
              aria-label={annotationsVisible ? 'Annotationen ausblenden' : 'Annotationen einblenden'}
              title={annotationsVisible ? 'Annotationen ausblenden' : 'Annotationen einblenden'}
              onClick={onToggleAnnotations}
            >
              {annotationsVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              <span>{annotationsVisible ? 'Annotationen an' : 'Annotationen aus'}</span>
            </button>
          )}
          {canEnterFreeView && !isActiveStationFreeView && (
            <button type="button" className="visitor-view-control" onClick={onEnterFreeView} aria-label="Freie Ansicht öffnen">
              <MousePointer2 size={15} /> <span>Freie Ansicht</span>
            </button>
          )}
          {isActiveStationFreeView && (
            <>
              <button type="button" className="visitor-view-control" onClick={() => window.appState?.resetFreeView?.()} aria-label="Freie Ansicht zurücksetzen" title="Freie Ansicht zurücksetzen">
                <RotateCcw size={15} /> <span>Zurücksetzen</span>
              </button>
              <button type="button" className="visitor-view-control is-active" onClick={() => window.appState?.exitFreeNavigation?.()} aria-label="Zur geführten Ansicht zurückkehren">
                <Check size={15} /> <span>Geführte Ansicht</span>
              </button>
            </>
          )}
        </div>
      )}

      {isActiveStationFreeView && appState.viewMode === 'reveal' && (
        <div className="mobile-reveal-explore-guide" role="region" aria-label="Freie Reveal-Erkundung">
          <ScanSearch size={18} aria-hidden="true" />
          <span><strong>Reveal fixiert</strong> Ein Finger dreht, zwei Finger zoomen.</span>
          <button
            ref={revealDoneButtonRef}
            type="button"
            disabled={!!appState.freeNavigationExitPending}
            aria-label="Freie Ansicht beenden und zur Vergleichsansicht zurückkehren"
            onClick={() => window.appState?.exitFreeNavigation?.()}
          >
            <Check size={15} aria-hidden="true" /> {appState.freeNavigationExitPending ? 'Zurück …' : 'Fertig'}
          </button>
        </div>
      )}

      {activeStation?.interpretationComparison && !isActiveStationFreeView && (
        <InterpretationComparison
          comparison={activeStation.interpretationComparison}
          exploreButtonRef={revealExploreButtonRef}
          viewMode={appState.viewMode}
          onExplore={onEnterFreeView}
          onViewModeChange={selectInterpretationView}
        />
      )}
    </>
  );
}
