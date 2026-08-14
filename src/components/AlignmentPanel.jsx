import React from 'react';
import { Compass, CornerDownRight, Hourglass } from 'lucide-react';

export function AlignmentPanel({ appState, projectName, projectSubtitle, onResetAlignment, onSkipAlignment }) {
  return (
    <div className="absolute inset-0 w-full h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 text-white pointer-events-none select-none">
      <header className="flex justify-between items-start w-full z-10 pointer-events-none">
        <div className="alignment-header flex items-center gap-3 bg-zinc-950/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:px-5 pointer-events-auto">
          <span className="text-2xl text-amber-400 filter drop-shadow-[0_0_8px_rgba(201,169,110,0.5)]">⛩</span>
          <div>
            <h1 className="font-serif text-lg sm:text-xl font-bold tracking-wide">{projectName}</h1>
            {projectSubtitle && (
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest">{projectSubtitle}</p>
            )}
          </div>
        </div>
      </header>

      <div className="alignment-panel-container w-full lg:w-[480px] bg-zinc-950/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 ml-auto mt-auto pointer-events-auto">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Compass className="text-amber-400 animate-spin" style={{ animationDuration: '6s' }} size={18} />
              <h3 className="text-sm font-semibold tracking-wide uppercase">Modell-Ausrichtung</h3>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold uppercase tracking-wider">
              Kalibrierung
            </span>
          </div>
          
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Verknüpfen Sie **3 identische Punkte** auf beiden Modellen. Wählen Sie zuerst 3 Referenzpunkte auf der Ruine und danach dieselben 3 Punkte auf der Rekonstruktion.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { id: 0, label: 'Ruine', sub: 'Punkt 1' },
              { id: 1, label: 'Ruine', sub: 'Punkt 2' },
              { id: 2, label: 'Ruine', sub: 'Punkt 3' },
              { id: 3, label: 'Rekon.', sub: 'Punkt 1' },
              { id: 4, label: 'Rekon.', sub: 'Punkt 2' },
              { id: 5, label: 'Rekon.', sub: 'Punkt 3' }
            ].map((s) => {
              const isDone = appState.alignStep > s.id;
              const isActive = appState.alignStep === s.id;
              return (
                <div 
                  key={s.id} 
                  className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 border ${
                    isDone 
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' 
                      : isActive 
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 animate-pulse' 
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <div className="text-[10px] uppercase font-bold tracking-widest">{s.label}</div>
                  <div className="text-xs font-semibold mt-1">{s.sub}</div>
                  <div className="mt-1 text-[9px]">{isDone ? '✓ Gesetzt' : isActive ? 'Klicken…' : '—'}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
            {appState.alignTarget === 'ruin' && (
              <span className="text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5">
                <CornerDownRight size={14} className="animate-bounce" />
                Klicken Sie auf Punkt {appState.alignStep + 1} auf der <strong className="text-amber-400">Ruine (Mitte)</strong>
              </span>
            )}
            {appState.alignTarget === 'recon' && (
              <span className="text-xs text-cyan-300 font-medium flex items-center justify-center gap-1.5">
                <CornerDownRight size={14} className="animate-bounce" />
                Klicken Sie auf Punkt {appState.alignStep - 2} auf der <strong className="text-cyan-400">Rekonstruktion (Mitte)</strong>
              </span>
            )}
            {appState.alignTarget === 'done' && (
              <span className="text-xs text-emerald-400 font-medium flex items-center justify-center gap-2">
                <Hourglass size={14} className="animate-spin" />
                Ausrichtung komplett! Modelle werden verschmolzen...
              </span>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button onClick={onResetAlignment} className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 active:scale-98 border border-zinc-700/50 rounded-xl py-2.5 text-xs font-semibold transition-all">
              Zurücksetzen
            </button>
            <button onClick={onSkipAlignment} className="flex-1 bg-zinc-900/80 hover:bg-zinc-800 active:scale-98 border border-zinc-700/50 rounded-xl py-2.5 text-xs font-semibold transition-all">
              Überspringen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
