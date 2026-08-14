import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const sourceRoot = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');
const targetRoot = join(root, 'public', 'three-codecs');

const codecFiles = [
  ['draco', 'draco_decoder.js'],
  ['draco', 'draco_decoder.wasm'],
  ['draco', 'draco_wasm_wrapper.js'],
  ['basis', 'basis_transcoder.js'],
  ['basis', 'basis_transcoder.wasm']
];

await Promise.all(
  ['draco', 'basis'].map((directory) =>
    mkdir(join(targetRoot, directory), { recursive: true })
  )
);

await Promise.all(
  codecFiles.map(([directory, file]) =>
    cp(
      join(sourceRoot, directory, file),
      join(targetRoot, directory, file),
      { force: true }
    )
  )
);
