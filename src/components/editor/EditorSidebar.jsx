import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Crosshair, Download, Eye, Gauge, GripVertical, MapPin, Music2, Pencil, Plus, RotateCcw, Save, Settings, Sparkles, Sun, Trash2, X } from 'lucide-react';
import { StationEditorCard } from './StationEditorCard.jsx';
import { ProjectBar } from './ProjectBar.jsx';
import { ProjectAnnotationPanel } from './ProjectAnnotationPanel.jsx';
import { ProjectLightingPanel } from './ProjectLightingPanel.jsx';
import { ProjectOriginPanel } from './ProjectOriginPanel.jsx';
import { ProjectSoundsPanel } from './ProjectSoundsPanel.jsx';
import { stripHighlights } from '../../utils/textFormatting.jsx';
import ImportExportDialog from '../../ImportExportDialog.jsx';

export function EditorSidebar({
  editingStations,
  editingAnnotations,
  editingIndex,
  activeAccordionIndex,
  activeImageAccordion,
  placingAnnotationId,
  placingOriginPoint,
  configFile,
  onSetActiveAccordion,
  onSetActiveImageAccordion,
  onTestStation,
  onMoveStation,
  onDeleteStation,
  onCaptureCamera,
  onPlaceOriginPoint,
  onUpdateText,
  onUpdateImage,
  onUploadImage,
  onAddAnnotation,
  onDeleteAnnotation,
  onMoveAnnotation,
  onUpdateAnnotation,
  onCaptureAnnotation,
  onPlaceAnnotationInScene,
  onUploadAnnotationImages,
  onLocalBgUpload,
  getBgSelectValue,
  onCancel,
  onSave,
  onRealign,
  onRestoreDefaults,
  onAddStation,
  isPreviewMode = false,
  previewStationIndex = 0,
  onPreviewModeChange,
  projects = [],
  activeProject,
  saveStatus,
  lastSavedAt,
  onSwitchProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  canCreateProjects = true
}) {
  const [openSettingsPanel, setOpenSettingsPanel] = useState('station');
  const [projectSettingsTab, setProjectSettingsTab] = useState('general');
  const [draggedStationIndex, setDraggedStationIndex] = useState(null);
  const [stationDropIndex, setStationDropIndex] = useState(null);
  const [pendingDeleteStationId, setPendingDeleteStationId] = useState(null);
  const suppressStationClick = useRef(false);
  const safeEditingIndex = Math.min(Math.max(editingIndex, 0), Math.max(editingStations.length - 1, 0));
  const activeStation = editingStations[safeEditingIndex];
  const showProjectSettings = openSettingsPanel === 'project';

  useEffect(() => setPendingDeleteStationId(null), [editingIndex, activeProject?.id]);

  useEffect(() => {
    if (!pendingDeleteStationId) return undefined;
    const timeout = window.setTimeout(() => setPendingDeleteStationId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [pendingDeleteStationId]);

  const requestDeleteStation = (index) => {
    const station = editingStations[index];
    if (!station || editingStations.length <= 1) return;
    if (pendingDeleteStationId === station.id) {
      setPendingDeleteStationId(null);
      onDeleteStation(index);
      return;
    }
    setPendingDeleteStationId(station.id);
  };

  const resetStationDrag = () => {
    setDraggedStationIndex(null);
    setStationDropIndex(null);
  };

  const handleStationDragStart = (event, index) => {
    suppressStationClick.current = true;
    setDraggedStationIndex(index);
    setStationDropIndex(index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', editingStations[index].id);
  };

  const handleStationDragOver = (event, index) => {
    if (draggedStationIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientX >= bounds.left + bounds.width / 2;
    setStationDropIndex(index + (insertAfter ? 1 : 0));
  };

  const handleStationDrop = (event) => {
    event.preventDefault();
    if (draggedStationIndex === null || stationDropIndex === null) {
      resetStationDrag();
      return;
    }

    const targetIndex = stationDropIndex > draggedStationIndex
      ? stationDropIndex - 1
      : stationDropIndex;
    if (targetIndex !== draggedStationIndex) {
      onMoveStation(draggedStationIndex, targetIndex);
    }
    resetStationDrag();
  };

  const handleStationDragEnd = () => {
    resetStationDrag();
    window.setTimeout(() => {
      suppressStationClick.current = false;
    }, 0);
  };

  if (isPreviewMode) {
    const previewStation = editingStations[previewStationIndex];
    return (
      <div className="fixed top-4 right-4 z-50 pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/85 backdrop-blur-2xl p-2 pl-4 text-white shadow-2xl">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
            <Eye size={11} />
            Demo · Scroll-Vorschau
          </span>
          <span className="block max-w-[220px] truncate text-[10px] text-zinc-500">
            {previewStation
              ? `Station ${previewStationIndex + 1} von ${editingStations.length} · ${stripHighlights(previewStation.title)}`
              : 'Aktuelle Projekteinstellungen'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onPreviewModeChange?.(false)}
          className="rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-bold text-zinc-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5"
        >
          <Pencil size={12} />
          Bearbeiten
        </button>
        <button onClick={onCancel} className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-colors" aria-label="Editor schließen">
          <X size={16} />
        </button>
      </div>
    );
  }

  const editorRoot = document.getElementById('editor-root');

  return createPortal(
    <aside className="editor-sidebar w-full h-full bg-zinc-950 border-l border-white/10 flex flex-col pointer-events-auto text-white shadow-2xl">
      <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Settings size={17} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-base font-bold">Szenen-Editor</h2>
            <p className="text-[10px] text-zinc-500 truncate">
              {activeStation
                ? `Station ${safeEditingIndex + 1} von ${editingStations.length} · ${stripHighlights(activeStation.title)}`
                : 'Keine Station vorhanden'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 p-1" aria-label="Editor-Modus">
            <span className="rounded-lg bg-zinc-700 px-2.5 py-1.5 text-[9px] font-semibold text-white flex items-center gap-1.5">
              <Pencil size={11} />
              Bearbeiten
            </span>
            <button
              type="button"
              onClick={() => onPreviewModeChange?.(true)}
              className="rounded-lg px-2.5 py-1.5 text-[9px] font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
            >
              <Eye size={11} />
              Demo
            </button>
          </div>
          <button onClick={onCancel} className="p-2 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition-colors" aria-label="Editor schließen">
            <X size={18} />
          </button>
        </div>
      </div>

      <ProjectBar
        projects={projects}
        activeProject={activeProject}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
        onUpdateProject={onUpdateProject}
        onDeleteProject={onDeleteProject}
        canCreateProjects={canCreateProjects}
        modelPanelOpen={openSettingsPanel === 'models'}
        onModelPanelOpenChange={(isOpen) => setOpenSettingsPanel(isOpen ? 'models' : null)}
      />

      <section className="shrink-0 border-b border-white/10 bg-zinc-950/75">
        <button
          type="button"
          onClick={() => setOpenSettingsPanel((value) => value === 'project' ? null : 'project')}
          className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-white/[0.03]"
          aria-expanded={showProjectSettings}
        >
          <span className="flex items-center gap-2.5">
            <Settings size={14} className="text-amber-400" />
            <span>
              <span className="block text-xs font-semibold text-zinc-200">Projekteinstellungen</span>
              <span className="block text-[9px] text-zinc-500">Darstellung, Sounds, Licht, Nullpunkt und Annotationen</span>
            </span>
          </span>
          {showProjectSettings ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </button>

        {showProjectSettings && (
          <div className="max-h-[52vh] overflow-y-auto border-t border-white/5">
            <div className="sticky top-0 z-10 grid grid-cols-5 gap-1 border-b border-zinc-800 bg-zinc-950/95 p-2" role="tablist" aria-label="Bereiche der Projekteinstellungen">
              {[
                ['general', 'Allgemeines', Sparkles],
                ['sounds', 'Sounds', Music2],
                ['annotations', 'Annotationen', MapPin],
                ['lighting', 'Beleuchtung', Sun],
                ['origin', 'Nullpunkt', Crosshair]
              ].map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={projectSettingsTab === id}
                  onClick={() => setProjectSettingsTab(id)}
                  className={`min-w-0 rounded-lg border px-1 py-2 text-[8px] font-semibold transition-colors flex flex-col items-center gap-1 ${
                    projectSettingsTab === id
                      ? 'border-amber-500/35 bg-amber-500/12 text-amber-300'
                      : 'border-transparent bg-zinc-900/55 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  <Icon size={12} />
                  <span className="max-w-full truncate">{label}</span>
                </button>
              ))}
            </div>

            {projectSettingsTab === 'general' && <>
            <div className="m-3 flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/55 px-3 py-2.5">
              <Gauge size={13} className="shrink-0 text-amber-400" />
              <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-zinc-500">Scrolltempo</span>
              <input
                type="range" min="0.4" max="1.6" step="0.1"
                value={activeProject?.settings?.scrollSpeed ?? 1}
                onChange={(event) => onUpdateProject({ settings: { scrollSpeed: Number(event.target.value) } })}
                className="min-w-0 flex-1 accent-amber-500"
                aria-label="Scrollgeschwindigkeit"
              />
              <span className="w-8 text-right text-[9px] font-mono font-semibold text-amber-300">
                {(activeProject?.settings?.scrollSpeed ?? 1).toFixed(1)}×
              </span>
            </div>

            <div className="m-3 rounded-xl border border-zinc-800 bg-zinc-900/55 px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                  <Eye size={13} className="text-amber-400" /> Kamera-Blickwinkel
                </span>
                <label className="flex items-center gap-1 text-[9px] text-amber-300">
                  <input
                    type="number"
                    min="60"
                    max="160"
                    step="1"
                    value={activeProject?.settings?.cameraFov ?? 75}
                    onChange={(event) => {
                      const value = Math.max(60, Math.min(160, Number(event.target.value) || 75));
                      onUpdateProject({ settings: { cameraFov: value } });
                      window.appState?.setCameraFov?.(value);
                    }}
                    className="w-12 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-right font-mono outline-none focus:border-amber-500/40"
                    aria-label="Kamera-Blickwinkel in Grad"
                  />
                  °
                </label>
              </div>
              <input
                type="range"
                min="60"
                max="160"
                step="1"
                value={activeProject?.settings?.cameraFov ?? 75}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  onUpdateProject({ settings: { cameraFov: value } });
                  window.appState?.setCameraFov?.(value);
                }}
                className="w-full accent-amber-500"
                aria-label="Kamera-Blickwinkel einstellen"
              />
              <div className="mt-1 flex justify-between text-[8px] text-zinc-600"><span>60° · natürlich</span><span>160° · extrem weit</span></div>
              <small className="mt-1.5 block text-[8px] leading-relaxed text-zinc-600">Horizontaler Blickwinkel für Editor und veröffentlichte Story. Große Werte verbreitern vor allem die Seiten und strecken die Bildränder sichtbar.</small>
            </div>

            <div className="m-3 rounded-xl border border-zinc-800 bg-zinc-900/35 p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Sparkles size={13} className="text-amber-400" /> Story-Darstellung
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/55 px-2.5 py-2 text-[10px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!activeProject?.settings?.presentation?.showStoryTitle}
                  onChange={(event) => onUpdateProject({ settings: { presentation: { ...activeProject?.settings?.presentation, showStoryTitle: event.target.checked } } })}
                  className="mt-0.5 accent-amber-500"
                />
                <span><strong className="block">Story-Titel im Viewer</strong><small className="text-zinc-600">Nur auf Desktop-Bildschirmen sichtbar</small></span>
              </label>
              <label className="mt-3 flex flex-col gap-1">
                <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">Text-Erscheinung</span>
                <select
                  value={activeProject?.settings?.presentation?.textAnimation ?? 'cinematic'}
                  onChange={(event) => onUpdateProject({ settings: { presentation: { ...activeProject?.settings?.presentation, textAnimation: event.target.value } } })}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-[10px] text-zinc-200 outline-none focus:border-amber-500/40"
                >
                  <option value="cinematic">Cinematic · gestaffelt & weich</option>
                  <option value="soft">Sanft · dezentes Fade</option>
                  <option value="none">Ohne Animation</option>
                </select>
                <small className="text-[8px] leading-relaxed text-zinc-600">Textbox, Stationsüberschrift und Fließtext erscheinen zeitlich versetzt.</small>
              </label>
            </div>
            </>}

            {projectSettingsTab === 'sounds' && <ProjectSoundsPanel
              audio={activeProject?.settings?.audio}
              projectId={activeProject?.id}
              stations={editingStations}
              onChange={(audio) => onUpdateProject?.({ settings: { audio } })}
            />}

            {projectSettingsTab === 'annotations' && <ProjectAnnotationPanel
              annotations={editingAnnotations}
              stations={editingStations}
              placingAnnotationId={placingAnnotationId}
              onAddAnnotation={onAddAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onMoveAnnotation={onMoveAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onCaptureAnnotation={onCaptureAnnotation}
              onPlaceAnnotationInScene={onPlaceAnnotationInScene}
              onUploadAnnotationImages={onUploadAnnotationImages}
              embedded
            />}
            {projectSettingsTab === 'lighting' && <ProjectLightingPanel
              lighting={activeProject?.settings?.lighting}
              onChange={(lighting) => {
                onUpdateProject?.({ settings: { lighting } });
                window.appState?.applyProjectLighting?.(lighting);
              }}
              embedded
            />}
            {projectSettingsTab === 'origin' && <ProjectOriginPanel orbitTarget={activeProject?.settings?.orbitTarget} isPlacing={placingOriginPoint} onPlace={onPlaceOriginPoint} embedded />}
          </div>
        )}
      </section>

      <section className="editor-stage-station-workspace">
      <div className="px-5 py-3 border-b border-white/10 bg-zinc-950/70 shrink-0">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Stationen</span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <GripVertical size={10} aria-hidden="true" />
            Ziehen zum Sortieren
          </span>
        </div>
        <div
          className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1"
          aria-label="Station auswählen und sortieren"
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setStationDropIndex(null);
          }}
        >
          {editingStations.map((station, index) => (
            <div
              key={`editor-nav-${station.id}`}
              className={`relative shrink-0 flex transition-opacity ${draggedStationIndex === index ? 'opacity-40' : 'opacity-100'}`}
              onDragOver={(event) => handleStationDragOver(event, index)}
              onDrop={handleStationDrop}
            >
              {stationDropIndex === index && draggedStationIndex !== null && (
                <span className="absolute -left-[5px] top-1 bottom-1 z-10 w-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" aria-hidden="true" />
              )}
              <button
                type="button"
                draggable
                onDragStart={(event) => handleStationDragStart(event, index)}
                onDragEnd={handleStationDragEnd}
                onClick={(event) => {
                  if (suppressStationClick.current) {
                    event.preventDefault();
                    return;
                  }
                  onTestStation(index, station);
                  setOpenSettingsPanel('station');
                }}
                className={`group shrink-0 min-w-[96px] max-w-[144px] px-2.5 py-2 rounded-xl border text-left transition-all flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                  editingIndex === index
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-amber-300 hover:border-amber-500/40'
                }`}
                title={`${stripHighlights(station.title)} – zum Verschieben ziehen`}
                aria-label={`Station ${index + 1}: ${stripHighlights(station.title) || 'Ohne Titel'}. Zum Verschieben ziehen.`}
              >
                <GripVertical size={13} className="shrink-0 opacity-45 group-hover:opacity-90" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider opacity-70">Station {index + 1}</span>
                  <span className="block text-[11px] font-semibold truncate normal-case tracking-normal">{stripHighlights(station.title) || 'Ohne Titel'}</span>
                </span>
              </button>
              {editingStations.length > 1 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    requestDeleteStation(index);
                  }}
                  className={`ml-1 flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border px-2 transition-colors ${
                    pendingDeleteStationId === station.id
                      ? 'border-red-400/60 bg-red-500/20 text-red-200'
                      : editingIndex === index
                      ? 'border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-600 hover:border-red-500/30 hover:text-red-400'
                  }`}
                  title={pendingDeleteStationId === station.id ? 'Erneut klicken, um das Löschen zu bestätigen' : `Station ${index + 1} löschen`}
                  aria-label={pendingDeleteStationId === station.id ? `Löschen von Station ${index + 1} bestätigen` : `Station ${index + 1} löschen`}
                >
                  {pendingDeleteStationId === station.id
                    ? <><AlertTriangle size={12} /><span className="text-[8px] font-semibold">Bestätigen</span></>
                    : <Trash2 size={12} />}
                </button>
              )}
              {stationDropIndex === index + 1 && index === editingStations.length - 1 && draggedStationIndex !== null && (
                <span className="absolute -right-[5px] top-1 bottom-1 z-10 w-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" aria-hidden="true" />
              )}
            </div>
          ))}
          <button
            onClick={() => {
              onAddStation();
              setOpenSettingsPanel('station');
            }}
            className="shrink-0 w-10 h-10 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50 transition-colors flex items-center justify-center"
            title="Neue Station hinzufügen"
            aria-label="Neue Station hinzufügen"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      </section>

      <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin">
        {activeStation && (
          <StationEditorCard
            key={activeStation.id}
            station={activeStation}
            models={activeProject?.models}
            index={safeEditingIndex}
            editingIndex={editingIndex}
            totalStations={editingStations.length}
            activeAccordionIndex={activeAccordionIndex}
            activeImageAccordion={activeImageAccordion}
            onSetActiveAccordion={onSetActiveAccordion}
            onSetActiveImageAccordion={onSetActiveImageAccordion}
            onMoveStation={onMoveStation}
            onDeleteStation={requestDeleteStation}
            isDeletePending={pendingDeleteStationId === activeStation.id}
            isExpanded={openSettingsPanel === 'station'}
            onExpandedChange={(isOpen) => setOpenSettingsPanel(isOpen ? 'station' : null)}
            onTestStation={onTestStation}
            onCaptureCamera={onCaptureCamera}
            onUpdateText={onUpdateText}
            onUpdateImage={onUpdateImage}
            onUploadImage={onUploadImage}
            onLocalBgUpload={onLocalBgUpload}
            getBgSelectValue={getBgSelectValue}
          />
        )}
      </div>

      <div className="p-4 border-t border-white/10 shrink-0 bg-zinc-950/95 flex flex-col gap-2.5">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onRealign}
            className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl py-2 text-[10px] font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-all"
            title="Modelle mit 3 Punkten ausrichten"
          >
            <RotateCcw size={12} />
            <span>Ausrichten</span>
          </button>
          <button onClick={onRestoreDefaults} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-all">
            Zurücksetzen
          </button>
          <button onClick={configFile.openDialog} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1 transition-all">
            <Download size={12} />
            <span>Import / Export</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2.5 text-xs font-semibold text-zinc-300 transition-all">
            Abbrechen
          </button>
          <button onClick={onSave} className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all">
            <Save size={14} />
            <span>Speichern & Schließen</span>
          </button>
        </div>
      </div>

      {configFile.showImportExport && (
        <ImportExportDialog
          configFileHandle={configFile.configFileHandle}
          copySuccess={configFile.copySuccess}
          importError={configFile.importError}
          importText={configFile.importText}
          onClose={configFile.closeDialog}
          onCopyClipboard={configFile.copyClipboard}
          onDownloadFile={configFile.downloadFile}
          onFileUpload={configFile.uploadFile}
          onImportJSON={configFile.importJSON}
          onImportTextChange={configFile.setImportText}
          onOpenConfigFile={configFile.openConfigFile}
          onOverwriteConfigFile={configFile.overwriteConfigFile}
        />
      )}
    </aside>,
    editorRoot
  );
}
