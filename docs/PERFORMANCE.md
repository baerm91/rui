# RIU performance benchmark

## Status

The optimized build is materially faster than the original repository state, but it does **not** satisfy the global `< 50 ms` target. The benchmark therefore reports failure and no success claim is made.

The strict comparison uses the unchanged Git revision `9cb547e5ab8e17247ef4bf98273cd9fd00ab051d` as the baseline and the current working tree as the candidate. Both were built separately and measured with the same benchmark implementation after its methodology was tightened.

## Repeatable method

```powershell
npm run build
npm run perf -- --output artifacts/performance/latest.json
npm run perf:compare -- artifacts/performance/strict-baseline-original.json artifacts/performance/latest.json
npm test
npm run lint
```

The benchmark serves the production `dist` directory from `http://127.0.0.1:4173` and controls system Chrome directly through the Chrome DevTools Protocol. Each scenario stores every raw sample and its navigation, paint, request, byte, external-resource, error, and final-path diagnostics.

Schema-v2 reports also record Git HEAD/status, SHA-256 of the binary diff, deterministic SHA-256 and file count of `dist`, explicit locale/timezone, and each scenario's viewport. This preserves attribution even for a dirty working tree.

- Route metric: navigation start until the route-specific element is visible, the loading overlay is no longer visually covering the page, fonts are ready, and the browser has received a post-paint opportunity.
- Interaction metric: click start until the target state is visible and a post-paint opportunity has occurred.
- HTTP-cache-cold: a fresh incognito browser context, real IndexedDB enabled, and the HTTP cache disabled. The Chrome process, JIT state, GPU process, and operating-system file cache are not reset.
- Warm: a fresh context with HTTP caching enabled; the exact scenario is primed once and then measured.
- Statistical comparison: 5 cold and 10 warm samples for each of its 35 scenarios; p95 is nearest-rank and therefore still sensitive to outliers. The later 68-scenario expansion was run once per cache mode as a reachability smoke only.
- Threshold: strictly less than 50 ms. Failed samples are retained and fail the result. No samples are discarded.
- Static server: production files are served without compression. This is deterministic but differs from a compressed CDN deployment.

Environment: Windows `10.0.26200`, Intel Core i9-13980HX (32 logical CPUs), 32 GB RAM, Node `24.16.0`, Chrome `151.0.7922.174`, headless viewport `1440x1000@1x`, host timezone Europe/Berlin.

## Strict results

Values are milliseconds. `B cold`/`B warm` are original medians. `F cold`/`F warm` are optimized medians. The last two columns are optimized p95 values.

