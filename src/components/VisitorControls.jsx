import React, { useEffect, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Home, Info, MousePointer2, RotateCcw, ScanSearch, Volume2, VolumeX } from 'lucide-react';
import { InterpretationComparison } from './InterpretationComparison.jsx';
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
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef(null);
  const revealExploreButtonRef = useRef(null);
  const revealDoneButtonRef = useRef(null);
  const wasRevealExploringRef = useRef(false);

  useEffect(() => {
    if (!infoOpen) return undefined;
    const closeInfo = (event) => {
      if (event.key === 'Escape' || !infoRef.current?.contains(event.target)) setInfoOpen(false);
    };
    document.addEventListener('pointerdown', closeInfo);
    document.addEventListener('keydown', closeInfo);
    return () => {
      document.removeEventListener('pointerdown', closeInfo);
      document.removeEventListener('keydown', closeInfo);
    };
  }, [infoOpen]);

  useEffect(() => {
    if (!isCompactExperienceViewport()) return undefined;
    const isRevealExploring = !!activeStation?.freeNavigation
      && !!appState.freeNavigationActive
      && appState.viewMode === 'reveal';
    if (isRevealExploring === wasRevealExploringRef.current) return undefined;
    wasRevealExploringRef.current = isRevealExploring;
    const frame = window.requestAnimationFrame(() => {
      if (isRevealExploring) revealDoneButtonRef.current?.focus();
      else revealExploreButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStation?.freeNavigation, appState.freeNavigationActive, appState.viewMode]);

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
      <div className="visitor-top-controls fixed top-5 left-5 z-40 flex items-center gap-2 pointer-events-auto">
        <a
          href="/"
          className="flex h-[38px] items-center rounded-full border border-white/10 bg-zinc-950/45 px-3.5 font-serif text-sm font-semibold tracking-[0.16em] text-zinc-200 no-underline shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] active:scale-95"
          title="Zur RIU Startseite"
          aria-label="Zur RIU Startseite"
        >
          RIU
        </a>
        <a
          href="/discover"
          className="p-2.5 rounded-full border border-white/10 bg-zinc-950/45 text-zinc-400 backdrop-blur-xl transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center"
          title="Zur Galerie"
          aria-label="Zur Galerie"
        >
          <Home size={15} />
        </a>
        <button
          type="button"
          onClick={onToggleMute}
          className="p-2.5 rounded-full border border-white/10 bg-zinc-950/45 backdrop-blur-xl transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] hover:shadow-[0_0_15px_rgba(201,169,110,0.2)] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer"
          title={isMuted ? 'Ton einschalten' : 'Stummschalten'}
          aria-label={isMuted ? 'Ton einschalten' : 'Stummschalten'}
        >
          {isMuted
            ? <VolumeX size={15} className="text-zinc-400 transition-colors" />
            : <Volume2 size={15} className="text-[#c9a96e] animate-pulse" />}
        </button>
        <div className="relative" ref={infoRef}>
          <button
            type="button"
            onClick={() => setInfoOpen((current) => !current)}
            className="p-2.5 rounded-full border border-white/10 bg-zinc-950/45 text-zinc-400 backdrop-blur-xl transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer"
            title="Informationen zur Story"
            aria-label="Informationen zur Story"
            aria-expanded={infoOpen}
          >
            <Info size={15} />
          </button>
          {infoOpen && (
            <div className="visitor-story-info absolute left-0 top-[calc(100%+0.6rem)] w-64 rounded-xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-2xl">
              <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300/65">Kuratiert von</span>
              {authorId ? (
                <a
                  href={`/discover?author=${encodeURIComponent(authorId)}`}
                  className="mt-1.5 block font-serif text-lg text-zinc-100 transition-colors hover:text-amber-200"
                >
                  {authorName || 'RIU Autor:in'}
                </a>
              ) : (
                <span className="mt-1.5 block font-serif text-lg text-zinc-100">{authorName || 'RIU Autor:in'}</span>
              )}
              {editorNames.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300/65">Editor:innen</span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-zinc-300">{editorNames.join(', ')}</span>
                </div>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Weitere veröffentlichte Stories dieser Person anzeigen.</p>
            </div>
          )}
        </div>
        {showStoryTitle && storyTitle && (
          <span className="visitor-story-title font-serif">{storyTitle}</span>
        )}
      </div>

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
          {canEnterFreeView && !appState.freeNavigationActive && (
            <button type="button" className="visitor-view-control" onClick={onEnterFreeView} aria-label="Freie Ansicht öffnen">
              <MousePointer2 size={15} /> <span>Freie Ansicht</span>
            </button>
          )}
          {canEnterFreeView && appState.freeNavigationActive && (
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

      {activeStation?.freeNavigation && appState.freeNavigationActive && appState.viewMode === 'reveal' && (
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

      {activeStation?.interpretationComparison && !appState.freeNavigationActive && (
        <InterpretationComparison
          comparison={activeStation.interpretationComparison}
          exploreButtonRef={revealExploreButtonRef}
          viewMode={appState.viewMode}
          onExplore={activeStation.freeNavigation ? () => window.appState?.activateFreeNavigation?.() : null}
          onViewModeChange={selectInterpretationView}
        />
      )}
    </>
  );
}
