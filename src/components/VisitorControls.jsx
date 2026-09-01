import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Eye, EyeOff, MousePointer2, RotateCcw } from 'lucide-react';
import { InterpretationComparison } from './InterpretationComparison.jsx';
import { VisitorTopControls } from './VisitorTopControls.jsx';
import { getInterpretationState, getNextInterpretationState, resolveRevealInterpretationComparison } from '../utils/interpretationComparison.js';
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
  const noticeTimerRef = useRef(null);
  const [controlNotice, setControlNotice] = useState('');
  const isActiveStationFreeView = canEnterFreeView
    && !!activeStation?.id
    && !!appState.freeNavigationActive
    && appState.freeNavigationStationId === activeStation.id;
  const liveActiveStation = appState.stations?.[appState.currentStationIndex];
  const comparisonStation = liveActiveStation?.id === activeStation?.id
    ? {
        ...activeStation,
        ...liveActiveStation,
        interpretationComparison: liveActiveStation.interpretationComparison || activeStation?.interpretationComparison
      }
    : activeStation;
  const interpretationComparison = resolveRevealInterpretationComparison(comparisonStation);
  const comparisonStates = interpretationComparison?.states || [];
  const activeComparisonState = getInterpretationState(interpretationComparison, appState.viewMode);
  const nextComparisonState = getNextInterpretationState(interpretationComparison, appState.viewMode);
  const isMobileComparisonFreeView = isActiveStationFreeView && comparisonStates.length > 1;

  useEffect(() => {
    if (!isCompactExperienceViewport()) return undefined;
    const isRevealExploring = isMobileComparisonFreeView;
    if (isRevealExploring === wasRevealExploringRef.current) return undefined;
    wasRevealExploringRef.current = isRevealExploring;
    const frame = window.requestAnimationFrame(() => {
      if (isRevealExploring) revealDoneButtonRef.current?.focus();
      else revealExploreButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appState.viewMode, isMobileComparisonFreeView]);
  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  if (appState.stationMode !== 'scroll') return null;

  const selectInterpretationView = (mode) => {
    const liveState = window.appState;
    const station = liveState?.stations?.[liveState.currentStationIndex];
    if (!station?.interpretationComparison || station.id !== activeStation?.id) return;
    liveState.setInterpretationViewMode?.(station.id, mode);
  };
  const announceControl = (message) => {
    window.clearTimeout(noticeTimerRef.current);
    setControlNotice(message);
    noticeTimerRef.current = window.setTimeout(() => setControlNotice(''), 2200);
  };
  const toggleAnnotations = () => {
    onToggleAnnotations?.();
    announceControl(annotationsVisible ? 'Annotationen ausgeblendet' : 'Annotationen eingeblendet');
  };
  const enterFreeView = () => {
    const initialMobileModelState = isCompactExperienceViewport() && appState.viewMode === 'reveal'
      ? getNextInterpretationState(interpretationComparison, 'reveal')
      : null;
    onEnterFreeView?.();
    if (initialMobileModelState) {
      selectInterpretationView(initialMobileModelState.viewMode);
      announceControl(`Freie Ansicht: ${initialMobileModelState.label}`);
    } else {
      announceControl('Freie Ansicht aktiviert');
    }
  };
  const resetFreeView = () => {
    window.appState?.resetFreeView?.();
    announceControl('Freie Ansicht zurückgesetzt');
  };
  const exitFreeView = () => {
    window.appState?.exitFreeNavigation?.();
    announceControl('Geführte Ansicht aktiviert');
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
              onClick={toggleAnnotations}
            >
              {annotationsVisible ? <Eye size={17} aria-hidden="true" /> : <EyeOff size={17} aria-hidden="true" />}
              <span className="sr-only">{annotationsVisible ? 'Annotationen ausblenden' : 'Annotationen einblenden'}</span>
            </button>
          )}
          {canEnterFreeView && !isActiveStationFreeView && (
            <button type="button" className="visitor-view-control" onClick={enterFreeView} aria-label="Freie Ansicht öffnen" title="Freie Ansicht öffnen">
              <MousePointer2 size={17} aria-hidden="true" /> <span className="sr-only">Freie Ansicht öffnen</span>
            </button>
          )}
          {isActiveStationFreeView && (
            <>
              <button type="button" className="visitor-view-control visitor-view-control-reset" onClick={resetFreeView} aria-label="Freie Ansicht zurücksetzen" title="Freie Ansicht zurücksetzen">
                <RotateCcw size={17} aria-hidden="true" /> <span className="sr-only">Freie Ansicht zurücksetzen</span>
              </button>
              <button type="button" className="visitor-view-control is-active" onClick={exitFreeView} aria-label="Zur geführten Ansicht zurückkehren" title="Zur geführten Ansicht zurückkehren">
                <Check size={17} aria-hidden="true" /> <span className="sr-only">Zur geführten Ansicht zurückkehren</span>
              </button>
            </>
          )}
        </div>
      )}
      <div className={`visitor-view-notice ${controlNotice ? 'is-visible' : ''}`} role="status" aria-live="polite">
        {controlNotice}
      </div>

      {isMobileComparisonFreeView && (
        <div className="mobile-reveal-explore-guide" role="region" aria-label="Modellansicht wechseln">
          <ArrowLeftRight size={18} aria-hidden="true" />
          <div className="mobile-reveal-model-switcher">
            <strong>{activeComparisonState?.viewMode === 'reveal' ? 'Modellansicht' : activeComparisonState?.label}</strong>
            <button
              type="button"
              className="mobile-reveal-model-switch"
              aria-label={`${nextComparisonState.label} an der aktuellen Position anzeigen`}
              onClick={() => {
                selectInterpretationView(nextComparisonState.viewMode);
                announceControl(`${nextComparisonState.label} aktiviert`);
              }}
            >
              <ArrowLeftRight size={14} aria-hidden="true" /> {nextComparisonState.label}
            </button>
          </div>
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
          onExplore={enterFreeView}
          onViewModeChange={selectInterpretationView}
        />
      )}
    </>
  );
}
