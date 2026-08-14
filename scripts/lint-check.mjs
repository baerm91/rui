import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

const files = (await filesUnder(join(process.cwd(), 'src')))
  .filter((file) => ['.js', '.jsx'].includes(extname(file)));
const failures = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  if (/\t/.test(source)) failures.push(`${file}: Tabulator statt Leerzeichen`);
  if (/console\.log\(/.test(source)) failures.push(`${file}: verbliebene console.log-Ausgabe`);
  if (/href=["']javascript:/i.test(source)) failures.push(`${file}: unsicherer javascript:-Link`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${files.length} Quelldateien geprüft.`);
}
