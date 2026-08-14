import React, { useRef, useState } from 'react';
import { Music2, Plus, Trash2, Upload } from 'lucide-react';
import { getProjectSounds, normalizeProjectAudio } from '../../audio/projectSounds.js';
import { deleteProjectSoundFile, getProjectSoundKey, saveProjectSoundFile } from '../../audio/projectSoundStore.js';

const MAX_AUDIO_FILE_SIZE = 12 * 1024 * 1024;

export function ProjectSoundsPanel({ audio, projectId, stations = [], onChange }) {
  const fileInput = useRef(null);
  const [uploadError, setUploadError] = useState('');
  const normalized = normalizeProjectAudio(audio);
  const sounds = getProjectSounds(normalized);

  const commit = (next) => onChange?.(normalizeProjectAudio(next));
  const updateAssignment = (soundId, patch) => commit({
    ...normalized,
    assignments: {
      ...normalized.assignments,
      [soundId]: { all: false, stationIds: [], intensity: 100, dynamics: 100, ...normalized.assignments[soundId], ...patch }
    }
  });

  const toggleStation = (soundId, stationId, checked) => {
    const current = normalized.assignments[soundId] ?? { all: false, stationIds: [] };
    const stationIds = checked
      ? [...new Set([...current.stationIds, stationId])]
      : current.stationIds.filter((id) => id !== stationId);
    updateAssignment(soundId, { all: false, stationIds });
  };

  const addCustomSound = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setUploadError('Bitte eine Audiodatei auswählen.');
      return;
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      setUploadError('Die Audiodatei darf höchstens 12 MB groß sein.');
      return;
    }
    try {
      const name = file.name.replace(/\.[^.]+$/, '') || 'Eigener Sound';
      const id = globalThis.crypto?.randomUUID?.() ?? `sound-${Date.now()}`;
      const storageKey = getProjectSoundKey(projectId, id);
      await saveProjectSoundFile(projectId, id, file);
      commit({
        ...normalized,
        customSounds: [...normalized.customSounds, { id, name, source: 'custom', storageKey, mimeType: file.type }]
      });
      setUploadError('');
    } catch {
      setUploadError('Die Audiodatei konnte nicht eingelesen werden.');
    }
  };

  const removeCustomSound = (soundId) => {
    const sound = normalized.customSounds.find((entry) => entry.id === soundId);
    if (sound?.storageKey) deleteProjectSoundFile(sound.storageKey).catch(() => {});
    const assignments = { ...normalized.assignments };
    delete assignments[soundId];
    commit({
      customSounds: normalized.customSounds.filter((sound) => sound.id !== soundId),
      assignments
    });
  };

  return (
    <div className="p-3">
      <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/55 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-200"><Music2 size={14} className="text-amber-400" /> Atmosphärische Sounds</h3>
            <p className="mt-1 text-[8px] leading-relaxed text-zinc-600">„Alle“ spielt einen Sound in jeder Station. Lautstärke regelt den Pegel; Dynamik steuert Böen, Schwankungen und die Häufigkeit einzelner Ereignisse.</p>
          </div>
          <button type="button" onClick={() => fileInput.current?.click()} className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/20 flex items-center gap-1.5">
            <Plus size={11} /> Sound hinzufügen
          </button>
          <input ref={fileInput} type="file" accept="audio/*" onChange={addCustomSound} className="hidden" />
        </div>
        {uploadError && <p className="mt-2 text-[9px] text-red-400">{uploadError}</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/45">
        <table className="min-w-full border-collapse text-[9px]">
          <thead className="bg-zinc-900/85 text-zinc-500">
            <tr>
              <th className="sticky left-0 z-[1] min-w-36 border-b border-r border-zinc-800 bg-zinc-900 px-3 py-2 text-left uppercase tracking-wider">Sound</th>
              <th className="min-w-32 border-b border-r border-zinc-800 px-2 py-2 text-center">Lautstärke</th>
              <th className="min-w-32 border-b border-r border-zinc-800 px-2 py-2 text-center">Dynamik</th>
              <th className="min-w-14 border-b border-r border-zinc-800 px-2 py-2 text-center text-amber-300">Alle</th>
              {stations.map((station, index) => <th key={station.id} title={station.title} className="min-w-16 max-w-24 truncate border-b border-r border-zinc-800 px-2 py-2 text-center">S{index + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {sounds.map((sound) => {
              const assignment = normalized.assignments[sound.id] ?? { all: false, stationIds: [], intensity: 100, dynamics: 100 };
              return (
                <tr key={sound.id} className="border-b border-zinc-900 last:border-b-0">
                  <th className="sticky left-0 z-[1] border-r border-zinc-800 bg-zinc-950 px-3 py-2 text-left font-medium text-zinc-300">
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5"><Music2 size={11} className={sound.source === 'custom' ? 'text-cyan-400' : 'text-amber-400'} /><span className="truncate">{sound.name}</span></span>
                      {sound.source === 'custom' && <button type="button" onClick={() => removeCustomSound(sound.id)} className="text-zinc-600 hover:text-red-400" aria-label={`${sound.name} entfernen`}><Trash2 size={11} /></button>}
                    </span>
                  </th>
                  <td className="border-r border-zinc-800 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="5"
                        value={assignment.intensity}
                        onChange={(event) => updateAssignment(sound.id, { intensity: Number(event.target.value) })}
                        className="w-20 accent-amber-500"
                        aria-label={`Lautstärke von ${sound.name}`}
                      />
                      <span className="w-8 text-right font-mono text-amber-300">{assignment.intensity}%</span>
                    </div>
                  </td>
                  <td className="border-r border-zinc-800 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="200"
                        step="5"
                        value={assignment.dynamics}
                        onChange={(event) => updateAssignment(sound.id, { dynamics: Number(event.target.value) })}
                        className="w-20 accent-cyan-500"
                        aria-label={`Dynamik von ${sound.name}`}
                      />
                      <span className="w-8 text-right font-mono text-cyan-300">{assignment.dynamics}%</span>
                    </div>
                  </td>
                  <td className="border-r border-zinc-800 px-2 py-2 text-center"><input type="checkbox" checked={assignment.all} onChange={(event) => updateAssignment(sound.id, { all: event.target.checked })} className="accent-amber-500" aria-label={`${sound.name} für alle Stationen`} /></td>
                  {stations.map((station) => <td key={station.id} className="border-r border-zinc-800 px-2 py-2 text-center"><input type="checkbox" checked={assignment.all || assignment.stationIds.includes(station.id)} disabled={assignment.all} onChange={(event) => toggleStation(sound.id, station.id, event.target.checked)} className="accent-amber-500 disabled:opacity-45" aria-label={`${sound.name} für ${station.title}`} /></td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[8px] text-zinc-600"><Upload size={10} /> Eigene Dateien werden lokal im Projektspeicher abgelegt. Maximal 12 MB pro Datei.</p>
    </div>
  );
}
