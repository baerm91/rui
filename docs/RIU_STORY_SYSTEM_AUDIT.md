# RIU Story-System-Audit

Stand: 27. August 2026

## 1. Methode und Evidenz

Dieser Audit behandelt die vorhandenen Stories als Versuchsaufbauten. Technische Existenz gilt nicht automatisch als redaktioneller Nutzen.

- Source-Inventar: alle Dateien unter `src/`, Story-JSONs, 43 Testdateien sowie Architektur- und Qualitätsdokumentation.
- Browser-Erfahrung: Starhemberg (7 Stationen), Heidentor (4 Stationen) und der räumliche Entwicklungsprototyp „Material und Erinnerung“ (3 Stationen) wurden in Chrome geöffnet und interaktiv benutzt.
- Feste Viewports: Desktop 1440 × 1000, Mobile 390 × 844, DPR 1.
- Reproduzierbare Screenshots: `npm run visual:capture -- --label story-system-audit-validation`.
- Ausgangsevidenz vor den Prototypen: lokal erzeugter Lauf `story-system-audit-baseline` (18 Zustände). Die erweiterte Matrix wurde zunächst gegen den unveränderten Stand aufgebaut; fehlerhafte Locator-Läufe sind nicht als Evidenz gewertet.
- Validierungsevidenz: lokal erzeugter Lauf `story-system-audit-validation`. Er erfasst zusätzlich alle Stationen, Heidentors Reveal-Hover, Starhembergs Annotation, Fokus-Rückkehr und den beratenden Story-Check. Generierte PNGs und Manifeste werden nicht versioniert; sie lassen sich mit dem dokumentierten Befehl reproduzieren.
- Browserkonsole, Runtime-Fehler, WebGL-Canvas, Kamera und aktives Fokusziel werden pro Fall protokolliert.
- Ergänzende echte Browserprüfung: Starhemberg, „Burgtor“ öffnen → Fokus auf „Annotation schließen“ → Escape → Fokus zurück auf Marker bzw. stabile Annotationsnavigation.

Grenze: Touch wurde mit mobilem Viewport und Touch-Emulation, aber weiterhin mit Mausereignissen für Drag getestet. Ein Screenreader, echte Mobilhardware, GPU-Leistungsklassen und fachliche Besucherforschung waren nicht Teil dieses Audits.

## 2. Inventar der bestehenden Stories

### Burg Starhemberg

- **Aussage:** Architektur- und Nutzungsgeschichte einer Burganlage vom Gesamtüberblick über Verteidigungsfolge, Kernburg und Funktionsbereiche bis zur freien Detailerkundung.
- **Modelle:** ein externes glTF (`starhemberg.vercel.app`), normalisiert, zentriert und geerdet; 24 räumliche Architektur-Annotationen.
- **Stationen:** (1) Starhemberg, (2) Weg zur Kernburg, (3) Kernburg, (4) Mittelpunkt des Burglebens, (5) Aufteilung, (6) Vorburg, (7) Freie Ansicht.
- **Kamera/Navigation:** sieben gespeicherte Stationsansichten mit Scroll-Interpolation und direkter Punktnavigation. Letzte Station aktiviert freie Navigation und Annotationen.
- **Licht/Umgebung:** Projektlicht mit Hemisphere/Fill; keine Story-Hintergründe, Videos, Bildflächen, Animationen oder Audio belegt.
- **Text/Medien:** lange Stationstexte; Annotationen mit Titel, Text, Weltposition und Fokus-Kamera, aber ohne Bilder/Quellen.
- **Laden/Fehler/Mobil:** Fortschrittsanzeige und Fehlermeldung; responsive Textdarstellung; kein inhaltlicher Nicht-3D-Fallback.
- **Editor:** Stationstext, Kamera, Freinavigation, Projektlicht, Annotationen und Medien technisch editierbar.
- **Einzigartig:** geführte Architekturabfolge mit Übergabe an eine umfangreiche Annotationserkundung.
- **Browserbefund:** Die räumliche Abfolge trägt die Erzählung. In der freien Ansicht werden 24 Ziele gleichzeitig angeboten; ohne thematische Gruppierung ist unklar, welche Details zur Kernbotschaft gehören. Der Dialog hatte vor dem Prototyp ein defektes Schließen-Label und keine robuste Fokus-/Escape-Rückkehr.

### Das Heidentor

