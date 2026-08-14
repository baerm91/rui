import React, { useRef } from 'react';
import { Box, FolderOpen, LoaderCircle, Trash2 } from 'lucide-react';

export function LocalModelPanel({
  localModelName,
  expectedModelName,
  localModelStatus,
  localModelError,
  localModelEnvironmentRemoved,
  localModelMaterialsConverted,
  onChooseLocalModelFolder,
  onLocalModelFiles,
  onRemoveLocalModel
}) {
  const directoryInputRef = useRef(null);

  const chooseModelFolder = async () => {
    const handledNatively = await onChooseLocalModelFolder();
    if (!handledNatively) directoryInputRef.current?.click();
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/45 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Box size={15} className="text-amber-400" />
        <div>
          <h3 className="text-xs font-bold">Lokales 3D-Modell</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Ordner mit GLTF/GLB, BIN und Texturen auswählen</p>
        </div>
      </div>
      <input
        ref={directoryInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(event) => {
          onLocalModelFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={chooseModelFolder}
          disabled={localModelStatus === 'loading'}
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 rounded-xl py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          {localModelStatus === 'loading' ? <LoaderCircle size={14} className="animate-spin" /> : <FolderOpen size={14} />}
          <span>{localModelName ? 'Modell ersetzen' : expectedModelName ? 'Modell wiederherstellen' : 'Modellordner wählen'}</span>
        </button>
        {localModelName && (
          <button
            onClick={onRemoveLocalModel}
            className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded-xl text-red-300 transition-colors"
            title="Lokales Modell entfernen"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {localModelName && <p className="text-[10px] text-emerald-400 truncate" title={localModelName}>Geladen: {localModelName}</p>}
      {!localModelName && expectedModelName && (
        <p className="text-[10px] text-amber-300/80 leading-relaxed" title={expectedModelName}>
          Gespeichertes Modell: <span className="font-mono">{expectedModelName}</span>. Es wird für dieses Projekt automatisch geladen.
        </p>
      )}
      {localModelName && localModelEnvironmentRemoved?.length > 0 && (
        <p className="text-[10px] text-cyan-300/85 leading-relaxed">
          {localModelEnvironmentRemoved.length} Panorama-/Umgebungs-Mesh(es) ausgeblendet, damit Modell, Zoom und Licht korrekt funktionieren.
        </p>
      )}
      {localModelName && localModelMaterialsConverted > 0 && (
        <p className="text-[10px] text-amber-300/80 leading-relaxed">
          {localModelMaterialsConverted} unbeleuchtete Material(ien) für die Editor-Beleuchtung angepasst.
        </p>
      )}
      {localModelError && <p className="text-[10px] text-red-400 leading-relaxed">{localModelError}</p>}
    </section>
  );
}
