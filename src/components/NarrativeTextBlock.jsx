import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Compass } from 'lucide-react';
import { parseTextWithHighlights } from '../utils/textFormatting.jsx';

export function NarrativeTextBlock({
  activeStation,
  activeIndex,
  appState,
  isIntroActive,
  introPhase,
  onDragStart,
  isEditorMode: editorModeOverride,
  isEditorWorkspace = false,
  textAnimation = 'cinematic'
}) {
  const [expandedStationId, setExpandedStationId] = useState(null);
  const compactViewportQuery = '(max-width: 768px), (orientation: landscape) and (max-height: 520px)';
  const [isCompactViewport, setIsCompactViewport] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(compactViewportQuery).matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia(compactViewportQuery);
    const handleChange = (event) => setIsCompactViewport(event.matches);
    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  const isEditorMode = editorModeOverride ?? appState.stationMode === 'editor';
  const mobileDetailsId = `station-details-${activeIndex}`;
  const mobileDetailsExpanded = expandedStationId === activeStation?.id;
  const showMobileCollapsible = isCompactViewport && !isEditorMode;

  if (!activeStation) return null;

  const isLastStation = appState.stationMode === 'scroll' && activeIndex === appState.stations.length - 1;
  const shouldFadeOut = isLastStation && appState.hasUserManipulatedCamera;
  const shouldWaitForIntroText = isIntroActive && introPhase !== 'text';

  // Render behind the 3D model if configured and NOT in editor mode
  const renderBehind = !isEditorMode && activeStation.textLayer === 'behind';
  const startTextInteraction = (event, type) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (document.pointerLockElement) document.exitPointerLock?.();
    onDragStart({
      type,
      startX: event.clientX,
      startY: event.clientY,
      startValueX: activeStation.textX ?? 10,
      startValueY: activeStation.textY ?? 35,
      startWidth: activeStation.textWidth ?? 512
    });
  };

  const textBlockElement = (
    <div 
      className={`fixed pointer-events-none text-left transition-all duration-1000 ease-in-out station-text-panel ${
        !isEditorMode ? 'station-text-panel-visitor' : ''
      } ${
        shouldFadeOut || shouldWaitForIntroText ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
      data-wheel-scroll={!isEditorMode ? 'station-description' : undefined}
      tabIndex={!isEditorMode ? 0 : undefined}
      onWheel={!isEditorMode ? (event) => event.stopPropagation() : undefined}
      onTouchMove={!isEditorMode ? (event) => event.stopPropagation() : undefined}
      style={{
        left: isEditorWorkspace
          ? `calc((100vw - var(--editor-panel-width)) * ${(activeStation.textX ?? 10) / 100})`
          : `${activeStation.textX ?? 10}vw`,
        top: isEditorWorkspace
          ? `calc(var(--editor-stage-top) + var(--editor-stage-height) * ${(activeStation.textY ?? 35) / 100})`
          : `${activeStation.textY ?? 35}vh`,
        width: `${activeStation.textWidth ?? 512}px`,
        maxWidth: `calc(100vw - ${activeStation.textX ?? 10}vw - 16px)`,
        maxHeight: !isEditorMode && !isEditorWorkspace
          ? `calc(100dvh - ${activeStation.textY ?? 35}vh - max(16px, env(safe-area-inset-bottom)))`
          : undefined,
        zIndex: renderBehind ? 5 : 30
      }}
    >
      <div className={isEditorWorkspace ? 'station-content-scale-shell station-content-scale-shell-editor' : 'station-content-scale-shell'}>
      <div 
        key={`${activeStation.id}-${shouldWaitForIntroText ? 'hidden' : 'visible'}`}
        className={`station-content-card station-motion-${textAnimation || 'cinematic'} flex flex-col gap-1 select-none relative ${
          shouldFadeOut || shouldWaitForIntroText ? 'pointer-events-none' : 'pointer-events-auto'
        } ${
          activeStation.highContrastBg
            ? 'high-contrast-text-panel'
            : activeStation.milkyBg ? 'milky-glass-panel shadow-2xl' : ''
        } ${
          isEditorMode 
            ? `cursor-move border border-dashed border-amber-500/50 p-6 rounded-2xl ${activeStation.milkyBg || activeStation.highContrastBg ? '' : 'bg-zinc-950/45'}`
            : ''
        }`}
        onMouseDown={isEditorMode ? (event) => startTextInteraction(event, 'text') : undefined}
      >
        {isEditorMode && (
          <button
            type="button"
            className="absolute -top-3 -left-3 pointer-events-auto cursor-grab active:cursor-grabbing bg-amber-500 text-zinc-950 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow-lg flex items-center gap-1.5"
            onMouseDown={(event) => startTextInteraction(event, 'text')}
            title="Textblock verschieben"
          >
            <span>✦</span>
            <span>Ziehen zum Verschieben</span>
            {activeStation.textLayer === 'behind' && (
              <span className="text-[8px] bg-amber-600 text-white rounded px-1.5 py-0.5 normal-case font-normal font-sans">Hinter Modell (im Vorschaumodus)</span>
            )}
          </button>
        )}

        {isEditorMode && (
          <button
            type="button"
            className="absolute -bottom-3 -right-3 z-10 h-7 w-7 pointer-events-auto cursor-nwse-resize rounded-full border border-amber-300/70 bg-zinc-950 text-amber-300 shadow-lg flex items-center justify-center"
            onMouseDown={(event) => startTextInteraction(event, 'text-resize')}
            title="Textblock vergrößern oder verkleinern"
            aria-label="Textblock vergrößern oder verkleinern"
          >
            <span className="text-sm leading-none">↘</span>
          </button>
        )}

        <div className="station-kicker station-motion-kicker" aria-hidden="true">
          <span>Station {String(activeIndex + 1).padStart(2, '0')}</span>
          <span className="station-kicker-line"></span>
        </div>

        <h1 className="station-title station-motion-title font-serif flex flex-col">
          {(activeStation.title || "").split('\\n').map((line, idx) => (
            <span key={idx} className="station-title-line block">
              {parseTextWithHighlights(line)}
            </span>
          ))}
        </h1>

        <div
          id={mobileDetailsId}
          data-wheel-scroll={showMobileCollapsible ? 'station-description' : undefined}
          tabIndex={showMobileCollapsible && mobileDetailsExpanded ? 0 : undefined}
          className={`station-collapsible-content station-motion-body ${mobileDetailsExpanded ? 'is-expanded' : 'is-collapsed'}`}
          onWheel={showMobileCollapsible ? (event) => event.stopPropagation() : undefined}
          onTouchMove={showMobileCollapsible ? (event) => event.stopPropagation() : undefined}
        >
          {/* Elegant Gold Divider */}
          <div className="station-divider flex items-center gap-4 my-5 w-full max-w-md">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#c9a96e]/60 to-[#c9a96e]/80"></div>
            <div className="w-2.5 h-2.5 rotate-45 border border-[#c9a96e] bg-[#0c0d12]/80 flex-shrink-0 shadow-[0_0_8px_rgba(201,169,110,0.5)]"></div>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#c9a96e]/60 to-[#c9a96e]/80"></div>
          </div>

        {/* Description */}
          <p className="station-description text-[#c8c3bc] text-xs sm:text-sm sm:leading-relaxed max-w-md font-light">
            {parseTextWithHighlights(activeStation.description, true)}
          </p>

        {/* Reveal mode notification indicator */}
          {activeStation.viewMode === 'portal' && (
          <div className="station-indicator-box mt-4 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[10px] leading-relaxed text-amber-400/90 flex gap-2 items-start max-w-md">
            <Compass size={12} className="mt-0.5 shrink-0 animate-pulse" />
            <span>Zeitportal komplett: Die Rekonstruktion ist voll sichtbar, der Übergang zum Reveal folgt in der nächsten Station.</span>
          </div>
          )}
        {/* Sub-block section at the bottom */}
          {(activeStation.subTitle || activeStation.subDescription) && (
          <div className="flex items-start gap-4 mt-8 border-t border-white/10 pt-6 max-w-sm">
            <div className="w-7 h-7 rounded-full border border-[#c9a96e]/30 flex items-center justify-center shrink-0 text-[#c9a96e] bg-[#c9a96e]/5 mt-0.5 shadow-[0_0_8px_rgba(201,169,110,0.1)]">
              <span className="text-[10px] font-serif text-[#c9a96e]">✦</span>
            </div>
            <div>
              {activeStation.subTitle && (
                <h4 className="text-[10px] normal-case font-bold tracking-normal text-[#c9a96e] mb-1 font-serif">
                  {parseTextWithHighlights(activeStation.subTitle)}
                </h4>
              )}
              {activeStation.subDescription && (
                 <p className="station-sub-description text-[11px] leading-relaxed text-zinc-400 font-light">
                   {activeStation.subDescription.split('\\n').map((line, idx) => (
                     <React.Fragment key={idx}>
                       {idx > 0 && <br />}
                       {parseTextWithHighlights(line, true)}
                     </React.Fragment>
                   ))}
                 </p>
              )}
            </div>
          </div>
          )}
        </div>

        {showMobileCollapsible && (activeStation.description || activeStation.subTitle || activeStation.subDescription) && (
          <button
            type="button"
            className="station-text-more-button"
            aria-expanded={mobileDetailsExpanded}
            aria-controls={mobileDetailsId}
            onClick={() => setExpandedStationId(mobileDetailsExpanded ? null : activeStation.id)}
          >
            <span>{mobileDetailsExpanded ? 'Weniger anzeigen' : 'Mehr lesen'}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      </div>
    </div>
  );

  if (renderBehind && document.getElementById('bg-root')) {
    return createPortal(textBlockElement, document.getElementById('bg-root'));
  }
  return textBlockElement;
}
