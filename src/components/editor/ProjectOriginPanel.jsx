import React, { useState } from 'react';
import { Crosshair, ChevronDown, ChevronUp } from 'lucide-react';

export function ProjectOriginPanel({ orbitTarget, isPlacing, onPlace, embedded = false }) {
  const [open, setOpen] = useState(true);
  const target = orbitTarget ?? { x: 0, y: 0, z: 0 };

  return (
    <div className={embedded ? 'p-3' : 'shrink-0 border-b border-white/10 bg-zinc-950/70 px-5 py-3'}>
      {!embedded && <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
        <span className="flex items-center gap-2.5">
          <Crosshair size={14} className="text-amber-400" />
          <span>
            <strong className="block text-[10px] uppercase tracking-wider text-zinc-300">Projekt-Nullpunkt</strong>
            <small className="block text-[8px] font-normal text-zinc-600">Drehzentrum der freien Ansicht</small>
          </span>
        </span>
        {open ? <ChevronUp size={13} className="text-zinc-600" /> : <ChevronDown size={13} className="text-zinc-600" />}
      </button>}
      {(embedded || open) && (
        <div className={`${embedded ? '' : 'mt-2.5'} flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/45 p-2.5`}>
          <div className="min-w-0 flex-1 font-mono text-[9px] text-zinc-400">
            X {target.x.toFixed(2)} · Y {target.y.toFixed(2)} · Z {target.z.toFixed(2)}
          </div>
          <button
            type="button"
            onClick={onPlace}
            className={`${isPlacing ? 'border-amber-400 bg-amber-500 text-zinc-950' : 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'} shrink-0 rounded-lg border px-2.5 py-1.5 text-[9px] font-semibold transition-colors`}
          >
            {isPlacing ? 'Abbrechen' : 'Im Modell setzen'}
          </button>
        </div>
      )}
    </div>
  );
}