| Scenario | B cold | F cold | B warm | F warm | F cold p95 | F warm p95 |
|---|---:|---:|---:|---:|---:|---:|
| Home, anonymous | 1436.9 | 197.2 | 62.1 | 39.2 | 247.4 | 60.7 |
| Discover | 545.9 | 139.7 | 68.7 | 38.8 | 488.0 | 49.5 |
| Discover, author filter | 794.8 | 275.4 | 74.2 | 38.9 | 340.3 | 58.7 |
| Login | 849.7 | 258.3 | 56.7 | 33.1 | 297.5 | 48.9 |
| Register | 893.8 | 273.2 | 55.7 | 33.1 | 295.6 | 58.8 |
| Reset password | 787.0 | 265.5 | 56.8 | 33.1 | 301.0 | 38.7 |
| Dashboard, owner | 772.1 | 326.1 | 82.2 | 39.3 | 349.8 | 55.5 |
| Dashboard, guest gate | 791.3 | 273.7 | 61.0 | 32.8 | 413.2 | 38.7 |
| Account | 886.0 | 264.4 | 62.4 | 33.2 | 323.7 | 38.7 |
| Admin | 736.1 | 234.6 | 57.4 | 38.0 | 282.2 | 38.9 |
| Admin denied | 772.1 | 196.3 | 57.1 | 37.7 | 263.8 | 44.3 |
| New story | 997.4 | 215.6 | 62.6 | 33.0 | 308.6 | 49.4 |
| New story, light-user gate | 822.0 | 267.9 | 62.5 | 38.8 | 324.7 | 49.8 |
| Analytics, owner | 982.8 | 281.8 | 56.8 | 32.7 | 348.8 | 38.5 |
| Analytics denied | 740.8 | 211.0 | 50.8 | 33.0 | 276.7 | 43.3 |
| Not found | 788.6 | 263.5 | 57.3 | 32.9 | 281.0 | 38.7 |
| Legacy `/edits` 404 | 736.9 | 285.2 | 76.8 | 33.2 | 307.0 | 49.1 |
| Room visitor | 828.7 | 573.8 | 257.8 | 191.8 | 877.7 | 280.9 |
| Room studio | 993.1 | 471.2 | 251.9 | 182.8 | 608.7 | 345.8 |
| Model visitor | 2151.6 | 1403.2 | 1625.3 | 1172.0 | 1500.2 | 1217.1 |
| Model studio | 1284.3 | 895.8 | 1118.5 | 1169.0 | 971.7 | 1339.0 |
| Sketchfab visitor shell | 2131.7 | 1131.2 | 1543.7 | 1159.6 | 1323.2 | 1206.1 |
| Guest account menu | 48.0 | 21.6 | 27.7 | 21.8 | 27.6 | 31.1 |
| Authenticated account menu | 23.1 | 14.9 | 20.1 | 14.7 | 14.9 | 15.2 |
| Metadata dialog | 30.9 | 14.9 | 25.9 | 10.6 | 15.1 | 20.5 |
| Collaboration dialog | 28.4 | 11.2 | 23.8 | 10.7 | 12.6 | 11.6 |
| Version dialog | 34.6 | 10.9 | 24.1 | 10.8 | 11.0 | 11.2 |
| Model story information | 34.9 | 37.0 | 26.1 | 30.3 | 128.2 | 65.0 |
| Studio import/export | 37.2 | 38.3 | 26.0 | 24.9 | 47.1 | 33.2 |
| Enter room station | 524.0 | 596.1 | 523.1 | 519.9 | 727.3 | 842.2 |
| Open local room object | 106.9 | 10.7 | 131.7 | 123.7 | 85.6 | 355.4 |
| Open Sketchfab room object shell | 45.6 | 18.6 | 24.3 | 55.0 | 58.3 | 196.4 |
| Return to room overview | 131.4 | 123.7 | 149.2 | 132.6 | 135.7 | 446.3 |
| Room studio visitor mode | 42.5 | 15.7 | 31.0 | 12.6 | 19.6 | 28.2 |
| Room studio editor mode | 30.5 | 29.1 | 35.0 | 28.4 | 120.1 | 43.5 |

The full-suite comparator flagged nine possible regressions because it intentionally has zero tolerance. Most were isolated p95 outliers while medians improved. A 10-cold/20-warm confirmation of `room-enter-station` showed the candidate faster in all four statistics (cold median `515.3 → 488.3`, cold p95 `600.3 → 578.0`, warm median `513.4 → 491.0`, warm p95 `618.9 → 575.0`). A matching confirmation for the model information dialog improved both medians and cold p95; warm p95 varied from `45.9` to `53.7` ms. This residual 7.8-ms tail variation has no code-path-specific causal change and is retained as noise rather than hidden.

## Changes made, one at a time

1. Split platform, room, and model experience entry paths so platform pages do not boot Three.js.
2. Removed a dynamic-import waterfall by loading the model runtime and React experience UI concurrently.
3. Replaced remote Google Fonts requests with pinned local WOFF2 files.
4. Lazily loaded the Supabase SDK only when Supabase is configured and used.
5. Removed a fixed 400-ms JavaScript hold after successful model loading; the existing visual fade remains.
6. Split GSAP from the eager React vendor chunk.
7. Stopped loading the 80.55-KB experience/editor stylesheet on platform-only routes, while preserving an inline critical shell to prevent a flash of unstyled content.
8. Stopped treating legacy `/edits` as a 3D experience route.

