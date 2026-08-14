# RIU – Analyse und Architektur

## Ausgangsanalyse

### Technologie-Stack

Beide Ausgangsprojekte verwenden dieselbe clientseitige Basis:

- Vite 8 und ES-Module
- React 19 für Viewer- und Editor-UI
- Three.js 0.170 für glTF/GLB, Rendering, Picking und Kameras
- GSAP für Kamera- und Portalübergänge
- Tailwind-Utilities plus umfangreiches projektspezifisches CSS
- `localStorage` und IndexedDB für Projekt- beziehungsweise lokale Modellpersistenz

Ein Server-Backend oder Router war nicht vorhanden. Die Anwendung bestand aus einer Three.js-Laufzeit in `main.js`, einer React-Oberfläche und einer festen aktiven Projektdatei.

### Entwicklungsbeziehung

Heidentor ist das ältere Ursprungsprojekt. Starhemberg wurde als eigener Fork auf derselben Architektur begonnen und anschließend deutlich weiterentwickelt. Seine Git-Historie enthält zusätzliche Arbeiten an:

- frei navigierbarer Kamera und unabhängigem Orbit-Ziel,
- expliziten Stations- und Annotationskameras,
- stabilen Annotation-Identitäten,
- sortierbaren Stationen und Annotationen,
- Projektbeleuchtung und Projekt-Nullpunkt,
- mehreren lokalen Projekten, Import/Export und Speicherstatus,
- einer klarer getrennten Editor-Arbeitsfläche.

Starhemberg ist daher die technische Basis. Der separate Heidentor-Viewer wird nicht in RIU eingebettet oder weitergeführt.

### Daten und Kompatibilität

Das ältere Heidentor-JSON enthält `alignment` und vier `stations`. Beleuchtung und Annotationen befinden sich teilweise noch direkt an Stationen. Das aktuelle Projektformat ergänzt ein `project`-Objekt, globale `annotations`, Revisionen, Branding, Modellreferenzen und Einstellungen.

`normalizeStationConfig`, `normalizeStations`, `collectProjectAnnotations` und `normalizeProjectLighting` bilden die Kompatibilitätsschicht:

- fehlende Felder erhalten definierte Defaults,
- alte Stationskameras werden als explizite Kameras erkannt,
- alte Stationsannotation werden in die gemeinsame Annotationsliste übernommen,
- alte Beleuchtungswerte können in Projekteinstellungen überführt werden,
- Alignment-Matrizen werden validiert,
- das Speicherformat entfernt anschließend alte doppelte Stationsfelder.

`tests/heidentorCompatibility.test.mjs` reproduziert diesen Ablauf direkt mit der vorhandenen Heidentor-Datei. Es ist keine manuelle Neuerfassung nötig.

## Zielarchitektur

```text
Öffentliche Galerie / Konto / Dashboard
                  │
                  ▼
        platformStore (Repository-API)
                  │
      IndexedDB: Konto + vollständige Story
                  │
          ┌───────┴────────┐
          ▼                ▼
   gemeinsamer Viewer   gemeinsamer Editor
          │                │
          └───────┬────────┘
                  ▼
       normalisierte Stationen
                  │
                  ▼
    Three.js-Kamera / Modell / Annotation
                  │
                  ▼
       externe GLB-/glTF-URL
```

### Routing

- `/` – öffentliche Galerie
- `/login`, `/register` – Kontoabläufe
- `/dashboard` – eigene Stories
- `/account` – Name und Kontodaten verwalten
- `/stories/new` – Story anlegen
- `/stories/:id-oder-slug` – gemeinsame öffentliche Viewer-Laufzeit
- `/studio/:id` – gemeinsame Editor-Laufzeit mit Eigentümerprüfung

Die schlanke Routenerkennung benötigt für den Prototyp keine zusätzliche Router-Abhängigkeit. Navigation lädt eine Route vollständig neu; dadurch kann die große Three.js-Laufzeit auf Plattformseiten inaktiv bleiben.

### Story-Modell

Eine Story besitzt Metadaten (`id`, `slug`, `ownerId`, Autor, Status, Zeitstempel, Cover), Branding, externe Modellreferenzen, Einstellungen, Alignment, globale Annotationen und eine geordnete Stationsliste. Der Status ist `draft` oder `published`. Nur veröffentlichte Stories erscheinen in der Galerie.

`/studio/:id` wird nur gerendert, wenn die aktive Session dem `ownerId` entspricht. Der Editor erhält ausschließlich die aktive eigene Story in seiner Projektauswahl. Für Produktion muss dieselbe Regel zusätzlich serverseitig durchgesetzt werden.

### Modellstrategie

Alle Storys – einschließlich der Demos – verwenden Modell-URLs aus dem Story-Datensatz. Starhemberg und Heidentor werden über ihre Vercel-Deployments geladen, deren Modellantworten CORS (`Access-Control-Allow-Origin: *`) erlauben. Heidentor verwendet weiterhin Ruine plus Rekonstruktion und damit auch Reveal-/Portal-Modi; gewöhnliche Nutzerstorys können nur ein Hauptmodell verwenden.

Die Laufzeit lädt die Modellkonfiguration erst nach der Story-Auswahl. Dadurch gibt es keine projektspezifische Viewer-Implementierung mehr.

## Verifikation

Automatisiert:

- Annotationskamera und Annotation-Identität
- freie Navigation und Projekt-Orbit-Ziel
- Heidentor-Normalisierung und bereinigtes Speicherformat
- Quellcode-Hygieneprüfung
- Vite-Produktionsbuild

Manuell im Browser geprüft:

- Desktop-Galerie und mobiler Breakpoint 390 × 844 ohne horizontalen Überlauf
- Starhemberg und Heidentor über dieselbe Viewer-Route
- Heidentor-Remoteassets bis 100 % ohne Ladefehler
- Registrierung, Anmeldung und Abmeldung
- Story mit externer glTF-URL anlegen
- Editor öffnen, Station ergänzen und ändern, Kamera übernehmen
- Projektannotation anlegen und bearbeiten
- Vorschau öffnen und veröffentlichen
- veröffentlichte Nutzerstory als zusätzliche Galerie-Story
- direkter Studiozugriff nach Abmeldung wird zur Anmeldung umgeleitet
- verständliche Fehleranzeige für nicht erreichbares externes Modell

## Bewusste Grenzen

Die browserlokale IndexedDB-Persistenz macht den Prototyp ohne Infrastruktur unmittelbar funktionsfähig und hält die Datenzugriffsschicht klein. Vollständige Story-Datensätze liegen in `riu_platform`; externe Modelle bleiben reine URL-Referenzen. Sie bietet jedoch keine echte Mehrgerätefähigkeit oder manipulationssichere Autorisierung. Der nächste Architekturschritt wäre ein API-Adapter mit serverseitigem Benutzer-/Story-Repository; Viewer, Normalisierung und Editor können dabei unverändert bleiben.
