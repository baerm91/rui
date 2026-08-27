import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DEFAULT_BASELINE = 'artifacts/performance/baseline.json';
const DEFAULT_CANDIDATE = 'artifacts/performance/latest.json';
const MODES = ['cold', 'warm'];
const METRICS = ['medianMs', 'p95Ms'];

function parseArguments(argv) {
  const positional = [];
  for (const value of argv) {
    if (value.startsWith('-')) throw new Error(`Unbekannte Option: ${value}`);
    positional.push(value);
  }
  if (positional.length > 2) {
    throw new Error('Verwendung: node scripts/performance-compare.mjs [baseline.json] [candidate.json]');
  }
  return {
    baselinePath: resolve(ROOT, positional[0] || DEFAULT_BASELINE),
    candidatePath: resolve(ROOT, positional[1] || DEFAULT_CANDIDATE)
  };
}

async function readReport(path, label) {
  let report;
  try {
    report = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} konnte nicht gelesen werden (${path}): ${error.message}`);
  }
  if (!Array.isArray(report.results)) {
    throw new Error(`${label} enthält kein results-Array: ${path}`);
  }
  return report;
}

function indexResults(report, label) {
  const indexed = new Map();
  for (const result of report.results) {
    if (!result?.name || typeof result.name !== 'string') {
      throw new Error(`${label} enthält ein Szenario ohne gültigen Namen.`);
    }
    if (indexed.has(result.name)) {
      throw new Error(`${label} enthält das Szenario doppelt: ${result.name}`);
    }
    indexed.set(result.name, result);
  }
  return indexed;
}

function finiteMetric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compareBand(baselineBand = {}, candidateBand = {}) {
  const metrics = Object.fromEntries(METRICS.map((metric) => {
    const baseline = finiteMetric(baselineBand[metric]);
    const candidate = finiteMetric(candidateBand[metric]);
    const delta = baseline === null || candidate === null ? null : candidate - baseline;
    return [metric, {
      baseline,
      candidate,
      delta,
      regression: candidate === null || (delta !== null && delta > 0)
    }];
  }));
  const baselineFailures = Number.isInteger(baselineBand.failures) ? baselineBand.failures : null;
  const candidateFailures = Number.isInteger(candidateBand.failures) ? candidateBand.failures : null;
  const failureDelta = baselineFailures === null || candidateFailures === null
    ? null
    : candidateFailures - baselineFailures;
  return {
    metrics,
    failures: {
      baseline: baselineFailures,
      candidate: candidateFailures,
      delta: failureDelta,
      regression: candidateFailures === null || (failureDelta !== null && failureDelta > 0)
    }
  };
}

function compareReports(baseline, candidate) {
  const baselineResults = indexResults(baseline, 'Baseline');
  const candidateResults = indexResults(candidate, 'Kandidat');
  const names = [...new Set([...baselineResults.keys(), ...candidateResults.keys()])].sort();
  const scenarios = names.map((name) => {
    const baselineResult = baselineResults.get(name);
    const candidateResult = candidateResults.get(name);
    if (!baselineResult) return { name, status: 'new', regression: true };
    if (!candidateResult) return { name, status: 'missing', regression: true };
    const modes = Object.fromEntries(MODES.map((mode) => [
      mode,
      compareBand(baselineResult[mode], candidateResult[mode])
    ]));
    const regression = MODES.some((mode) => (
      modes[mode].failures.regression
      || METRICS.some((metric) => modes[mode].metrics[metric].regression)
    ));
    return { name, status: regression ? 'regression' : 'ok', regression, modes };
  });
  return {
    scenarios,
    regressions: scenarios.filter((scenario) => scenario.regression).length,
    missing: scenarios.filter((scenario) => scenario.status === 'missing').length,
    new: scenarios.filter((scenario) => scenario.status === 'new').length
  };
}

function milliseconds(value) {
  if (value === null) return 'n/a';
  return `${value.toFixed(1)} ms`;
}

function delta(value) {
  if (value === null) return 'n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} ms`;
}

function failureValue(value) {
  return value === null ? 'n/a' : String(value);
}

function printComparison(comparison, paths) {
  process.stdout.write(`Performance-Vergleich\nBaseline: ${paths.baselinePath}\nKandidat: ${paths.candidatePath}\n`);
  for (const scenario of comparison.scenarios) {
    process.stdout.write(`\n${scenario.regression ? 'REGRESSION' : 'OK'}  ${scenario.name}`);
    if (scenario.status === 'new') {
      process.stdout.write(' — neu, ohne Baseline\n');
      continue;
    }
    if (scenario.status === 'missing') {
      process.stdout.write(' — fehlt im Kandidaten\n');
      continue;
    }
    process.stdout.write('\n');
    for (const mode of MODES) {
      const band = scenario.modes[mode];
      const parts = METRICS.map((metric) => {
        const result = band.metrics[metric];
        const label = metric === 'medianMs' ? 'Median' : 'p95';
        return `${label} ${milliseconds(result.baseline)} -> ${milliseconds(result.candidate)} (${delta(result.delta)})${result.regression ? ' !' : ''}`;
      });
      const failures = band.failures;
      parts.push(`Fehler ${failureValue(failures.baseline)} -> ${failureValue(failures.candidate)}${failures.delta === null ? '' : ` (${failures.delta >= 0 ? '+' : ''}${failures.delta})`}${failures.regression ? ' !' : ''}`);
      process.stdout.write(`  ${mode.padEnd(4)} ${parts.join(' | ')}\n`);
    }
  }
  process.stdout.write(`\nErgebnis: ${comparison.regressions} Regression(en), ${comparison.missing} fehlend, ${comparison.new} neu, ${comparison.scenarios.length} Szenarien gesamt.\n`);
}

async function main() {
  const paths = parseArguments(process.argv.slice(2));
  const [baseline, candidate] = await Promise.all([
    readReport(paths.baselinePath, 'Baseline'),
    readReport(paths.candidatePath, 'Kandidat')
  ]);
  const comparison = compareReports(baseline, candidate);
  printComparison(comparison, paths);
  if (comparison.regressions > 0) process.exitCode = 2;
}

export { compareReports };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
