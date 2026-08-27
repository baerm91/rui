# RIU 3D visual-quality verification

## Method and environment

The repeatable capture command is `npm run visual:capture -- --label <label>`. It starts a fresh headless Chrome process with hardware WebGL enabled, creates an isolated browser context for every case, fixes `Math.random()` to `0.17`, waits for the application's explicit ready state, performs the declared interactions, and captures the visible viewport. Console errors, uncaught exceptions, unhandled rejections, WebGL canvases, and room-camera coordinates are written to `manifest.json`.

- Windows 11 Home 10.0.26200, 64 bit
- Node.js 24.16.0, npm 11.4.2
- Chrome 151.0.7922.174, ANGLE default backend
- Intel UHD Graphics 32.0.101.6790 and NVIDIA GeForce RTX 4070 Laptop GPU 32.0.15.7700
- Desktop viewport: 1440 × 1000 at DPR 1
- Mobile viewport: 390 × 844 at DPR 1 with touch emulation
- Local Vite origin: `http://localhost:3005`

Every case uses a new browser context, so application storage and the context's HTTP cache start cold. Chrome, the operating system, CDN, and DNS may still retain process- or machine-level data; this suite is a deterministic visual regression suite, not a network timing benchmark. The slow-loading case applies 250 ms latency and a 16 KB/s transfer limit after the overview has loaded. Warm-cache appearance is identical and was checked during the intermediate iterations, but only the isolated final matrix is retained.

The baseline was captured before the visual changes. The final matrix contains 18 captures: nine representative states on desktop and mobile. All 18 reported a WebGL canvas and zero console, runtime, or WebGL errors.

## Representative states

| State | Fixed interaction/camera | Baseline weakness | Final result |
| --- | --- | --- | --- |
| Starhemberg initial | Authored first-station camera | Severe texture smearing at grazing angles; masonry and path hard to read | Anisotropic texture sampling makes masonry, path, vegetation, and silhouette substantially clearer while preserving the authored composition |
| Heidentor initial | Authored first-station camera | Good overall; distant ground textures softened at oblique angles | Existing composition retained; texture sampling improves or preserves detail with no visual regression |
| Room overview | Calculated full-station overview | Flat hierarchy and small object previews, but coherent museum layout | Authored museum overview retained; all three stations and object previews remain selectable and visible |
| Room station 1 | Stored station camera mapped into presentation layout | Helmet oversized, clipped, black, and visibly floating | Bounding-box normalization, ground alignment, model-only PBR environment light, authored camera, and contact shadow produce a complete readable object |
| Room station 2 | Stored station camera mapped into presentation layout | Duck oversized, clipped, floating, and flat | Object is fully visible, grounded on the plinth, correctly scaled, and separated from the caption on both viewports |
| Model loading | Same station camera with 250 ms / 16 KB/s throttling | No visitor-visible progress state | Accessible live status names the loading object; exploration remains disabled until ready |
| Free exploration | Fixed orbit drag from 72/52% to 55/43% viewport position | Curated and free states were indistinguishable; unconstrained orbit could enter geometry | Explicit `Frei erkunden` state with bounded polar/azimuth angles and safe zoom distance |
| Restored composition | Same drag followed by restore action | No reliable return path | `Komposition wiederherstellen` returns exactly to the recorded authored position and target on desktop and mobile |
| Room editor | Fixed editor camera | Preview route loaded without the application stylesheet | Complete RIU editor styling, model/source controls, transform/camera/light/audio controls, station management, and save state are visible on both viewports |

## Before and after evidence

The retained baseline and final folders are intended to be committed. Intermediate exploratory captures are ignored by Git.