- **Aussage:** heutiger Ruinenbestand, Verlust über 1600 Jahre, Digitalisierungsprojekt und Vergleich mit einer Rekonstruktion des 4. Jahrhunderts.
- **Modelle:** Ruine plus räumlich ausgerichtete Rekonstruktion von externen glTF-URLs.
- **Stationen:** (1) Alter Ego, (2) Der Zahn der Zeit, (3) TWIN-IT, (4) Der sichtbare Wandel.
- **Kamera/Navigation:** vier gespeicherte Ansichten; Scroll und Punktnavigation; freie Ansicht in Station 4.
- **Licht/Umgebung:** kamera-relative Hemisphere-/Key-/Fill-Beleuchtung; schwarzer neutraler Hintergrund.
- **Text/Medien:** Station 3 enthält ein eingebettetes Video; Station 1 enthält eine Platzhalterannotation („Annotation 1“, „blablabla“).
- **Übergänge/Interaktion:** Ruinen-, Rekonstruktions-, Portal- und Reveal-Laufzeit existieren. Genutzt werden Ruine, Rekonstruktion und ein Maus-/Touch-Radius-Reveal.
- **Laden/Fehler/Mobil:** beide Modelle werden vor Nutzung geladen; responsive UI; Reveal-Anweisung nennt ausschließlich die Maus.
- **Editor:** Zwei Modellrollen, Alignment, Kamera, Reveal-/Portalparameter, Video und Annotationen editierbar.
- **Einzigartig:** registrierter Bestand/Rekonstruktions-Vergleich über einen räumlichen Shader.
- **Browserbefund:** Die zeitlichen Zustände sind interpretativ stark, aber semantisch schwach beschriftet. Der Reveal zeigt technisch „mehr“, erklärt jedoch weder Evidenzgrad noch Rekonstruktionsquelle. Video ist ohne Transkript. Die Platzhalterannotation darf kein Referenzmuster werden.

### Material und Erinnerung (Entwicklungsroute)

- **Aussage:** generischer Versuch zu Form, Oberfläche, Bewegung und digitaler Bewahrung; kein fachlich belastbarer Kulturerbe-Inhalt.
- **Modelle:** Damaged Helmet, Duck und Avocado von öffentlichen glTF-Beispielquellen; drei Objekte in Station 1, je ein Objekt in Station 2/3.
- **Kamera/Navigation:** Raumübersicht, direkte Stationswahl, gespeicherte Stationseinstiege, Objektauswahl, kuratierte Ansicht, freie Orbit-Erkundung und exakte Wiederherstellung.
- **Licht/Umgebung:** eigener Ausstellungsraum, Wand-/Bodenmaterialien, Fog, Key/Ambient, Objektumgebungslicht und Kontaktschatten.
- **Text/Medien:** Stationseinleitung, Thumbnail-Karten, Objektbeschreibung, Attribution/Lizenz; Schema für Wandbild und räumliches Audio.
- **Laden/Fehler/Mobil:** benannter Live-Ladestatus, Fehlertext, deaktivierte Erkundung bis Modell bereit; responsive Besucher- und Editoransicht.
- **Editor:** beliebige Modell-URLs, mehrere Objekte, Position/Rotation/Skalierung, Startobjekt, Thumbnail-Layouts, Kamera, Stationsposition, Licht, Wand und Audio.
- **Einzigartig:** räumliche Stationen mit unabhängig positionierten URL-Modellen und explizitem Wechsel kuratiert ↔ frei.
- **Browserbefund:** Modellauswahl und Rückkehr funktionieren überzeugend. Die Raumästhetik erzeugt jedoch keinen archäologischen Kontext; automatische Normalisierung zerstört verlässliche Größenvergleiche. Sichtbare gemeinsame Projektpanels sind im Raum-Editor teilweise No-ops und daher irreführend.

## 3. Capability-Matrix

