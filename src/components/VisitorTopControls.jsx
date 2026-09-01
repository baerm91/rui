import React, { useEffect, useRef, useState } from 'react';
import { Home, Info, Volume2, VolumeX } from 'lucide-react';

export function VisitorTopControls({
  authorId,
  authorName,
  editorNames = [],
  homeHref = '/discover',
  isMuted = true,
  onToggleMute,
  showInfo = true,
  showMute = true,
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

  return <div className="visitor-top-controls fixed top-5 left-5 z-40 flex items-center gap-2 pointer-events-auto">
    <a
      href={homeHref}
      className="flex h-[38px] items-center gap-2 rounded-full border border-white/10 bg-zinc-950/45 px-3.5 font-serif text-sm font-semibold tracking-[0.16em] text-zinc-200 no-underline shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] active:scale-95"
      title="Zu Discover"
      aria-label="Zu Discover"
    >
      <span>RIU</span>
      <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
      <Home size={14} aria-hidden="true" />
    </a>
    {showMute && <button
      type="button"
      onClick={onToggleMute}
      className="p-2.5 rounded-full border border-white/10 bg-zinc-950/45 backdrop-blur-xl transition-all duration-300 hover:border-[#c9a96e]/40 hover:bg-zinc-900/60 hover:text-[#c9a96e] hover:shadow-[0_0_15px_rgba(201,169,110,0.2)] active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer"
      title={isMuted ? 'Ton einschalten' : 'Stummschalten'}
      aria-label={isMuted ? 'Ton einschalten' : 'Stummschalten'}
    >
      {isMuted
        ? <VolumeX size={15} className="text-zinc-400 transition-colors" />
        : <Volume2 size={15} className="text-[#c9a96e] animate-pulse" />}
    </button>}
    {showInfo && <div className="relative" ref={infoRef}>
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
      {infoOpen && <div className="visitor-story-info absolute left-0 top-[calc(100%+0.6rem)] w-64 rounded-xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-2xl">
        <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300/65">Kuratiert von</span>
        {authorId
          ? <a href={`/discover?author=${encodeURIComponent(authorId)}`} className="mt-1.5 block font-serif text-lg text-zinc-100 transition-colors hover:text-amber-200">{authorName || 'RIU Autor:in'}</a>
          : <span className="mt-1.5 block font-serif text-lg text-zinc-100">{authorName || 'RIU Autor:in'}</span>}
        {editorNames.length > 0 && <div className="mt-3 border-t border-white/10 pt-3">
          <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300/65">Editor:innen</span>
          <span className="mt-1.5 block text-xs leading-relaxed text-zinc-300">{editorNames.join(', ')}</span>
        </div>}
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-300">Weitere veröffentlichte Stories dieser Person anzeigen.</p>
      </div>}
    </div>}
    {showStoryTitle && storyTitle && <span className="visitor-story-title font-serif">{storyTitle}</span>}
  </div>;
}
