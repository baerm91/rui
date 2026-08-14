import React from 'react';
import {
  Check,
  Clipboard,
  Download,
  Save,
  Upload,
  X
} from 'lucide-react';

function ImportExportDialog({
  configFileHandle,
  copySuccess,
  importError,
  importText,
  onClose,
  onCopyClipboard,
  onDownloadFile,
  onFileUpload,
  onImportJSON,
  onOpenConfigFile,
  onOverwriteConfigFile,
  onImportTextChange
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 pointer-events-auto">
      <div className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-xl p-6 shadow-2xl flex flex-col gap-4 animate-blur-fade-up text-left">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="font-serif text-lg font-bold flex items-center gap-2">
            <Upload size={16} className="text-amber-400" />
            <span>Konfiguration importieren / exportieren</span>
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Kopieren Sie das JSON unten, um Ihre Einstellungen zu speichern oder zu teilen. Sie koennen auch eine JSON-Konfigurationsdatei hochladen oder hineinkopieren und auf Importieren klicken, um neue Stationen zu laden.
        </p>

        <div className="flex items-center gap-3">
          <label className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer flex items-center gap-1.5 text-zinc-300">
            <Upload size={14} />
            <span>Datei hochladen (.json)</span>
            <input
              type="file"
              accept=".json"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={onOpenConfigFile}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 text-zinc-300"
          >
            <Upload size={14} />
            <span>Datei oeffnen</span>
          </button>

          <button
            onClick={onDownloadFile}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 text-zinc-300"
          >
            <Download size={14} />
            <span>Als Datei herunterladen</span>
          </button>

          <button
            onClick={onOverwriteConfigFile}
            disabled={!configFileHandle}
            className="bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:pointer-events-none border border-amber-500/30 rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 text-amber-300"
          >
            <Save size={14} />
            <span>Geoeffnete Datei ueberschreiben</span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">JSON Daten</label>
          <textarea
            rows="8"
            value={importText}
            onChange={(e) => onImportTextChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono focus:outline-none focus:border-amber-500/50 leading-normal"
          />
        </div>

        {importError && (
          <span className="text-xs text-red-400 font-medium block">
            Warnung: {importError}
          </span>
        )}

        <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-1">
          <button
            onClick={onCopyClipboard}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 text-zinc-300 transition-colors"
          >
            {copySuccess ? <Check size={14} className="text-emerald-400" /> : <Clipboard size={14} />}
            <span>{copySuccess ? 'Kopiert!' : 'In Zwischenablage kopieren'}</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              Abbrechen
            </button>
            <button
              onClick={onImportJSON}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 px-5 py-2 text-xs font-bold rounded-xl shadow-lg transition-all"
            >
              Importieren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportExportDialog;