| Fähigkeit | Storys | Implementierung | Editierbar? | Besucherzweck | Kosten / Grenzen |
|---|---|---|---|---|---|
| Lineare Scroll-Stationen | Starhemberg, Heidentor | `main.js`, `StationNavDots.jsx` | Reihenfolge/Tempo | geführte Progression | nur lineare Hauptlinie |
| Gespeicherte Stationskamera | alle | `stationCamera.js`, `SpatialStationEditor.jsx` | ja | authored composition | kein unabhängiges Viewpoint-Vokabular |
| Kamera-Interpolation | Modell-Stories | `main.js`, `cameraInterpolation.js` | indirekt | räumliche Kontinuität | Pfad/Easing nicht redaktionell |
| Ruine/Rekonstruktion | Heidentor | `models.js`, `StationEditorCard.jsx` | ja | Zeit-/Zustandsvergleich | zwei globale Rollen, keine Semantik |
| Reveal-Shader | Heidentor | `models.js`, `portalTransition.js` | Radius/Weichheit | fehlende Bauteile erkunden | Shader-/Inputkosten, nicht selbsterklärend |
| Portal | keine aktive Demo | `portalTransition.js` | ja | potenzieller Zustandswechsel | technisch vorhanden, nicht validiert |
| Alignment | Heidentor | `alignment.js`, `AlignmentPanel.jsx` | Spezialworkflow | Modelle registrieren | fachlich/technisch anspruchsvoll |
| Freies Orbit/Pan/Zoom | Schlussstationen, Raum | `freeOrbit.js`, `ExhibitionRoom.jsx` | Grenzen teilweise | selbstständige Prüfung | zwei inkompatible Laufzeiten |
| First-Person/WASD | Modelllaufzeit | `main.js` | kaum | Raumbewegung | kein belegter Besucherauftrag |
| Räumliche Annotation | Starhemberg, Heidentor-Platzhalter | `AnnotationOverlay.jsx` | ja | Text an Ort binden | nur Modell-Stories, keine Objekt-ID |
| Annotationskamera | Starhemberg | `annotationCamera.js` | ja | Detail fokussieren | bisher kein eigenes Rückkehrziel |
| Annotationssequenz | Starhemberg | `AnnotationOverlay.jsx` | Reihenfolge indirekt | Details durchgehen | Arrayfolge statt Storypfad |
| Annotationsbilder | keine Demo | `AnnotationOverlay.jsx` | bis vier | visuelle Belege | bisher ungetestet; keine Rechtefelder |
| 3D-Bildflächen | keine Demo | `imagePlanes.js` | drei Slots | Plan/Foto im Raum | feste Obergrenze, keine Semantik |
| Bildschirm-Hintergrund | keine Demo | `BackgroundLayer.jsx` | Preset/Upload/URL | Kontext/Atmosphäre | nicht räumlich kalibriert |
| Video | Heidentor | `VideoOverlay.jsx` | URL/Position/Größe | Zusatzkontext | iframe, kein Transkript/Captionschema |
| Narrativtext | alle | `NarrativeTextBlock.jsx`, `ExhibitionRoom.jsx` | ja | Kerninterpretation | präzise Bindung nur über Station |
| Textanimation | Modell-Stories | `NarrativeTextBlock.jsx` | Preset | Rhythmus | meist dekorativ |
| Projekt-Audio | keine Demo belegt | `projectSounds.js` | ja | Atmosphäre | kein Transkript/Seek/Sprachtyp |
| Raum-Audio | Schema, Demo leer | `spatialStory.js` | ja | Ortsklang | getrenntes Schema, HTML-Audio-Simulation |
| Wettereffekte | keine Demo | `weatherEffects.js` | indirekt | Atmosphäre | harte Soundkopplung, hohe Ablenkungsgefahr |
| Modellanimation | keine Demo | `modelAnimation.js` | an/aus/Tempo | Bewegung zeigen | spielt alle Clips, keine Aussagezustände |
| glTF/GLB/FBX | Modell-Stories | `models.js` | URL/lokal | Assetbereitstellung | CORS/Formatabhängigkeit |
| Draco/KTX2/Meshopt | Raum | `localModel.js`, `ExhibitionRoom.jsx` | automatisch | komprimierte Assets | nicht paritätisch in Modelllaufzeit |
| Sketchfab | beide Typen möglich | `SketchfabViewer.jsx` | URL | Fremdhosting | Drittanbieter, eigene Controls/A11y |
| Normalisierung/Erdung | alle | `models.js`, `ExhibitionRoom.jsx` | Raumtransform danach | sichtbare Modelle | reale Relativmaßstäbe gehen verloren |
| PBR/Tone Mapping | alle | `main.js`, `ExhibitionRoom.jsx` | Exposure kaum | Materiallesbarkeit | getrennte Hardcodes |
| Licht-Rigs | alle | `environment.js`, Lichtpanels | ja, roh | Form/Material | keine interpretativen Presets/Checks |
| Schatten/Fog | alle | beide Laufzeiten | begrenzt/hard-coded | Tiefe/Trennung | keine gemeinsame Qualitätsskala |
| Raumübersicht/Pfad | Raum | `ExhibitionRoom.jsx` | aus Positionen | Orientierung | fehlt Modell-Stories |
| Mehrere Objekte | Raum | `spatialStory.js` | ja | Gruppe/Vergleich | keine Beziehungen/Annotationen; Maßstab unsicher |
| Thumbnail-Komposition | Raum | `SpatialStationEditor.jsx` | ja | Auswahl | Repräsentation getrennt vom 3D-Objekt |
| JSON/Draft/Persistenz | alle | `stations.js`, `useStationConfigFile.js` | ja | Wiederöffnen/Teilen | Browserquote; Room-Parität lückenhaft |
| Laden/Fehler | alle | `main.js`, `ExhibitionRoom.jsx`, `SketchfabViewer.jsx` | nein | Status | Retry und inhaltlicher Fallback fehlen |
| Mobile Layouts | alle | CSS beider Laufzeiten | automatisch | Touch/kleine Screens | Screenshot ≠ vollständiger Touchtest |
| Story-Check | beide Editoren, Prototyp | `storyReadiness.js`, `StoryReadinessPanel.jsx` | nur lesend | Lücken vor Publikation sehen | noch nicht blockierend, keine Netz-/Kameraprüfung |

## 4. Klassifikation

