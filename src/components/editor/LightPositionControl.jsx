import React from 'react';

export function LightPositionControl({ station, stationIndex, config, onUpdateLightPos, onToggleFixedToCamera }) {
  const pos = station[config.posKey] ?? { ...config.defaultPos };

  return (
    <div className="flex flex-col gap-1.5 text-left bg-zinc-950/30 border border-zinc-800/40 rounded-xl p-2.5 mt-1 animate-blur-fade-up">
      <div className="flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-wider font-bold text-amber-400/80">
          {config.label}
        </span>
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-300 transition-colors text-[9px] font-semibold text-zinc-400 select-none">
          <input 
            type="checkbox"
            checked={!!station[config.fixedKey]}
            onChange={(e) => onToggleFixedToCamera(stationIndex, config.posKey, config.fixedKey, e.target.checked)}
            className="accent-amber-500 rounded border-zinc-700 bg-zinc-900 w-2.5 h-2.5"
          />
          <span>An Kamera fixieren</span>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {config.axes.map(({ axis, label, min, max, fallback }) => {
          const val = pos[axis] ?? fallback;
          return (
            <div key={axis} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-[8px] text-zinc-500 font-bold uppercase">
                <span>{label}</span>
                <span className="text-amber-400 font-mono font-normal">{val.toFixed(0)}</span>
              </div>
              <input 
                type="range" min={min} max={max} step="1" 
                value={val} 
                onChange={(e) => onUpdateLightPos(stationIndex, config.posKey, axis, parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-zinc-800 rounded cursor-pointer"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
