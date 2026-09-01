import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = () => readFile(new URL('../src/components/VisitorTopControls.jsx', import.meta.url), 'utf8');
const readExhibitionSource = () => readFile(new URL('../src/exhibition/ExhibitionRoom.jsx', import.meta.url), 'utf8');
const readVisitorControlsSource = () => readFile(new URL('../src/components/VisitorControls.jsx', import.meta.url), 'utf8');
const readNarrativeSource = () => readFile(new URL('../src/components/NarrativeTextBlock.jsx', import.meta.url), 'utf8');
const readStyles = () => readFile(new URL('../style.css', import.meta.url), 'utf8');

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

test('mobile overview thumbnails enter the theme before opening their model', async () => {
  const source = await readExhibitionSource();

  assert.match(source, /const enterMobileStationFirst = mobileVisitor && overviewMode;/);
  assert.match(source, /setMobileModelOpen\(!enterMobileStationFirst\);/);
  assert.match(source, /pendingMobileThumbnailFocusRef\.current = enterMobileStationFirst \? itemId : null;/);
  assert.match(source, /data-spatial-item-id=\{item\.id\}/);
  assert.match(source, /thumbnail\.focus\(\{ preventScroll: true \}\);[\s\S]*thumbnail\.scrollIntoView\(/);
});

test('mobile view controls stay compact and announce their action after activation', async () => {
  const [source, styles] = await Promise.all([readVisitorControlsSource(), readStyles()]);

  assert.match(source, /className="sr-only">Freie Ansicht öffnen/);
  assert.match(source, /announceControl\('Freie Ansicht aktiviert'\)/);
  assert.match(source, /announceControl\(annotationsVisible \? 'Annotationen ausgeblendet' : 'Annotationen eingeblendet'\)/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(styles, /\.visitor-view-controls \{[\s\S]*top: max\(\.9rem, env\(safe-area-inset-top\)\) !important;/);
  assert.match(styles, /\.visitor-view-control-reset \{\s*display: none;/);
});

test('mobile free reveal view exposes an in-place model switch', async () => {
  const [source, styles] = await Promise.all([readVisitorControlsSource(), readStyles()]);

  assert.match(source, /getNextInterpretationState\(interpretationComparison, appState\.viewMode\)/);
  assert.match(source, /aria-label=\{`\$\{nextComparisonState\.label\} an der aktuellen Position anzeigen`\}/);
  assert.match(source, /selectInterpretationView\(nextComparisonState\.viewMode\)/);
  assert.match(styles, /\.mobile-reveal-explore-guide \.mobile-reveal-model-switch \{/);
});

test('mobile narrative cards can collapse to the unclipped title only', async () => {
  const [source, styles] = await Promise.all([readNarrativeSource(), readStyles()]);

  assert.match(source, /aria-label=\{mobileTitleOnly \? 'Textvorschau anzeigen' : 'Nur Überschrift anzeigen'\}/);
  assert.match(source, /hidden=\{showMobileCollapsible && mobileTitleOnly\}/);
  assert.match(source, /showMobileCollapsible && !mobileTitleOnly/);
  assert.match(styles, /\.station-collapsible-content\[hidden\] \{\s*display: none !important;/);
  assert.match(styles, /\.station-text-panel-visitor \.station-content-card,[\s\S]*overflow: visible !important;/);
});
