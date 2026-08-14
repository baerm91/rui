import { useState } from 'react';
import { normalizeStationConfig, normalizeStations, serializeStationConfig } from './stations.js';
import { siteConfig } from './site.config.js';
import { serializeProjectMetadata } from './projects/projectSettings.js';

export function useStationConfigFile({
  alignment,
  editingStations,
  editingAnnotations,
  onImportStations,
  onImportAnnotations,
  onImportAlignment,
  onPreviewStation,
  project,
  onImportProject
}) {
  const [configFileHandle, setConfigFileHandle] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState('');
  const [importText, setImportText] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);

  const getCurrentConfigJSON = () => JSON.stringify({
    project: serializeProjectMetadata(project),
    ...serializeStationConfig(editingStations, alignment, editingAnnotations)
  }, null, 2);

  const openDialog = () => {
    setImportText(getCurrentConfigJSON());
    setShowImportExport(true);
    setImportError('');
  };

  const closeDialog = () => {
    setShowImportExport(false);
  };

  const openConfigFile = async () => {
    setImportError('');

    if (!window.showOpenFilePicker) {
      setImportError('Dieser Browser kann Dateien nicht direkt oeffnen. Nutzen Sie stattdessen "Datei hochladen".');
      return;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: `${siteConfig.title} JSON`,
            accept: { 'application/json': ['.json'] }
          }
        ],
        excludeAcceptAllOption: false,
        multiple: false
      });

      const file = await handle.getFile();
      const text = await file.text();
      setConfigFileHandle(handle);
      setImportText(text);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setImportError(`Fehler beim Oeffnen: ${err.message}`);
      }
    }
  };

  const copyClipboard = () => {
    navigator.clipboard.writeText(importText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([getCurrentConfigJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const projectSlug = project?.name?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    link.download = projectSlug ? `${projectSlug}.project.json` : siteConfig.downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const overwriteConfigFile = async () => {
    setImportError('');

    if (!configFileHandle?.createWritable) {
      setImportError('Keine ueberschreibbare Datei geoeffnet. Oeffnen Sie zuerst eine JSON-Datei oder nutzen Sie den Download.');
      return;
    }

    try {
      const writable = await configFileHandle.createWritable();
      await writable.write(getCurrentConfigJSON());
      await writable.close();
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      setImportError(`Fehler beim Ueberschreiben: ${err.message}`);
    }
  };

  const importJSON = () => {
    try {
      const rawConfig = JSON.parse(importText);
      const config = normalizeStationConfig(rawConfig);
      const hasStations = Array.isArray(rawConfig) || Array.isArray(rawConfig.stations);
      const hasAnnotations = Array.isArray(rawConfig.annotations);
      if (!hasStations && !hasAnnotations) {
        throw new Error('JSON muss Stationen oder Annotationen enthalten.');
      }

      if (hasStations) {
        config.stations.forEach((station, index) => {
          if (!station.title || !station.cameraPos || !station.cameraTarget) {
            throw new Error(`Station an Index ${index} fehlt an wichtigen Daten (title, cameraPos, cameraTarget).`);
          }
        });

        const sanitized = normalizeStations(config.stations);
        onImportStations(sanitized);

        if (config.alignment) {
          onImportAlignment?.(config.alignment);
        }

        if (rawConfig.project) onImportProject?.(rawConfig.project);
        if (sanitized.length > 0) {
          onPreviewStation?.(0, sanitized[0]);
        }
      }

      if (hasAnnotations) onImportAnnotations?.(config.annotations);
      setShowImportExport(false);
      setImportError('');
    } catch (err) {
      setImportError(`Fehler beim Import: ${err.message}`);
    }
  };

  const uploadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result;
      if (typeof text === 'string') {
        setImportText(text);
        setImportError('');
      }
    };
    reader.readAsText(file);
  };

  return {
    configFileHandle,
    copyClipboard,
    copySuccess,
    closeDialog,
    downloadFile,
    importError,
    importJSON,
    importText,
    openConfigFile,
    openDialog,
    overwriteConfigFile,
    setImportText,
    showImportExport,
    uploadFile
  };
}