| Klasse | Elemente | Begründeter Bedarf |
|---|---|---|
| **A Essential** | authored Stations-/Annotationsansichten; klare lineare Navigation; verständlicher Text; expliziter Übergang geführt/frei; Reset; Auswahlzustand; Lade-/Fehlerstatus; Audio-Kontrolle; responsive Darstellung | Verstehen, Orientierung, Kontrolle und Wiederherstellung. Diese Funktionen lösen in den Browseraufgaben reale Besucherprobleme. |
| **B Useful in specific stories** | Bestand/Rekonstruktion; Video; Annotationbilder; mehrere Raumobjekte; Modellanimation; Projekt-/Stationsaudio; Alignment; Plan-/Bildflächen | Wertvoll, wenn Objekt, Befund oder Leitfrage dies verlangt; nicht jede Story braucht sie. |
| **C Experimental** | Reveal/Portal; räumlicher Raumtyp; Sketchfab-Spezialsteuerung; WASD/First-Person; zufälliges Startobjekt; Wetterkopplung; rohe Portalparameter | Technisch möglich, aber noch nicht ausreichend verständlich, robust, barrierefrei, redaktionell beherrschbar oder fachlich validiert. |
| **D Decorative** | Stern-/Blueprint-/milchige Hintergründe, Textanimationen, Autorotation, atmosphärisches Licht/Wetter ohne Informationsfunktion | Darf Stimmung tragen, muss jedoch Lesbarkeit, Reduced Motion und Objektpriorität respektieren. |
| **E Redundant/counterproductive** | sichtbare No-op-Projektpanels im Raum-Editor; Starhemberg-Station 1 als `reveal` ohne Rekonstruktionsmodell; Heidentor-Platzhalterannotation; unbeschrifteter Reveal; ausschließlich Maus benennende Hinweise; alle Animationsclips gleichzeitig | Erzeugt falsche Erwartungen, unklare Semantik oder technische Kosten ohne ausreichenden Besucherwert. |
| **F Missing foundation** | versionierte Storyblock-/View-State-Struktur; Nicht-3D-Fallback; Quellen/Objektmetadaten; Evidenz-/Hypothesestatus; Transkripte/Captions/Alttexte; Tastaturparität; fokussichere Dialoge; mobile/reduced-motion Preview; Publikationsprüfung; semantische Objektbindungen; sicherer Modellaustausch | Mehrere Storytypen und beide Editorfamilien benötigen diese Grundlagen. |

## 5. Kulturerbe-Use-Case-Coverage

Legende: **voll**, **teilweise**, **technisch, nicht editorfähig**, **nur Custom Code**, **nicht**, **ungetestet**.

### Objektgeschichten

| Situation | Status | Evidenz / Grenze |
|---|---|---|
| ein Objekt, mehrere sinnvolle Winkel | voll | Stations- und Annotationskameras; keine benannte View-Bibliothek |
| mehrere Details eines Objekts | teilweise | Annotationen; nur Modelllaufzeit, A11y-/Quellenlücken |
| Vorder-/Rückseite oder außen/innen | teilweise | diskrete Kameras möglich; kein eigener Block, keine Schnittansicht |
| Material/Herstellung/Nutzung/Restaurierung/Schäden | nur Custom Code | Text + Kamera möglich; keine semantischen Zustände |
| verwandte Objekte vergleichen | teilweise | Raum kann mehrere zeigen; Maßstab wird normalisiert, kein Vergleichsmodus |
| Original und Rekonstruktion | teilweise | Heidentor demonstriert zwei Rollen; nicht generisch/semantisch |
| unsichere/alternative Rekonstruktionen | nicht | kein Status, Quellenzwang oder Variantenvergleich |
| chronologische Objektänderung | nur Custom Code | Stationen/Modelle improvisierbar; keine Timeline-States |

### Archäologischer Kontext

| Situation | Status | Evidenz / Grenze |
|---|---|---|
| Objekt und Fundort / Schicht | nicht | kein Kontextanker oder Stratigrafieblock |
| mehrere Objekte eines Kontexts | teilweise | Raumstation; keine Relation, Provenienz oder Maßstabsvalidierung |
| ursprüngliche räumliche Situation | nur Custom Code | separates Modell/Room möglich, keine Evidenzsemantik |
| Bau-/Ortsphasen | nur Custom Code | Heidentor-Reveal als Spezialfall |
| Karte/Plan/Schnitt ↔ 3D | technisch, nicht editorfähig | Bildflächen existieren, aber ohne Kalibrierung/Verknüpfung |
| Bewegung durch archäologischen Raum | teilweise | WASD/Orbit technisch; kein geführter Weg oder Orientierungstest |
| Befund/Rekonstruktion/Hypothese unterscheiden | nicht | visuelle Effekte ohne kontrolliertes Fachvokabular |

### Narrativstruktur

| Situation | Status | Evidenz / Grenze |
|---|---|---|
| lineare Führung | voll | beide Modell-Stories |
| thematische Verzweigung | nicht | keine Branch-/Return-Struktur |
| optionale Vertiefung | teilweise | Annotationen/Video |
| Vergleich / Vorher-Nachher | teilweise | Heidentor-Spezialmodi, kein generischer Block |
| chronologische / räumliche Sequenz | teilweise | Stationsfolge; Semantik nur im Text |
| Überblick → Details | voll | Raumübersicht und Starhemberg-Schlussannotation |
| Detail → Kontext | teilweise | Reset/Stationswahl; kein gespeichertes Return-Ziel je Detail |
| geführt → frei | voll | Starhemberg und Raum; Heidentor teilweise |

