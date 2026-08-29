import React, { useEffect, useState } from 'react';
import { AlertTriangle, Box, Check, ChevronDown, ChevronUp, ClipboardPaste, Copy, FolderKanban, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { getStationsUsingModel, getStationsUsingModelId } from '../../utils/modelAssignments.js';
import { extractModelUrl, isSketchfabModelUrl, isSupportedModelUrl, normalizeModelUrl } from '../../utils/modelSource.js';

export function ProjectBar({ projects, activeProject, saveStatus, lastSavedAt, onSwitchProject, onCreateProject, onUpdateProject, onDeleteProject, onLocalModelFiles, canCreateProjects = true, projectControlsAvailable = true, modelPanelOpen, onModelPanelOpenChange }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [dragTarget, setDragTarget] = useState('');
  const [dropFeedback, setDropFeedback] = useState({});
  const additionalModels = Array.isArray(activeProject?.models?.additional) ? activeProject.models.additional : [];
  const connectedModelCount = [activeProject?.models?.primary, activeProject?.models?.reconstruction, ...additionalModels.map((model) => model.url)].filter(Boolean).length;
  const modelsAreOpen = modelPanelOpen ?? showModels;

  const readClipboardUrl = async (targetId, apply) => {
    try {
      const value = extractModelUrl(await navigator.clipboard.readText());
      if (!value) throw new Error('Kein unterstützter Modell-Link in der Zwischenablage.');
      apply(value);
      reportDrop(targetId, 'Link eingefügt');
    } catch {
      reportDrop(targetId, 'Zwischenablage blockiert – URL-Feld wählen und Strg+V verwenden.', true);
    }
  };

  const reportDrop = (targetId, message, isError = false) => {
    setDropFeedback((current) => ({ ...current, [targetId]: { message, isError } }));
    window.setTimeout(() => setDropFeedback((current) => ({ ...current, [targetId]: null })), 2600);
  };

  const handleModelDrop = async (event, targetId, apply) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTarget('');
    const imageFile = Array.from(event.dataTransfer?.files || []).find((file) => file.type.startsWith('image/'));
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = () => { apply({ thumbnailUrl: reader.result }); reportDrop(targetId, 'Thumbnail übernommen'); };
      reader.readAsDataURL(imageFile);
      return;
    }
    const modelFiles = Array.from(event.dataTransfer?.files || []).filter((file) => /\.(?:fbx|glb|gltf|bin)$/i.test(file.name));
    if (modelFiles.length) {
      if (!onLocalModelFiles) { reportDrop(targetId, 'Lokale Modelldateien sind hier nicht verfügbar.', true); return; }
      apply({ name: modelFiles[0].name.replace(/\.[^.]+$/, '') });
      await onLocalModelFiles(modelFiles);
      reportDrop(targetId, 'Lokales Modell geladen');
      return;
    }
    const value = extractModelUrl(event.dataTransfer?.getData('text/uri-list') || event.dataTransfer?.getData('text/plain'));
    if (!value) { reportDrop(targetId, 'Kein unterstützter Inhalt erkannt.', true); return; }
    if (isSupportedModelUrl(value)) { apply({ url: normalizeModelUrl(value) }); reportDrop(targetId, 'Modell-Link übernommen'); }
    else if (/^https?:\/\/.*\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value)) { apply({ thumbnailUrl: value }); reportDrop(targetId, 'Thumbnail übernommen'); }
    else reportDrop(targetId, 'Bitte GLB, glTF, FBX, Sketchfab oder ein Bild ablegen.', true);
  };

  const dropZoneProps = (targetId, apply) => ({
    onDragEnter: (event) => { event.preventDefault(); setDragTarget(targetId); },
    onDragOver: (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; },
    onDragLeave: (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragTarget(''); },
    onDrop: (event) => handleModelDrop(event, targetId, apply)
  });

  const toggleModels = () => {
    if (!projectControlsAvailable) return;
    const nextValue = !modelsAreOpen;
    setShowModels(nextValue);
    onModelPanelOpenChange?.(nextValue);
  };

  const addModel = () => {
    const id = `model-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const nextNumber = additionalModels.length + (activeProject?.models?.reconstruction ? 3 : 2);
    onUpdateProject({ models: { additional: [...additionalModels, { id, name: `Modell ${nextNumber}`, url: '', thumbnailUrl: '' }] } });
  };

  const updateAdditionalModel = (modelId, patch) => {
    onUpdateProject({
      models: {
        additional: additionalModels.map((model) => model.id === modelId ? { ...model, ...patch } : model)
      }
    });
  };

  const removeAdditionalModel = (modelId) => {
    onUpdateProject({ models: { additional: additionalModels.filter((model) => model.id !== modelId) } });
  };

  useEffect(() => setConfirmDelete(false), [activeProject?.id]);

  const submitProject = (duplicateCurrent) => {
    const name = newProjectName.trim();
    if (!name) return;
    onCreateProject(name, duplicateCurrent);
    setNewProjectName('');
    setShowCreate(false);
  };

  const saveState = (
    <span
      className={`flex items-center gap-1 text-[8px] ${saveStatus === 'error' ? 'text-red-400' : saveStatus === 'saving' ? 'text-amber-300' : 'text-emerald-400'}`}
      title={lastSavedAt ? `Zuletzt gespeichert: ${lastSavedAt.toLocaleTimeString('de-DE')}` : 'Automatisches Speichern aktiv'}
    >
      {saveStatus === 'error'
        ? <AlertTriangle size={10} />
        : saveStatus === 'saving' ? <LoaderCircle size={10} className="animate-spin" /> : <Check size={10} />}
      {saveStatus === 'error' ? 'Speicherfehler' : saveStatus === 'saving' ? 'Speichert…' : 'Gespeichert'}
    </span>
  );

  return (
    <section className={`shrink-0 border-b border-white/10 bg-zinc-950/80 ${canCreateProjects ? 'px-5 py-3' : ''}`}>
      {canCreateProjects ? (
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <FolderKanban size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
            <select
              value={activeProject?.id ?? ''}
              onChange={(event) => onSwitchProject(event.target.value)}
              className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-8 text-xs font-semibold text-zinc-100 outline-none hover:border-zinc-700 focus:border-amber-500/40"
              aria-label="Aktives Projekt"
            >
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${showCreate ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-300'}`}
            aria-label="Neues Projekt"
            title="Neues Projekt"
          >
            {showCreate ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggleModels}
          disabled={!projectControlsAvailable}
          className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.025]"
          aria-expanded={projectControlsAvailable ? modelsAreOpen : undefined}
          aria-describedby={!projectControlsAvailable ? 'room-model-controls-note' : undefined}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Box size={14} className="shrink-0 text-amber-400" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-zinc-200">Modelle</span>
              <span className="block truncate text-[9px] text-zinc-500">
                {projectControlsAvailable
                  ? `${activeProject?.name ?? 'Projekt'} · ${connectedModelCount} ${connectedModelCount === 1 ? 'Modell' : 'Modelle'} verbunden`
                  : 'In Scrolling-Ausstellungen werden Modelle direkt an Stationen bearbeitet'}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {saveState}
            {projectControlsAvailable && (modelsAreOpen ? <ChevronUp size={13} className="text-zinc-500" /> : <ChevronDown size={13} className="text-zinc-500" />)}
          </span>
        </button>
      )}

      {!canCreateProjects && !projectControlsAvailable && (
        <p id="room-model-controls-note" className="border-t border-white/5 px-5 py-2 text-[8px] leading-relaxed text-zinc-600">
          Globale Modellrollen gelten nur für Modellstories. Modelle, URLs und Vorschauen dieser Scrolling-Ausstellung bleiben in der jeweiligen Station vollständig bearbeitbar.
        </p>
      )}

      {!canCreateProjects && projectControlsAvailable && modelsAreOpen && activeProject && (
        <div className="flex flex-col gap-2 border-t border-white/5 bg-zinc-950/40 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Verbundene Modelle</span>
            <button
              type="button"
              onClick={addModel}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/20"
            >
              <Plus size={11} /> Modell hinzufügen
            </button>
          </div>
          {['primary', 'reconstruction'].map((role) => {
            const isPrimary = role === 'primary';
            const url = activeProject.models?.[role] ?? '';
            const modelLabel = isPrimary ? 'Basismodell' : 'Modell 2';
            const thumbnailKey = `${role}ThumbnailUrl`;
            const thumbnailUrl = activeProject.models?.[thumbnailKey] ?? '';
            const assignedStations = getStationsUsingModel(activeProject.stations, role);
            const canRemove = !isPrimary && (!url || assignedStations.length === 0);
            if (!isPrimary && !url) return null;
            const applyDrop = (patch) => onUpdateProject({ models: {
              ...(patch.url ? { [role]: patch.url } : {}),
              ...(patch.thumbnailUrl ? { [thumbnailKey]: patch.thumbnailUrl } : {}),
              ...(patch.name ? { [`${role}Name`]: patch.name } : {})
            } });
            return (
              <div
                key={role}
                {...dropZoneProps(role, applyDrop)}
                className={`rounded-lg border bg-zinc-950/65 p-2.5 transition-colors ${dragTarget === role ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-800'}`}
              >
                <div className="flex items-center gap-2">
                  {thumbnailUrl && <img src={thumbnailUrl} alt="" className="h-8 w-11 shrink-0 rounded object-cover" />}
                  <input
                    value={activeProject.models?.[`${role}Name`] ?? modelLabel}
                    onChange={(event) => onUpdateProject({ models: { [`${role}Name`]: event.target.value } })}
                    className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-zinc-200 outline-none"
                    aria-label={`${modelLabel} benennen`}
                  />
                  {!isPrimary && (
                    <button
                      type="button"
                      disabled={!canRemove}
                      onClick={() => {
                        onUpdateProject({ models: { reconstruction: '', reconstructionName: 'Modell 2', reconstructionThumbnailUrl: '' } });
                      }}
                      className="text-zinc-600 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-zinc-600"
                      title={!url ? 'Hinzufügen abbrechen' : canRemove ? 'Modell entfernen' : `Wird verwendet in: ${assignedStations.map((station) => station.title).join(', ')}`}
                      aria-label="Modell 2 entfernen"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={url}
                    onChange={(event) => onUpdateProject({ models: { [role]: event.target.value } })}
                    onBlur={(event) => onUpdateProject({ models: { [role]: normalizeModelUrl(event.target.value) } })}
                    className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-[8px] text-zinc-400 outline-none focus:border-amber-500/40"
                    placeholder={isPrimary ? 'Sketchfab-Link oder .fbx, .glb, .gltf' : 'https://…/modell.fbx, .glb oder .gltf'}
                    aria-label={`${modelLabel} URL`}
                  />
                  <button
                    type="button"
                    onClick={() => readClipboardUrl(role, (value) => onUpdateProject({ models: { [role]: value } }))}
                    className="grid w-8 shrink-0 place-items-center rounded border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-amber-500/40 hover:text-amber-300"
                    aria-label={`${modelLabel}-Link aus Zwischenablage einfügen`}
                    title="Link einfügen"
                  >
                    <ClipboardPaste size={12} />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-[8px]">
                  <span className={assignedStations.length > 0 ? 'text-amber-300/80' : 'text-zinc-600'}>
                    {assignedStations.length > 0
                      ? `${assignedStations.length} ${assignedStations.length === 1 ? 'Station' : 'Stationen'} zugewiesen`
                      : 'Keiner Station zugewiesen'}
                  </span>
                  {isPrimary && <span className="text-zinc-600">Basismodell</span>}
                </div>
                {assignedStations.length > 0 && (
                  <span className="mt-0.5 block truncate text-[8px] text-zinc-600" title={assignedStations.map((station) => station.title).join(', ')}>
                    {assignedStations.map((station) => station.title).join(' · ')}
                  </span>
                )}
                {isPrimary && isSketchfabModelUrl(url) && (
                  <span className="mt-1.5 block text-[8px] leading-relaxed text-emerald-300/80">
                    Sketchfab erkannt. Der interaktive Viewer wird nach dem Neuladen eingebettet; weitere Modellrollen und Portalübergänge sind damit nicht kombinierbar.
                  </span>
                )}
                {!isPrimary && isSketchfabModelUrl(url) && (
                  <span className="mt-1.5 block text-[8px] leading-relaxed text-red-300/80">
                    Sketchfab kann nur als Basismodell eingebettet werden. Für weitere Modelle bitte eine direkte FBX-, GLB- oder glTF-URL verwenden.
                  </span>
                )}
                <div aria-label={`${modelLabel}: Modell-Link oder Thumbnail ablegen`} className="mt-2 rounded border border-dashed border-zinc-800 px-2 py-2 text-center text-[8px] text-zinc-600">
                  Modell-Link oder Thumbnail hier ablegen
                </div>
                {dropFeedback[role] && <div className={`mt-1 text-[8px] ${dropFeedback[role].isError ? 'text-red-300' : 'text-emerald-300'}`}>{dropFeedback[role].message}</div>}
              </div>
            );
          })}
          {additionalModels.map((model, modelIndex) => {
            const assignedStations = getStationsUsingModelId(activeProject.stations, model.id);
            const canRemove = assignedStations.length === 0;
            return (
              <div
                key={model.id}
                {...dropZoneProps(model.id, (patch) => updateAdditionalModel(model.id, patch))}
                className={`rounded-lg border bg-zinc-950/65 p-2.5 transition-colors ${dragTarget === model.id ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-800'}`}
              >
                <div className="flex items-center gap-2">
                  {model.thumbnailUrl && <img src={model.thumbnailUrl} alt="" className="h-8 w-11 shrink-0 rounded object-cover" />}
                  <input
                    value={model.name}
                    onChange={(event) => updateAdditionalModel(model.id, { name: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-zinc-200 outline-none"
                    aria-label={`Zusätzliches Modell ${modelIndex + 1} benennen`}
                  />
                  <button
                    type="button"
                    disabled={!canRemove}
                    onClick={() => removeAdditionalModel(model.id)}
                    className="text-zinc-600 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-zinc-600"
                    title={canRemove ? 'Modell entfernen' : `Wird verwendet in: ${assignedStations.map((station) => station.title).join(', ')}`}
                    aria-label={`${model.name || `Modell ${modelIndex + 3}`} entfernen`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={model.url}
                    onChange={(event) => updateAdditionalModel(model.id, { url: event.target.value })}
                    className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-[8px] text-zinc-400 outline-none focus:border-amber-500/40"
                    placeholder="https://…/modell.fbx, .glb oder .gltf"
                    aria-label={`${model.name || `Modell ${modelIndex + 3}`} URL`}
                  />
                  <button
                    type="button"
                    onClick={() => readClipboardUrl(model.id, (value) => updateAdditionalModel(model.id, { url: value }))}
                    className="grid w-8 shrink-0 place-items-center rounded border border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-amber-500/40 hover:text-amber-300"
                    aria-label={`${model.name || `Modell ${modelIndex + 3}`}-Link aus Zwischenablage einfügen`}
                    title="Link einfügen"
                  >
                    <ClipboardPaste size={12} />
                  </button>
                </div>
                <div className="mt-1.5 text-[8px]">
                  <span className={assignedStations.length > 0 ? 'text-amber-300/80' : 'text-zinc-600'}>
                    {assignedStations.length > 0
                      ? `${assignedStations.length} ${assignedStations.length === 1 ? 'Station' : 'Stationen'} zugewiesen`
                      : 'Keiner Station zugewiesen'}
                  </span>
                </div>
                {assignedStations.length > 0 && (
                  <span className="mt-0.5 block truncate text-[8px] text-zinc-600" title={assignedStations.map((station) => station.title).join(', ')}>
                    {assignedStations.map((station) => station.title).join(' · ')}
                  </span>
                )}
                <div aria-label={`${model.name || `Modell ${modelIndex + 2}`}: Modell-Link oder Thumbnail ablegen`} className="mt-2 rounded border border-dashed border-zinc-800 px-2 py-2 text-center text-[8px] text-zinc-600">
                  Modell-Link oder Thumbnail hier ablegen
                </div>
                {dropFeedback[model.id] && <div className={`mt-1 text-[8px] ${dropFeedback[model.id].isError ? 'text-red-300' : 'text-emerald-300'}`}>{dropFeedback[model.id].message}</div>}
              </div>
            );
          })}
          <small className="text-[8px] leading-relaxed text-zinc-600">Die verbundenen Modelle stehen für Stationsansichten und Übergänge zur Verfügung.</small>
        </div>
      )}

      {canCreateProjects && activeProject && !showCreate && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={activeProject.name}
            onChange={(event) => onUpdateProject({ name: event.target.value, branding: { title: event.target.value } })}
            className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-500 outline-none focus:text-zinc-300"
            aria-label="Projektname"
          />
          <span className="text-[9px] text-zinc-600">{activeProject.stations?.length ?? 0} Stationen</span>
          {saveState}
          {activeProject.models?.localModelName && (
            <span className="max-w-[120px] truncate rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] text-emerald-300" title={activeProject.models.localModelName}>
              {activeProject.models.localModelName}
            </span>
          )}
          {projects.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (confirmDelete) onDeleteProject(activeProject.id);
                else setConfirmDelete(true);
              }}
              className={`rounded px-1.5 py-1 text-[8px] transition-colors ${confirmDelete ? 'bg-red-500/15 text-red-300' : 'text-zinc-600 hover:text-red-400'}`}
              title={confirmDelete ? 'Erneut klicken zum Löschen' : 'Projekt löschen'}
              aria-label={confirmDelete ? 'Löschen bestätigen' : 'Projekt löschen'}
            >
              {confirmDelete ? 'Löschen?' : <Trash2 size={11} />}
            </button>
          )}
        </div>
      )}

      {showCreate && (
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500">Projektname</label>
          <input
            autoFocus
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submitProject(false); }}
            placeholder="z. B. Museum Rundgang"
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-amber-500/40"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => submitProject(false)} disabled={!newProjectName.trim()} className="rounded-lg bg-amber-500 py-2 text-[10px] font-bold text-zinc-950 disabled:opacity-40">
              Leer anlegen
            </button>
            <button type="button" onClick={() => submitProject(true)} disabled={!newProjectName.trim() || !activeProject} className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-[10px] font-semibold text-zinc-300 disabled:opacity-40">
              <Copy size={11} /> Aktuelles kopieren
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