| Scene | Before | After |
| --- | --- | --- |
| Starhemberg desktop | [baseline](../artifacts/visual-quality/baseline/starhemberg-initial-desktop.png) | [final](../artifacts/visual-quality/final/starhemberg-initial-desktop.png) |
| Starhemberg mobile | [baseline](../artifacts/visual-quality/baseline/starhemberg-initial-mobile.png) | [final](../artifacts/visual-quality/final/starhemberg-initial-mobile.png) |
| Heidentor desktop | [baseline](../artifacts/visual-quality/baseline/heidentor-initial-desktop.png) | [final](../artifacts/visual-quality/final/heidentor-initial-desktop.png) |
| Heidentor mobile | [baseline](../artifacts/visual-quality/baseline/heidentor-initial-mobile.png) | [final](../artifacts/visual-quality/final/heidentor-initial-mobile.png) |
| Room overview desktop | [baseline](../artifacts/visual-quality/baseline/room-overview-desktop.png) | [final](../artifacts/visual-quality/final/room-overview-desktop.png) |
| Room overview mobile | [baseline](../artifacts/visual-quality/baseline/room-overview-mobile.png) | [final](../artifacts/visual-quality/final/room-overview-mobile.png) |
| Room station 1 desktop | [baseline](../artifacts/visual-quality/baseline/room-station-one-desktop.png) | [final](../artifacts/visual-quality/final/room-station-one-desktop.png) |
| Room station 1 mobile | [baseline](../artifacts/visual-quality/baseline/room-station-one-mobile.png) | [final](../artifacts/visual-quality/final/room-station-one-mobile.png) |
| Room station 2 desktop | [baseline](../artifacts/visual-quality/baseline/room-station-two-desktop.png) | [final](../artifacts/visual-quality/final/room-station-two-desktop.png) |
| Room station 2 mobile | [baseline](../artifacts/visual-quality/baseline/room-station-two-mobile.png) | [final](../artifacts/visual-quality/final/room-station-two-mobile.png) |
| Room editor desktop | [baseline](../artifacts/visual-quality/baseline/room-editor-desktop.png) | [final](../artifacts/visual-quality/final/room-editor-desktop.png) |
| Room editor mobile | [baseline](../artifacts/visual-quality/baseline/room-editor-mobile.png) | [final](../artifacts/visual-quality/final/room-editor-mobile.png) |

Additional final evidence: [loading desktop](../artifacts/visual-quality/final/room-model-loading-desktop.png), [exploration desktop](../artifacts/visual-quality/final/room-exploration-desktop.png), [restored desktop](../artifacts/visual-quality/final/room-restored-desktop.png), and the complete machine-readable [manifest](../artifacts/visual-quality/final/manifest.json).

## Accepted techniques

- Up to 8× anisotropic sampling for every imported model texture, bounded by GPU capability.
- Bounding-box normalization that centers X/Z, aligns the lowest model point to the ground, and keeps the editor's position/rotation/scale transform intact.
- Removal of the hidden visitor-only 1.35× model enlargement.
- Mapping of the saved station camera and target into the visitor presentation layout instead of replacing them with a generic camera.
- Mobile camera safety framing that preserves the authored direction while adding controlled distance and horizontal offset.
- Model-only PMREM `RoomEnvironment` at restrained intensity for readable metallic and rough PBR materials without washing out the museum architecture.
- Existing ACES tone mapping, sRGB output, soft shadow maps, key/fill lighting, floor receivers, fog, and real object shadows retained.
- Explicit curated/exploration states, damping, bounded orbit angles, safe min/max distance, and an exact camera-restore transition.
- Accessible loading and error states for real external glTF URLs.
- Fixed visual regression cases for overview, selection, loading, exploration, restoration, and editor workflows.

## Techniques evaluated and rejected

- A stronger Starhemberg key/fill preset was reverted because it reduced masonry and vegetation readability.
- A global `RoomEnvironment` was reverted because it washed out walls, floor, text panels, and the warm museum palette. Environment light is applied only to imported PBR models.
- Unbounded room orbit was rejected after a fixed drag entered/underflew the room geometry.
- Large visitor-only model scaling and aggressive mobile zoom were rejected because they clipped objects or pushed them behind UI.
- Bloom and generic post-processing were not added: the scenes did not need emissive spectacle, and bloom would reduce documentary surface fidelity.
- Screen-space ambient occlusion was not added because current contact is supplied by real shadow receivers; its cost and halo risk were not justified for these scenes.
- A generic HDRI background was not used because it would weaken RIU's authored cultural-heritage atmosphere.

## Editor and persistence verification

The existing editor continues to expose model URL add/replace, per-object position/rotation/scale, thumbnail arrangement, initial object selection, camera capture, lighting, wall/atmosphere, audio, station ordering, save, and visitor preview. The existing storage test confirms that model URLs, transforms, initial object, camera, lighting, audio, and wall settings survive the RIU serialization pipeline. The final editor captures verify the actual desktop and mobile presentation.

## Remaining source limitations

- Starhemberg's source photogrammetry contains holes, stretched triangles, baked shadows, and areas with limited texture resolution. Anisotropic filtering improves sampling but cannot reconstruct missing geometry or source pixels.
- Heidentor's scan includes an abrupt rectangular survey boundary and incomplete fragments. These are source-model characteristics and were retained rather than hiding archaeological content.
- The room demonstration uses third-party sample models and remote URLs; availability and download time remain external constraints. Loading and error UI now handles that dependency visibly.
- OrbitControls is intentionally constrained rather than implementing full architectural collision detection. This keeps exploration safe and predictable but is not a first-person walkthrough system.

## Verification commands

- `npm run visual:capture -- --label final`: 18/18 captures passed, 0 recorded errors
- `npm test`: 151/151 passed
- `npm run lint`: 90 source files checked
- `npm run build`: production build passed

