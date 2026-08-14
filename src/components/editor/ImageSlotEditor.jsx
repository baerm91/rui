import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { IMAGE_SLOT_POSITION_FIELDS } from '../../constants.js';

export function ImageSlotEditor({ img, imgIndex, stationIndex, isActive, onToggle, onUpdateImage, onUploadImage }) {
  const getImageSelectValue = (imgUrl) => {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('data:image/')) return 'upload';
    return 'custom';
  };

  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-900/30">
      <button
        type="button"
        onClick={() => onToggle(isActive ? null : imgIndex)}
        className="w-full flex justify-between items-center px-2.5 py-1.5 text-left bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors text-[9px] font-bold uppercase text-zinc-400"
      >
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${img.url ? 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.5)]' : 'bg-zinc-655'}`} />
          Bild #{imgIndex + 1} {img.url ? '(Aktiv)' : '(Leer)'}
        </span>
        {isActive ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {isActive && (
        <div className="p-3 flex flex-col gap-3 border-t border-zinc-850/50 bg-zinc-950/20 text-left animate-blur-fade-up">
          {/* Image Source Select */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Bildquelle</label>
            <select
              value={getImageSelectValue(img.url)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'upload') {
                  onUpdateImage(stationIndex, imgIndex, 'url', 'data:image/placeholder;base64,');
                } else if (val === 'custom') {
                  onUpdateImage(stationIndex, imgIndex, 'url', 'custom_image_url.png');
                } else {
                  onUpdateImage(stationIndex, imgIndex, 'url', '');
                }
              }}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="">Keines (Ausblenden)</option>
              <option value="upload">Datei hochladen (.png, .jpg, .svg)</option>
              <option value="custom">Pfad / Web-URL</option>
            </select>

            {getImageSelectValue(img.url) === 'upload' && (
              <div className="mt-1 flex flex-col gap-1">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => onUploadImage(stationIndex, imgIndex, e)}
                  className="w-full bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-0.5 text-[10px] focus:outline-none focus:border-cyan-500/50"
                />
                {img.url && img.url.startsWith('data:image/') && !img.url.includes('placeholder') && (
                  <span className="text-[8px] text-cyan-400 font-semibold">✓ Geladen ({Math.round(img.url.length / 1024)} KB)</span>
                )}
              </div>
            )}

            {getImageSelectValue(img.url) === 'custom' && (
              <input 
                type="text" 
                placeholder="z.B. heidentor_blueprint.png oder https://..."
                value={img.url === 'custom_image_url.png' ? '' : img.url}
                onChange={(e) => onUpdateImage(stationIndex, imgIndex, 'url', e.target.value)}
                className="w-full mt-1 bg-zinc-950/70 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            )}
          </div>

          {img.url && (
            <>
              {/* Position posX, posY, posZ */}
              <div className="grid grid-cols-3 gap-2">
                {IMAGE_SLOT_POSITION_FIELDS.map(({ field, label, min, max, fallback }) => (
                  <div key={field} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-[8px] text-zinc-500 font-bold uppercase">
                      <span>{label}</span>
                      <span className="text-cyan-400 font-mono">{(img[field] ?? fallback).toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" min={`${min}.0`} max={`${max}.0`} step="0.1" 
                      value={img[field] ?? fallback} 
                      onChange={(e) => onUpdateImage(stationIndex, imgIndex, field, parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>

              {/* Scale slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[8px] text-zinc-500 font-bold uppercase">
                  <span>Größe (Skalierung)</span>
                  <span className="text-cyan-400 font-mono">{(img.scale ?? 1.0).toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0.1" max="8.0" step="0.1" 
                  value={img.scale ?? 1.0} 
                  onChange={(e) => onUpdateImage(stationIndex, imgIndex, 'scale', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
                />
              </div>

              {/* Checkbox fixToCamera */}
              <label className="flex items-center gap-2 py-1 bg-zinc-950/40 border border-zinc-800/40 rounded-lg text-[10px] cursor-pointer hover:border-zinc-700/60 select-none px-2.5">
                <input 
                  type="checkbox"
                  checked={!!img.fixToCamera}
                  onChange={(e) => onUpdateImage(stationIndex, imgIndex, 'fixToCamera', e.target.checked)}
                  className="accent-cyan-400 rounded border-zinc-700 bg-zinc-900"
                />
                <span className="text-zinc-300">An Position & Blickwinkel der Kamera fixieren</span>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
