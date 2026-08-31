import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const css = postcss.parse(await readFile(new URL('../src/exhibition/exhibitionRoom.css', import.meta.url), 'utf8'));
const declarations = (selector) => {
  const result = {};
  css.walkRules(selector, (rule) => rule.walkDecls((decl) => { result[decl.prop] = decl.value; }));
  return result;
};

test('station viewer separates foreground image from background input without a wrapper stacking context', () => {
  const wrapper = declarations('.exhibition-shell .spatial-station-content > .spatial-sketchfab');
  const image = declarations('.spatial-station-content > .spatial-sketchfab iframe');
  const controls = declarations('.spatial-station-content > .spatial-sketchfab .spatial-sketchfab-controls');
  assert.equal(wrapper['z-index'], 'auto');
  assert.equal(wrapper['pointer-events'], 'none');
  assert.equal(image.position, 'absolute');
  assert.equal(image['pointer-events'], 'none');
  assert.equal(controls['pointer-events'], 'auto');
  for (const selector of ['.spatial-story-copy', '.spatial-thumbnails', '.spatial-object-caption', '.mode-visitor.thumbnail-layout-carousel .spatial-thumbnails', '.mode-visitor .spatial-story-copy', '.mode-visitor .spatial-object-caption']) {
    const layer = Number(declarations(selector)['z-index']);
    assert.ok(Number(image['z-index']) > layer, `${selector} must paint behind the model`);
    assert.ok(layer > Number(controls['z-index']), `${selector} must remain above the input surface`);
  }
});

test('editor thumbnail dragging disables the model input surface', () => {
  assert.equal(declarations('.spatial-thumbnail-dragging .spatial-station-content > .spatial-sketchfab .spatial-sketchfab-controls')['pointer-events'], 'none');
});