### Medien und Interpretation

| Situation | Status | Evidenz / Grenze |
|---|---|---|
| Text an präziser Modellansicht | voll | Stations- und Annotationskameras |
| räumliche Annotation | teilweise | Modell-Stories; Room fehlt; Fokus jetzt gehärtet |
| Bilder an Modell-Detail | teilweise/ungetestet | Schema/UI vorhanden, keine Demo, bisher keine Rechtefelder |
| Audio mit Transkript | nicht | Audio vorhanden, Transkript fehlt |
| Zitate/Objektmetadaten | teilweise | freie Lizenz und Raum-Attribution; keine strukturierte Zitation |
| Quellen/Rechte | teilweise | Room sichtbar; globale Lizenz nicht im Besucherfluss |
| Glossar | nicht | nur Freitext |
| Unsicherheit/Fachdissens | nicht | nur im Freitext improvisierbar |
| Alternative ohne 3D | nicht | Fehlertext statt vollständiger Erzählalternative |

### Besucher- und Editorbedürfnisse

| Bedürfnis | Status | Grenze |
|---|---|---|
| sofortige Orientierung / Progression | teilweise bis voll | Modell-Stories linear klar; Annotationmenge und Reveal unklar |
| klare Affordanzen | teilweise | native Buttons; Hover-/Drag-/Canvasfunktionen unvollständig erklärt |
| lesbarer Text | voll visuell | keine Lesestufen/Sprachblöcke |
| Kontrolle Bewegung/Audio | teilweise | Mute/Reset vorhanden; Animationen/Video nicht vollständig steuerbar |
| Recovery nach Orientierungsverlust | teilweise | Room stark; Modell-Detailrückkehr bisher schwach |
| Desktop/Touch/Keyboard/Reduced Motion | teilweise | responsive; keine komplette Input-Parität oder automatische A11y-Suite |
| sinnvoller Lade-/Fehlerfallback | teilweise / nicht | Laden sichtbar; kein Retry/Poster/Kerntextpfad |
| frühere Ansicht wiederbesuchen | teilweise | Stationspunkte und Room-Reset; kein View-History |
| Stories ohne Code bauen | teilweise | zwei Editoren, unterschiedliche Parität; Room-Projektpanels No-op |
| Stationstypen wiederverwenden | nicht | Vorlage nur generische Station/Projektkopie |
| Desktop/Mobile vorprüfen | nicht | kein Editor-Viewport-/Reduced-Motion-Modus |
| Kameraansichten definieren | voll | Capture und Zahlenfelder vorhanden |
| Text mit Detail verknüpfen | teilweise | Annotation nur Modelllaufzeit, keine Objekt-ID |
| mehrere Modelle anordnen | voll im Room | Modell-Stories auf Primär/Rekonstruktion beschränkt |
| Licht ohne Three.js-Fachwissen | teilweise | rohe Regler, kaum Presets/Diagnostik |
| Evidenz/Rekonstruktion kennzeichnen | nur Custom Code | Modellrollen, aber keine Fachsemantik |
| A11y-Beschreibungen/Transkripte | nicht | kein Schema/Editorfeld |
| Modell sicher ersetzen | teilweise | Room nur löschen/neu hinzufügen; Verknüpfungen nicht validiert |
| vor Publikation validieren | teilweise (Prototyp) | beratender lokaler Check; Publishing selbst prüft nur Rechte |

## 6. Relevante Techniken, nur an belegte Lücken gebunden

| Technik | Bedarf / Kulturerbe-Beispiel | Nutzen | Komplexität, A11y, Performance | Platzierung |
|---|---|---|---|---|
| benannte View States | Detail→Kontext, Vorder/Rückseite | Kamera/FOV/Objekt/State/Fallback einmalig speichern | mittel; billig zur Laufzeit; Reduced Motion muss springen | **Core P1** |
| Guided Step/State Controller | Überblick→Detail→frei | einheitliche Progression, Return, Analytics | mittel-hoch im Datenmodell; geringe Renderkosten | **Core P1** |
| gehärtete Annotation + DOM-Liste | Starhemberg-Details | präzise Verknüpfung plus Tastaturpfad | mittel; Raycasting bleibt, DOM ist Alternative | **Core P0/P1** |
| Auswahlhighlight/Isolation | Multiobjekt-Room | klares aktives Objekt | niedrig-mittel; OutlinePass optional teuer; nie Farbe allein | Core-State, Renderer optional |
| Clipping/Schnitt | Innenräume, Schichten | verdeckte Evidenz zeigen | hoch; Capping/Shadow/Fallback nötig | **Modul P2** |
| semantische Varianten | Befund/Rekonstruktion/Hypothese | fachlich benannte Zustände | mittel-hoch; Speicher steigt, Textstatus Pflicht | Schema Core, Adapter optional |
| redaktionell kontrollierte Clips/Morphs | Mechanismus, Schaden/Restaurierung | Bewegung wird Aussage statt Loop | mittel; Pause/Replay/Standbild/Reduced Motion | **Modul P2/P3** |
| Vergleich/Split View | Original/Reko, verwandte Objekte | Unterschiede ohne Gedächtnislast | mittel-hoch; bis etwa doppelte Draw-Arbeit; mobil A/B | **Modul P2** |
| LOD/progressive Assets | große externe Sites | schneller bedeutungsvoller Zustand | hohe Assetkosten; `THREE.LOD` streamt nicht automatisch | **Infra P3 nach Messung** |
| kurze Kamerapfade | reale Weg-/Blickachsenstory | Bewegung als räumliches Argument | hoch in Autorierung/A11y; überspringbar | story-spezifisch |

