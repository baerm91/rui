import React from 'react';

export function VideoOverlay({ activeStation, isEditorMode, isEditorWorkspace = false, onDragStart }) {
  if (!activeStation?.videoUrl) return null;

  return (
    <div
      className={`fixed z-30 transition-all duration-700 ease-in-out station-video-panel ${
        isEditorMode
          ? 'pointer-events-none border border-dashed border-cyan-400/60 bg-zinc-950/35 p-2 rounded-xl'
          : 'pointer-events-auto'
      }`}
      style={{
        left: isEditorWorkspace
          ? `calc((100vw - var(--editor-panel-width)) * ${(activeStation.videoX ?? 58) / 100})`
          : `${activeStation.videoX ?? 58}vw`,
        top: isEditorWorkspace
          ? `calc(var(--editor-stage-top) + var(--editor-stage-height) * ${(activeStation.videoY ?? 22) / 100})`
          : `${activeStation.videoY ?? 22}vh`,
        width: isEditorWorkspace
          ? `calc((100vw - var(--editor-panel-width)) * ${(activeStation.videoWidth ?? 28) / 100})`
          : `${activeStation.videoWidth ?? 28}vw`,
        height: isEditorWorkspace
          ? `calc((100vw - var(--editor-panel-width)) * ${(activeStation.videoHeight ?? 18) / 100})`
          : `${activeStation.videoHeight ?? 18}vw`,
        minWidth: '220px',
        minHeight: '124px'
      }}
    >
      {isEditorMode && (
        <button
          type="button"
          className="absolute -top-3 -left-3 pointer-events-auto cursor-grab active:cursor-grabbing bg-cyan-400 text-zinc-950 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded shadow-lg"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            onDragStart({
              type: 'video',
              startX: event.clientX,
              startY: event.clientY,
              startValueX: activeStation.videoX ?? 58,
              startValueY: activeStation.videoY ?? 22
            });
          }}
          title="Video verschieben"
        >
          Video ziehen
        </button>
      )}
      <iframe
        title={`Video ${activeStation.title || 'Station'}`}
        src={activeStation.videoUrl}
        className={`w-full h-full rounded-xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_30px_rgba(201,169,110,0.2)] ${isEditorMode ? 'pointer-events-none' : ''}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
