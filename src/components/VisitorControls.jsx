import React, { useEffect, useRef, useState } from 'react';
import { Home, Info, MousePointer2, RotateCcw, Volume2, VolumeX } from 'lucide-react';

export function VisitorControls({
  activeStation,
  appState,
  authorId,
  authorName,
  editorNames = [],
  isMuted,
  onToggleMute,
  storyTitle,
  showStoryTitle = false
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef(null);

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

  if (appState.stationMode !== 'scroll') return null;

  return (
    <>
      <div
        className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-[#8a6f3e] via-[#c9a96e] to-[#f5e0b3] z-50 transition-all duration-300 ease-out shadow-[0_1px_12px_rgba(201,169,110,0.5)]"
        style={{ width: `${(appState.scrollProgress ?? 0) * 100}%` }}
      />
      <div className="visitor-top-controls fixed top-5 left-5 z-40 flex items-center gap-2 pointer-events-auto">
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

      {activeStation?.freeNavigation && appState.freeNavigationActive && (
        <button
          type="button"
          onClick={() => window.appState?.resetFreeView?.()}
          className="fixed top-5 right-5 z-40 rounded-full border border-white/10 bg-zinc-950/45 p-2.5 text-zinc-400 backdrop-blur-xl pointer-events-auto transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] hover:shadow-[0_0_15px_rgba(201,169,110,0.2)] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer"
          title="Ansicht zurücksetzen"
          aria-label="Ansicht zurücksetzen"
        >
          <RotateCcw size={15} />
        </button>
      )}

      {activeStation?.freeNavigation && !appState.freeNavigationActive && (
        <button
          type="button"
          onClick={() => window.appState?.activateFreeNavigation?.()}
          className="fixed bottom-8 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-zinc-950/80 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200 shadow-[0_5px_24px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all hover:border-amber-400/60 hover:bg-zinc-900/90 active:scale-95"
          aria-label="Freie Ansicht aktivieren"
        >
          <MousePointer2 size={14} />
          Freie Ansicht per Klick aktivieren
        </button>
      )}
    </>
  );
}
