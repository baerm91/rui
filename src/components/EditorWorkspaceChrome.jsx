import React from 'react';
import { Box, Camera, Check, Clapperboard, Crosshair, Home, LoaderCircle, TriangleAlert, Volume2, VolumeX } from 'lucide-react';

export function EditorWorkspaceChrome({
  appState,
  canCaptureThumbnail,
  canCapturePreview,
  hasStoryPreview,
  hasRenderableModel,
  isEditorMode,
  isEditing,
  isMuted,
  onCaptureThumbnail,
  onCapturePreview,
  onPreviewEndStationChange,
  onToggleMute,
  projectNeedsLocalModel,
  projectName,
  previewStatus,
  previewEndStation,
  previewStationCount,
  thumbnailStatus,
  usesExternalViewer
}) {
  if (!isEditorMode) return null;

  const hasModelError = appState.baseModelStatus === 'error';

  return (
    <>
      {!hasRenderableModel && (
        <div className="editor-stage-status fixed z-40 pointer-events-none flex items-center justify-center">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-zinc-950/80 px-5 py-4 backdrop-blur-2xl shadow-2xl">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                hasModelError
                  ? 'border-red-500/20 bg-red-500/10 text-red-300'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
              }`}>
                {hasModelError || projectNeedsLocalModel
                  ? <TriangleAlert size={17} />
                  : <LoaderCircle size={17} className="animate-spin" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-100">
                  {projectNeedsLocalModel
                    ? 'Projektmodell auswählen'
                    : hasModelError ? '3D-Modell nicht verfügbar' : '3D-Modell wird geladen'}
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">
                  {projectNeedsLocalModel
                    ? `Für „${projectName}“ ist noch kein lokales Vorschaumodell geladen.`
                    : hasModelError
                    ? (appState.baseModelError || 'Das Ausgangsmodell konnte nicht geladen werden.')
                    : 'Der Editor ist bereits einsatzbereit. Inhalte und Projekteinstellungen können parallel bearbeitet werden.'}
                </p>
                {(hasModelError || projectNeedsLocalModel) && (
                  <p className="mt-2 flex items-center gap-1.5 text-[9px] text-amber-300/80">
                    <Box size={11} />
                    Unter „Projekt & 3D-Modell“ kann ein lokales Modell gewählt werden.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="editor-viewport-frame" aria-hidden="true">
          <span>Demo-Ausschnitt</span>
        </div>
      )}

      <a
        href="/discover"
        className="fixed left-4 top-4 z-50 pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-950/80 text-zinc-300 shadow-xl backdrop-blur-xl transition-all hover:border-amber-400/60 hover:bg-zinc-900 hover:text-amber-300 active:scale-95"
        title="Zur Galerie"
        aria-label="Zur Galerie"
      >
        <Home size={15} />
      </a>

      <button
        type="button"
        onClick={onToggleMute}
        className="fixed left-16 top-4 z-50 pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-950/80 text-zinc-300 shadow-xl backdrop-blur-xl transition-all hover:border-amber-400/60 hover:bg-zinc-900 hover:text-amber-300 active:scale-95"
        title={isMuted ? 'Ton im Editor einschalten' : 'Editor stummschalten'}
        aria-label={isMuted ? 'Ton im Editor einschalten' : 'Editor stummschalten'}
        aria-pressed={!isMuted}
      >
        {isMuted
          ? <VolumeX size={15} className="text-zinc-400" />
          : <Volume2 size={15} className="text-amber-300" />}
      </button>

      {isEditing && (
        <div className="fixed left-28 top-4 z-50 pointer-events-auto flex h-10 items-stretch overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-950/80 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={onCapturePreview}
            disabled={!canCapturePreview || previewStatus === 'saving'}
            className="flex items-center gap-2 px-3.5 text-[10px] font-semibold text-amber-200 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-45"
            title={canCapturePreview ? `WebM-Preview von Station 1 bis Station ${previewEndStation} erzeugen` : usesExternalViewer ? 'Sketchfab-Inhalte können nicht in RIUs WebM-Aufnahme übernommen werden' : 'Mindestens zwei Stationen und ein geladenes Modell erforderlich'}
          >
            {previewStatus === 'saving'
              ? <LoaderCircle size={14} className="animate-spin" />
              : previewStatus === 'saved'
                ? <Check size={14} />
                : previewStatus === 'error' ? <TriangleAlert size={14} /> : <Clapperboard size={14} />}
            {previewStatus === 'saving'
              ? 'Preview wird erstellt …'
              : previewStatus === 'saved'
                ? 'Preview erstellt'
                : previewStatus === 'error'
                  ? 'Preview konnte nicht erstellt werden'
                  : hasStoryPreview ? 'Preview neu erstellen' : 'Preview erstellen'}
          </button>
          <label className="flex items-center border-l border-white/10 px-2 text-[8px] uppercase tracking-[0.1em] text-zinc-500">
            bis
            <select
              value={previewEndStation}
              onChange={(event) => onPreviewEndStationChange(Number(event.target.value))}
              disabled={previewStatus === 'saving' || previewStationCount < 2}
              className="ml-1 cursor-pointer bg-transparent py-2 text-[9px] font-semibold text-zinc-200 outline-none disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Letzte Station der Preview"
            >
              {Array.from({ length: Math.max(0, previewStationCount - 1) }, (_, index) => index + 2)
                .map((stationNumber) => (
                  <option key={stationNumber} value={stationNumber} className="bg-zinc-950">
                    Station {stationNumber}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      {isEditing && (
        <button
          type="button"
          onClick={onCaptureThumbnail}
          disabled={!canCaptureThumbnail || thumbnailStatus === 'saving'}
          className="fixed left-[32rem] top-4 z-50 pointer-events-auto flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/80 px-3.5 text-[10px] font-semibold text-zinc-300 shadow-xl backdrop-blur-xl transition-colors hover:border-amber-400/60 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-45"
          title="Aktuelle Kameraperspektive als Story-Vorschaubild speichern"
        >
          {thumbnailStatus === 'saving'
            ? <LoaderCircle size={14} className="animate-spin" />
            : thumbnailStatus === 'saved'
              ? <Check size={14} />
              : thumbnailStatus === 'error' ? <TriangleAlert size={14} /> : <Camera size={14} />}
          {thumbnailStatus === 'saving'
            ? 'Wird erzeugt …'
            : thumbnailStatus === 'saved'
              ? 'Vorschaubild gespeichert'
              : thumbnailStatus === 'error' ? 'Aufnahme fehlgeschlagen' : 'Als Vorschaubild übernehmen'}
        </button>
      )}

      <div className="editor-controls-hint fixed bottom-4 left-4 z-40 pointer-events-none rounded-xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-[9px] text-zinc-400 backdrop-blur-xl shadow-lg flex items-center gap-2">
        <Crosshair size={12} className={appState.firstPersonActive ? 'text-emerald-400' : 'text-amber-400'} />
        {usesExternalViewer
          ? 'Sketchfab-Viewer: Ziehen zum Drehen · Mausrad zum Zoomen · RIU-Stationen über die Navigation wechseln'
          : appState.firstPersonActive
          ? 'Mausblick aktiv · WASD bewegen · Rechts ziehen: Höhe · Shift schneller · Esc beenden'
          : 'In die 3D-Fläche klicken: FPS-Mausblick aktivieren'}
      </div>
    </>
  );
}
