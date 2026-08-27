import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ClipboardCheck } from 'lucide-react';
import { auditStoryReadiness } from '../../utils/storyReadiness.js';

export function StoryReadinessPanel({ project, stations, annotations, spatialMode }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => auditStoryReadiness({ project, stations, annotations, spatialMode }), [annotations, project, spatialMode, stations]);
  const tone = report.errors ? 'text-red-300' : report.warnings ? 'text-amber-300' : 'text-emerald-300';

  return (
    <section className="shrink-0 border-b border-white/10 bg-zinc-950/75" aria-label="Story-Check (Prototyp)">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <ClipboardCheck size={14} className={tone} />
          <span>
            <span className="block text-xs font-semibold text-zinc-200">Story-Check <small className="text-zinc-500">Prototyp</small></span>
            <span className={`block text-[9px] ${tone}`} aria-live="polite">
              {report.errors} Fehler · {report.warnings} Hinweise
            </span>
          </span>
        </span>
        {open ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
      </button>

      {open && (
        <div className="max-h-52 overflow-y-auto border-t border-white/5 px-4 py-3">
          {report.findings.length === 0 ? (
            <p className="flex items-center gap-2 text-[10px] text-emerald-300"><CheckCircle2 size={13} /> Keine automatisch erkennbaren Lücken.</p>
          ) : (
            <ul className="space-y-2">
              {report.findings.map((finding, index) => (
                <li key={`${finding.code}-${finding.location}-${index}`} className="flex gap-2 rounded-lg bg-zinc-900/70 p-2 text-[9px] text-zinc-300">
                  <AlertTriangle size={12} className={finding.severity === 'error' ? 'shrink-0 text-red-400' : 'shrink-0 text-amber-400'} />
                  <span><strong className="block text-zinc-100">{finding.location}</strong>{finding.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[8px] leading-relaxed text-zinc-500">Der Prototyp berät nur. Fachliche Richtigkeit, mobile Komposition und Modell-Erreichbarkeit benötigen weiterhin redaktionelle Prüfung.</p>
        </div>
      )}
    </section>
  );
}