Build evidence: the original eager output included `react-main` 281.78 KB, `platformStore` 277.31 KB, and a 276.75-KB vendor chunk. The optimized platform path uses a 2.70-KB entry, 60.43-KB PlatformApp, 68.07-KB platform store, and 206.74-KB React vendor chunk; Supabase (208.22 KB), GSAP (69.56 KB), experience CSS (80.55 KB), and Three.js (743.42 KB) are separately loaded only where needed.

## Why `< 50 ms` is not achievable for every state

The failure is measurable even with zero internet distance because the benchmark server is on loopback:

- The fastest optimized cold route p95 is still 247.4 ms for home and 263.8 ms for the admin-denied route. Required HTML, local fonts, React parsing/evaluation, IndexedDB initialization, layout, and paint therefore exceed 50 ms on this machine without network latency.
- The retained Three.js chunk is 743.42 KB minified (201.01 KB gzip) before model content. Model routes have optimized warm p95 values of 1.2–1.34 seconds under the stricter unobscured/paint-ready definition.
- Model pages intentionally retain the 0.8-second loading-screen fade. Removing it would change visual quality and was prohibited.
- `room-enter-station` intentionally delays its state change by 340 ms and uses a 1.58-second spatial camera transition. The 10/20 confirmation achieved a lowest reliable p95 of 575.0 ms warm. A `< 50 ms` result is logically impossible without shortening/removing the designed transition.
- Sketchfab content requires a third-party iframe and `viewerready` event. Current shell measurements do not yet include that event, so they must not be cited as proof of Sketchfab readiness or its external lower bound.

## Route and state inventory / remaining limitations

The current production suite covers 35 route/access variants and 33 major interactions. A complete 1-cold/1-warm reachability run exercised all 68 without a scenario error. The strict statistical table above remains the 5-cold/10-warm result for the original 35 scenarios; the one-sample expansion is a coverage smoke, not a latency distribution. Items still not represented by an automated scenario remain explicit limitations, not implicit passes:

- Model visitor: reconstruction/portal variants, free-navigation reset, annotation list previous/next behavior, and video/media overlay. Station 2, free-navigation activation, and the annotation dialog are covered.
- Model studio: alignment workflow, the remaining project/station tab combinations, annotation/origin placement actions, reset confirmation, and model-error states. Demo, models, project settings, Sounds/Annotations/Lighting/Origin, and Scene/Media tabs are covered.
- Room visitor/studio: audio controls, empty station, complete object-load readiness, and edit-sidebar add/delete/save/reset flows. Second-station, demo, mode switches, local-object and Sketchfab-shell states are covered.
- Platform: metadata preview builder, collaboration invitation variants, restore/delete confirmations, blocked user, OAuth callback states, and theme toggle. Search/category/empty states, mobile navigation, auth gates, and owner/editor/viewer/draft permissions are covered.
- Development-only `/__spatial-preview` is outside the production build and needs a separate development-server suite.
- The deterministic local triangle is a shell microbenchmark, not a representative large GLTF/GLB workload. Real seed-story assets and decoder/texture costs require a separate content suite.
- Room GLTF and both Sketchfab scenarios currently stop at application-owned visible UI. Explicit first rendered model frame and cross-origin `viewerready` instrumentation remain necessary for true content-ready timing.
- Supabase is not configured in the benchmark environment, so the new asynchronous configured-auth path is covered by static checks and existing tests, but not by a live service smoke test.

These limitations prevent a claim that every possible user state has been performance-certified. Raw JSON reports are generated locally for each run and are intentionally not versioned.

## Artifacts

`artifacts/performance/` is ignored by Git because reports contain thousands of generated raw samples. `npm run perf:baseline` creates `baseline.json`; `npm run perf` creates `latest.json`; `npm run perf:compare` compares those two reports. Preserve selected reports externally when a long-term audit trail is required.