Primärquellen: [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [PerspectiveCamera](https://threejs.org/docs/pages/PerspectiveCamera.html), [Raycaster](https://threejs.org/docs/pages/Raycaster.html), [WebGLRenderer/Clipping/Viewport](https://threejs.org/docs/pages/WebGLRenderer.html), [Material clipping](https://threejs.org/docs/pages/Material.html), [glTF variants](https://threejs.org/examples/webgl_loader_gltf_variants.html), [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html), [AnimationAction](https://threejs.org/docs/pages/AnimationAction.html), [LOD](https://threejs.org/docs/pages/LOD.html), [WCAG Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard), [WCAG Non-text Content](https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html), [Reduced Motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).

Bewusst nicht für Core empfohlen: WebXR, Messwerkzeug, räumliches Audio, Exploded View, X-Ray/Transparenz, freie Kamerapfadautorierung und Minimap. Für aktuelle Storys fehlt entweder der belegte Besucherauftrag oder zuverlässiger Maßstab/Accessibility-/Performance-Nachweis.

## 7. RIU Story Grammar

Jeder Block referenziert serialisierbare `viewId`, `sceneStateId`, `media`, `controls`, `accessibilityFallback`, `next/branches` und `returnTarget`; die Grammatik ist Vokabular, kein starres Template.

| Block | Zweck und Inhalt | 3D/Kamera | Medien und Controls | Editor, Mobil, A11y | Geeignet / ungeeignet |
|---|---|---|---|---|---|
| **Introduction** | Thema, Ort/Zeit, Leitfrage | ruhiger Gesamtzustand, gespeicherter Einstieg | Kurztext, Poster, optional manuelles Audio; Story starten | Kamera/Poster/Fallback; mobil kurz; vollständige 2D-Einordnung | jede Story / kein Spektakelvorspann |
| **Overview** | Struktur und Orientierung | vollständiges Objekt/Ensemble, markierte Ziele | Legende/Plan; Weiter oder Bereich wählen | Übersicht erfassen; touchgroße Ziele; textuelle Lagebeschreibung | komplexe Objekte/Sites / kein Detailersatz |
| **Focus detail** | Spur/Form/Herstellung erklären | Highlight, gespeicherte Nahansicht, adaptives Clipping | Annotation, Makrobild, Quelle; vor/zurück/zum Kontext | Punkt+Kamera+Quelle; Popover verdeckt Ziel nicht; Fokusführung | Schäden/Ikonografie / keine vagen Hotspots |
| **Compare** | Unterschiede prüfbar machen | A/B, Toggle oder Split bei gleichem Maßstab | Vergleichsfrage und Labels | Paare/Ansichten koppeln; mobil Toggle; Unterschiede als Text | Vorder/Rückseite, Original/Reko / keine falschen Maßstäbe |
| **Reveal/Reconstruct** | Befund und Ergänzung trennen | stabiler Blick, semantische Zustände | Erhalten/Rekonstruiert/Alternative + Quellen | Evidenzstatus/Default/Transition; mobil Buttons; Status angekündigt | Heidentor / kein unbeschrifteter Effekt |
| **Place in context** | Objekt ↔ Fundort/Plan/Schicht | Wechsel Objekt-/Kontextmaßstab, Anker bleibt sichtbar | Karte, Schnitt, Grabungsfoto, Metadaten | Medien kalibrieren; mobil 2D-Vergrößerung; Raumrelation in Text | Archäologie / keine unmarkierte Spekulation |
| **Chronological change** | Phasen und Ursachen | diskrete Scene States | Timeline, historische Bilder, Quellen | Phasen/Unsicherheit; mobil Schritte; Liste aller Änderungen | Bau/Restaurierung / keine bedeutungslose Daueranimation |
| **Spatial movement** | Weg/Blickachse/Nutzung | Wegpunkte oder kurzer Pfad | Richtung/Miniplan; weiter/zurück/skip | Wegpunkte und Kollisionscheck; Reduced Motion springt | Räume/Sites / kein erzwungener Rundgang |
| **Evidence vs interpretation** | Befund/Hypothese/Dissens sichtbar | zurückhaltende konsistente Kodierung | Quelle, Begründung, Alternativen, Legende | kontrolliertes Vokabular; Farbe nie allein; Status maschinenlesbar | jede Rekonstruktion / keine dekorative Farblogik |
| **Summary** | Leitfrage beantworten | vertraute Gesamtansicht | Kernaussagen, Quellen, verwandte Storys | Abschlussansicht/Links; mobil kurze Karten; Textzusammenfassung | geführte Story / kein bloßer Abspann |
| **Free exploration** | selbstständig vertiefen | begrenztes Orbit/Zoom aus authored view | Hilfe, Annotationen, Reset/Verlassen | Grenzen/Start/Orbit-Ziel; Touchhinweise; 2D-Alternative | optionaler Abschluss / nie einzige Informationsquelle |

## 8. Priorisierte Roadmap

### P0

1. Nicht-3D-Fallback mit Poster, Kerntext, Metadaten, Retry und Fortsetzen ohne WebGL/externes Modell.
2. Keyboard-/Fokusparität für Stationen, Annotationen, Medien und alle semantischen Zustände; der Annotation-Prototyp ist nur der erste gehärtete Pfad.
3. Sichere Orientierung: globales „Zur Übersicht“, authored reset und eindeutige Trennung geführt/frei.
4. Room-Editor-Integrität: sichtbare No-op-Projektpanels entweder korrekt verdrahten oder eindeutig deaktivieren; Speichern muss alle sichtbaren Einstellungen umfassen.

### P1

1. Versioniertes `view`-/`sceneState`-/Storyblock-Modell mit stabilen IDs und Migration.
2. Accessibility-Metadaten: 3D-/Bildbeschreibung, Transkript, Captions, Sprache, Reduced-Motion-Alternative.
3. Quellen-, Rechte-, Inventar- und Provenienzmodell; Evidenz/Rekonstruktion/Hypothese/Alternative.
4. Story-Check zur echten Publikations-Preflight erweitern: URL/CORS/Load, leere Inhalte, Kameraframing, Rechte, A11y, Mobile, Keyboard, Reduced Motion, verwaiste Verknüpfungen.
5. Desktop-/Mobile-/Reduced-Motion-Preview im Editor.
6. Sichere Modellersetzung mit stabiler Objekt-ID und Warnung/Remapping für Viewpoints/Annotationen.

### P2

- Detailsequenzen mit Rückkehrziel; semantischer A/B-Vergleich; chronologische Zustände; einfache Verzweigung; Plan/Karte/Schnitt↔3D; interpretative Lichtpresets.

### P3

- Clipping-/Schnittmodul, kuratierte Exploded Views, Messung bei verlässlichem Modellmaßstab, Minimap erst für große begehbare Sites, LOD nach realer Messung, Raumtyp nach Besuchertest.

### P4

- WebXR, komplexes räumliches Audio, X-Ray, freie First-Person-Navigation, Wetter/Spektakel, Bloom, generischer Portal-/Reveal-Shader, automatisch generierte Kamerafahrten.

## 9. Kleine Validierungsprototypen

### Prototyp A: Starhemberg-Annotation – Fokus und Rückkehr

- **Realer Bedarf:** 24 Details in der freien Station. Vorher war „Schließen“ fehlerhaft beschriftet, Escape schloss nicht zuverlässig, Dialogbeziehungen waren schwach und der Fokus konnte nach Kamerabewegung auf `body` fallen.
- **Änderung:** korrektes Label; `aria-labelledby`/`aria-describedby`; Fokus auf Schließen; Escape; Rückgabe an den ursprünglichen Marker oder – wenn dieser durch Kamerafokus nicht mehr projiziert wird – an die stabile Annotationsliste; sinnvolle Bildalternativen.
- **Aufgabe vorher:** Detail öffnen, schließen und mit Tastatur sinnvoll fortsetzen – nicht zuverlässig lösbar.
- **Aufgabe nachher:** „Burgtor“ öffnen → Dialog benannt → Escape → Fokus bleibt im Annotationsfluss.
- **Validierung:** echter Browser erfolgreich; automatisierter Desktop-/Mobile-Fall plus Screenshot und Fokuszustand; keine Änderung an Text, Kamera oder Storyinhalt.
- **Core-Entscheid:** Ja. Dies ist ein grundlegender Annotation-Dialogvertrag.

### Prototyp B: beratender Story-Check

- **Realer Bedarf:** Publishing prüft bisher im Wesentlichen Berechtigung, nicht Storyreife. Heidentor enthält nachweisbar Platzhalterannotation und Video ohne Transkript.
- **Änderung:** wiederverwendbarer, nicht blockierender Check im Editor für Titel/Beschreibung, Stationen, Kameras, Raumobjekte, Modellquelle, Objektbeschreibung, Attribution/Lizenz, Video-Transkript und Platzhalterannotation.
- **Aufgabe vorher:** Redakteur:innen mussten Lücken aus vielen Panels erraten.
- **Aufgabe nachher:** ein zusammenhängender Bericht nennt Ort, Schwere und Problem; fachliche Prüfung bleibt ausdrücklich menschlich.
- **Validierung:** zwei Unit-Szenarien (Heidentor-artige Medienlücken, defekte Raumstation), Browserdarstellung Desktop/Mobile, vollständiger Build.
- **Core-Entscheid:** Muster gehört in den Core; zunächst beratend. Blockierendes Publishing und Netztests erst nach redaktioneller Festlegung.

### Nachfolgende P0/P1-Validierung

Die nächsten kleinsten Prototypen wurden anschließend umgesetzt und gemeinsam gegen 58 feste Desktop-/Mobile-Browserzustände geprüft:

1. **Heidentor:** „Erhaltener Befund“ und „Rekonstruktion“ schalten getrennte, beschriftete Three.js-Zustände; „Warum so rekonstruiert?“ nennt die noch fehlende fachliche Begründung; Reveal bleibt sichtbar experimentell. Die Prüfung kontrolliert Modell-Sichtbarkeit und Opazität, nicht nur den UI-State.
2. **Ladefehler:** Ein absichtlich blockierter Starhemberg-Modellrequest zeigt Cover, Kernaussage, Rechtehinweis, technische Details, Retry und Rückkehr zur Übersicht. Der Fokus landet im Fehlerinhalt; die nicht nutzbare 3D-Oberfläche ist abgeschirmt.
3. **Starhemberg:** Der Annotationsdialog bietet eine explizite Rückkehr zur authored Stationsansicht. Die Kameradauer ist entfernungsabhängig; Reduced Motion wechselt unmittelbar.
4. **Raum-Editor:** Unwirksame globale Modellstory-Panels sind deaktiviert und erklären, dass Raum-Modelle, Licht, Kamera und Audio an Stationen bzw. Objekten bearbeitet werden. Die bestehenden speicherbaren Raumregler bleiben unverändert.

Der vollständige lokale Prüflauf lässt sich mit `npm run visual:capture -- --label story-system-next-validation` reproduzieren. Die erzeugten Artefakte werden bewusst nicht versioniert. Quellenangaben für die Heidentor-Rekonstruktion und eine fachlich kuratierte Starhemberg-Detailsequenz bleiben redaktionelle Aufgaben. Das additive v2-Schema und die Migrationsgrenzen sind in `docs/RIU_STORY_SCHEMA_PROPOSAL.md` beschrieben.

## 10. Redaktionelle und wissenschaftliche Entscheidungen

1. Welches kontrollierte Vokabular trennt Befund, Ergänzung, Rekonstruktion, Hypothese und künstlerische Illustration?
2. Wer vergibt und prüft Unsicherheitsgrade? Muss jede Rekonstruktion eine Quelle besitzen?
3. Welche Objektmetadaten sind RIU-Pflicht: Institution, Inventarnummer, Material, Datierung, Provenienz, Lizenz, Modellhersteller?
4. Wie werden gleichrangige oder gewichtete wissenschaftliche Alternativen gezeigt?
5. Welche Kernaussage muss jede Story vollständig ohne 3D vermitteln?
6. Welche Zielgruppen, Sprachen, Lesestufen und Textlängen werden unterstützt?
7. Ist Rekonstruktion ein eigenes digitales Objekt mit eigener Provenienz und Rechten?
8. Welche Mindestqualität, reale Skalentreue und Langzeitverfügbarkeit gelten für externe Modelle?
9. Wann ist Publikation zulässig: technisch vollständig, barrierefrei geprüft und/oder fachlich freigegeben?
10. Welche Analytics sind fachlich nötig und datenschutzrechtlich vertretbar?

## 11. Vorerst experimentell halten

- Portal-/Reveal-Shader als frei parametrierter Effekt; erst semantische Zustände validieren.
- Raum-Museum als allgemeines Storymuster; aktuell nur für Objektgruppen belegt.
- Sketchfab als gleichwertiger Kernpfad wegen Drittanbietersteuerung, Datenschutz und A11y.
- First-Person, WebXR, X-Ray, komplexe Schnitt-/Explosionswerkzeuge, Messung und Spatial Audio ohne konkreten Besucherauftrag.
- Wetter, Gewitter, Sternenhimmel, Bloom, Textanimation und dramatische Lichtwechsel ohne Informationsfunktion.
- Zufälliges Startobjekt, solange authored initial composition ein RIU-Grundsatz ist.

## Schlussfolgerung

RIUs stärkste vorhandene Erzählmittel sind nicht die spektakulären Shader, sondern gespeicherte Blickpunkte, lineare räumliche Führung, präzise Annotationen und der explizite Wechsel von kuratierter Ansicht zu freier Erkundung mit Reset. Der wichtigste nächste Schritt ist ein gemeinsamer semantischer Kern aus View, Scene State, Evidenz, Quelle und Accessibility-Fallback. Reveal, Raum, Animation und weitere Three.js-Techniken sollten darauf aufsetzen – nicht ihn ersetzen.
