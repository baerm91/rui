import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = () => readFile(new URL('../src/components/VisitorTopControls.jsx', import.meta.url), 'utf8');
const readExhibitionSource = () => readFile(new URL('../src/exhibition/ExhibitionRoom.jsx', import.meta.url), 'utf8');

test('visitor branding and home icon form one Discover link', async () => {
  const source = await readSource();

  assert.match(source, /homeHref = '\/discover'[\s\S]+href=\{homeHref\}[\s\S]+aria-label="Zu Discover"[\s\S]+<span>RIU<\/span>[\s\S]+<Home size=\{14\}/);
  assert.doesNotMatch(source, /href="\/"/);
});

test('visitor story information uses readable supporting copy', async () => {
  const source = await readSource();

  assert.match(source, /text-zinc-300">Weitere veröffentlichte Stories dieser Person anzeigen\.<\/p>/);
  assert.doesNotMatch(source, /text-zinc-500">Weitere veröffentlichte Stories dieser Person anzeigen\.<\/p>/);
});

test('spatial themes reuse the same visitor button group', async () => {
  const source = await readExhibitionSource();

  assert.match(source, /<VisitorTopControls[\s\S]+authorId=\{story\.ownerId\}/);
  assert.match(source, /showMute=\{!overviewMode && Boolean\(station\.spatial\.audio\.url\)\}/);
});
