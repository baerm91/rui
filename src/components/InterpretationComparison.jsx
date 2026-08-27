import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, MousePointer2, ScanSearch } from 'lucide-react';
import { getInterpretationState, normalizeInterpretationComparison } from '../utils/interpretationComparison.js';

export function InterpretationComparison({ comparison, viewMode, onExplore, onViewModeChange }) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const explanationButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const normalized = normalizeInterpretationComparison(comparison);
  const activeState = getInterpretationState(normalized, viewMode);

  useEffect(() => {
    if (!explanationOpen) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setExplanationOpen(false);
      explanationButtonRef.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [explanationOpen]);

  useEffect(() => {
    setExplanationOpen(false);
  }, [comparison]);

  if (!normalized) return null;

  const selectView = (mode) => {
    setExplanationOpen(false);
    onViewModeChange?.(mode);
  };

  return (
    <section
      className="interpretation-comparison pointer-events-auto fixed bottom-6 left-5 z-40 w-[min(31rem,calc(100vw-2.5rem))] rounded-2xl border border-white/15 bg-zinc-950/85 p-3.5 text-zinc-100 shadow-2xl backdrop-blur-xl motion-reduce:transition-none"
      aria-labelledby="interpretation-comparison-title"
    >
      <span id="interpretation-comparison-title" className="block text-[9px] font-semibold uppercase tracking-[0.17em] text-amber-300/75">
        {normalized.title}
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Darstellungszustand wählen">
        {normalized.states.map((state) => (
          <button
            key={state.id}
            type="button"
            className={`rounded-full border px-3 py-2 text-[10px] font-semibold transition-colors motion-reduce:transition-none ${viewMode === state.viewMode ? 'border-amber-300/70 bg-amber-300/15 text-amber-100' : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/25 hover:text-white'}`}
            aria-pressed={viewMode === state.viewMode}
            onClick={() => selectView(state.viewMode)}
          >
            {state.label}
          </button>
        ))}
        {normalized.explanation && (
          <button
            ref={explanationButtonRef}
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold text-zinc-300 transition-colors hover:border-white/25 hover:text-white motion-reduce:transition-none"
            aria-expanded={explanationOpen}
            aria-controls="interpretation-explanation"
            onClick={() => setExplanationOpen((open) => !open)}
          >
            <HelpCircle size={13} aria-hidden="true" />
            {normalized.explanation.label}
          </button>
        )}
      </div>

      {activeState?.description && (
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-300" aria-live="polite">
          {activeState.description}
        </p>
      )}

      {normalized.experimentalMode && (
        <button
          type="button"
          className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium underline decoration-white/25 underline-offset-4 transition-colors hover:text-amber-200 motion-reduce:transition-none ${viewMode === 'reveal' ? 'text-amber-200' : 'text-zinc-400'}`}
          aria-pressed={viewMode === 'reveal'}
          onClick={() => selectView('reveal')}
        >
          <ScanSearch size={13} aria-hidden="true" />
          {normalized.experimentalMode.label} <span className="text-zinc-500">(experimentell)</span>
        </button>
      )}

      {onExplore && (
        <button
          type="button"
          className="mt-2 ml-4 inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 underline decoration-white/25 underline-offset-4 transition-colors hover:text-amber-200 motion-reduce:transition-none"
          onClick={onExplore}
        >
          <MousePointer2 size={13} aria-hidden="true" />
          Freie Ansicht
        </button>
      )}

      {explanationOpen && normalized.explanation && (
        <div id="interpretation-explanation" className="mt-3 border-t border-white/10 pt-3" role="dialog" aria-modal="false" aria-labelledby="interpretation-explanation-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <strong id="interpretation-explanation-title" className="font-serif text-base text-amber-100">{normalized.explanation.title}</strong>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">{normalized.explanation.text}</p>
              {normalized.explanation.sourceLabel && (
                normalized.explanation.sourceUrl
                  ? <a className="mt-2 inline-block text-[10px] text-amber-200 underline underline-offset-4" href={normalized.explanation.sourceUrl} target="_blank" rel="noreferrer">{normalized.explanation.sourceLabel}</a>
                  : <p className="mt-2 text-[10px] text-amber-200">{normalized.explanation.sourceLabel}</p>
              )}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] text-zinc-300 hover:text-white"
              onClick={() => {
                setExplanationOpen(false);
                explanationButtonRef.current?.focus();
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
