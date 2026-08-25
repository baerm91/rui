import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/0008_story_versions_and_analytics.sql', import.meta.url), 'utf8');
const dashboardMigration = await readFile(new URL('../supabase/migrations/0009_dashboard_analytics_counts.sql', import.meta.url), 'utf8');
const versionPermissionMigration = await readFile(new URL('../supabase/migrations/0010_repair_story_version_permissions.sql', import.meta.url), 'utf8');

test('raw analytics are readable only by the story owner', () => {
  assert.match(migration, /using \(public\.is_story_owner\(story_id\)\)/);
  assert.match(migration, /if not public\.is_story_owner\(target_story_id\) then/);
  assert.match(migration, /revoke all on public\.story_analytics_events from anon, authenticated/);
});

test('version restore preserves a recoverable pre-restore snapshot', () => {
  assert.match(migration, /'before_restore'/);
  assert.match(migration, /limit 50/);
  assert.match(migration, /interval '10 minutes'/);
});

test('dashboard view counts are aggregated only for owned stories', () => {
  assert.match(dashboardMigration, /where stories\.owner_id = \(select auth\.uid\(\)\)/);
  assert.match(dashboardMigration, /count\(distinct events\.session_id\)/);
  assert.match(dashboardMigration, /revoke execute .* from public, anon/);
});

test('authenticated authors can read version metadata without direct write grants', () => {
  assert.match(versionPermissionMigration, /grant select on table public\.story_versions to authenticated/);
  assert.match(versionPermissionMigration, /revoke insert, update, delete/);
});
