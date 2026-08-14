import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sun } from 'lucide-react';
import { DEFAULT_PROJECT_LIGHTING, LIGHT_POSITION_CONFIGS, LIGHT_SOURCES } from '../../constants.js';
import { LightPositionControl } from './LightPositionControl.jsx';

export function ProjectLightingPanel({ lighting = DEFAULT_PROJECT_LIGHTING, onChange, embedded = false }) {
  const [expanded, setExpanded] = useState(false);
  const update = (patch) => onChange?.({ ...lighting, ...patch });

  const updatePosition = (_index, positionKey, axis, value) => {
    update({ [positionKey]: { ...lighting[positionKey], [axis]: value } });
  };

  const toggleFixedToCamera = (_index, positionKey, fixedKey, isFixed) => {
    const currentPosition = lighting[positionKey];
    const converted = window.appState?.convertPositionBetweenSpaces?.(currentPosition, isFixed) ?? currentPosition;
    update({ [fixedKey]: isFixed, [positionKey]: converted });
  };

  return (
    <section className={embedded ? 'p-3' : 'border-b border-white/10 bg-zinc-950/70 px-5 py-3'}>
      {!embedded && <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2.5">
          <Sun size={14} className="text-amber-400" />
          <span>
            <span className="block text-xs font-semibold text-zinc-200">Projektbeleuchtung</span>
            <span className="block text-[9px] text-zinc-500">Gilt für alle Stationen</span>
          </span>
        </span>
        {expanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
      </button>}

      {(embedded || expanded) && (
        <div className={`flex flex-col gap-3 ${embedded ? '' : 'mt-3 border-t border-zinc-800 pt-3'}`}>
          <label className="flex flex-col gap-1 text-left">
            <span className="flex justify-between text-[10px] font-bold text-zinc-400">
              <span>Lichtintensität</span>
              <span className="font-mono text-amber-400">{(lighting.lightIntensity ?? 1).toFixed(1)}x</span>
            </span>
            <input type="range" min="0" max="4" step="0.1" value={lighting.lightIntensity ?? 1} onChange={(event) => update({ lightIntensity: Number(event.target.value) })} className="h-1 w-full cursor-pointer rounded bg-zinc-800 accent-amber-500" />
          </label>

          <label className="flex flex-col gap-1 text-left">
            <span className="flex justify-between text-[10px] font-bold text-zinc-400">
              <span>Schattendiffusität (Radius)</span>
              <span className="font-mono text-amber-400">{(lighting.shadowDiffuse ?? 1).toFixed(1)}</span>
            </span>
            <input type="range" min="0" max="10" step="0.5" value={lighting.shadowDiffuse ?? 1} onChange={(event) => update({ shadowDiffuse: Number(event.target.value) })} className="h-1 w-full cursor-pointer rounded bg-zinc-800 accent-amber-500" />
          </label>

          <div className="grid grid-cols-2 gap-2 border-t border-zinc-800/60 pt-2">
            {LIGHT_SOURCES.map(({ key, label, desc }) => (
              <label key={key} className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950/40 p-2 select-none hover:border-amber-500/20">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={lighting[key] ?? true} onChange={(event) => update({ [key]: event.target.checked })} className="accent-amber-500" />
                  <span className="text-[11px] font-medium text-zinc-200">{label}</span>
                </span>
                <span className="block pl-5 text-[8px] text-zinc-500">{desc}</span>
              </label>
            ))}
          </div>

          {LIGHT_POSITION_CONFIGS.map((config) => (lighting[config.enabledKey] ?? true) && (
            <LightPositionControl
              key={config.posKey}
              station={lighting}
              stationIndex={null}
              config={config}
              onUpdateLightPos={updatePosition}
              onToggleFixedToCamera={toggleFixedToCamera}
            />
          ))}
        </div>
      )}
    </section>
  );
}
