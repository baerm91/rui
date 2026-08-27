# RIU Story Schema v2 — Vorschlag

Stand: 27. August 2026

## Ziel und Grenze

Das Schema übersetzt die im Audit bestätigten Bedürfnisse in eine kleine, wiederverwendbare Story-Grammatik. Es ersetzt die bestehenden Story-JSONs nicht sofort. Version 1 bleibt lesbar; eine Normalisierungsschicht leitet daraus v2-Bausteine ab. Erst neu angelegte oder bewusst migrierte Inhalte schreiben v2.

Die vier Validierungsprototypen begründen die erste Ausbaustufe:

- Starhemberg: Ein Detail braucht ein explizites Rückkehrziel zur kuratierten Stationsansicht.
- Heidentor: Befund, Rekonstruktion und experimenteller Reveal brauchen getrennte, benannte Bedeutungen.
- Modellfehler: Eine Story braucht auch ohne 3D verständlichen Inhalt, Rechte und konkrete Wiederherstellung.
- Raum-Editor: Nur tatsächlich wirksame Einstellungen dürfen als editierbar erscheinen.

## Stabiler Kern

```json
{
  "schemaVersion": 2,
  "id": "story-id",
  "metadata": {
    "title": "Titel",
    "summary": "Kurzbeschreibung",
    "rights": [],
    "sources": [],
    "language": "de"
  },
  "assets": [],
  "views": [],
  "sceneStates": [],
  "blocks": [],
  "accessibility": {},
  "presentation": {}
}
```

Alle referenzierten Einträge erhalten stabile IDs. URLs, Modellrollen oder Arraypositionen dürfen nicht als Identität dienen. Redaktionelle Bedeutung und Three.js-Implementierung bleiben getrennt: Ein Block sagt, was vermittelt wird; `viewId` und `sceneStateId` beschreiben die dafür nötige Darstellung.

### `assets`

Ein Asset beschreibt Quelle und Verantwortung, nicht seine Platzierung.

- `id`, `type`: `model`, `image`, `audio`, `video`, `document`
- `url` oder lokaler Asset-Verweis
- `title`, `description`, `creator`, `rights`, `license`, `sourceUrl`
- `accessibility`: Alternativtext, Transkript, Untertitel oder textuelle 3D-Alternative
- Modelle optional mit `role`, Maßeinheit und Transformationshinweis

### `views`

Ein benannter Blickpunkt ist unabhängig von einer Station wiederverwendbar.

- `id`, `label`, `camera.position`, `camera.target`, `camera.fov`
- optionale, assetbezogene Sichtbarkeit und Auswahl
- `returnViewId` für Detail → Kontext
- adaptive Near-/Far-Werte werden aus sichtbaren Bounding Boxes berechnet, nicht redaktionell verlangt
- `transition`: Dauer und Easing; bei Reduced Motion wird ohne Flug gewechselt

### `sceneStates`

Ein Zustand beschreibt die fachliche Aussage sichtbarer Assets.

- `id`, `label`, `interpretationStatus`: `evidence`, `reconstruction`, `hypothesis`, `comparison`, `decorative`
- sichtbare Assets und Varianten
- optionale Licht-/Materialzustände, sofern sie Bedeutung tragen
- `explanation`, `sources`, `uncertainty`
- experimentelle Zustände werden mit `maturity: "experimental"` gekennzeichnet und ersetzen keinen beschrifteten Kernzustand

### `blocks`

Der erste Kernumfang folgt der validierten RIU-Grammatik:

| Typ | Zweck | Mindestinhalt | 3D-Verhalten |
|---|---|---|---|
| `introduction` | Thema und Orientierung | Titel, Kurztext | kuratierte Startansicht |
| `overview` | räumlicher Zusammenhang | Text, `viewId` | alle relevanten Elemente lesbar |
| `focus` | Detail erklären | Text, Ziel/Annotation, `viewId`, `returnViewId` | Fokus und sichere Rückkehr |
| `compare` | Zustände/Objekte unterscheiden | mindestens zwei beschriftete `sceneStateIds` | expliziter A/B-Wechsel |
| `context` | Objekt, Fundort oder Schicht verbinden | Text, Beziehungen, `viewId` | Kontext bleibt auffindbar |
| `sequence` | zeitliche oder räumliche Folge | geordnete Block-IDs | Vor/Zurück und Fortschritt |
| `summary` | Kernaussage sichern | Kurztext | Rückkehr zur Übersicht möglich |
| `explore` | selbstständige Prüfung | Grenzen, Reset-Ziel | freie Steuerung, zuverlässiger Reset |

`reveal`, `reconstruct` und `spatialMovement` bleiben optionale Module, bis mindestens zwei fachlich belastbare Anwendungen getestet sind.

## Besucher- und Editorvertrag

Jeder Block definiert:

- eine verständliche Beschriftung und ein sichtbares aktives Ziel,
- Desktop-, Touch- und Tastatursteuerung,
- Reduced-Motion-Verhalten,
- Lade-, Fehler- und Nicht-3D-Alternative,
- ein eindeutiges Rückkehr- oder Folgeziel.

Der Editor zeigt nur Felder, die für den aktiven Storytyp gespeichert und wieder geöffnet werden. Expertenparameter werden hinter verständlichen Presets angeboten; Rohwerte bleiben optional. Vor Veröffentlichung prüft ein Preflight mindestens fehlende Quellen/Rechte, leere Platzhaltertexte, unerreichbare Views, fehlende Rückkehrziele, Transkripte, Alternativtexte und nicht ladbare Assets.

## Rückwärtskompatible Zuordnung

| Aktueller Inhalt | v2-Ableitung |
|---|---|
| Station mit `cameraPos`, `lookAt`, `fov` | `view` plus narrativer Block |
| Annotation mit Fokus-Kamera | `focus` mit erzeugtem `returnViewId` |
| `viewMode: ruin/recon` | beschrifteter `sceneState` |
| Heidentor `reveal` | optionaler experimenteller Vergleichszustand |
| `freeNavigation` | `explore` mit Reset auf Stations-`viewId` |
| Raumstation und `items` | `overview`/`context`, Assets mit stabilen Objekt-IDs |
| Projekt-/Raumlicht | `presentation`-Preset; nur wirksame Controls editierbar |
| Titel, Beschreibung, Cover | Metadaten und Nicht-3D-Fallback |

Beim Laden ergänzt die Normalisierung fehlende IDs deterministisch und erzeugt abgeleitete Views im Speicher. Beim Speichern einer unveränderten v1-Story wird kein v2-Format erzwungen. Eine Migration wird als explizite Kopie mit Vorschau, Validierungsbericht und Rückgängig-Möglichkeit angeboten.

## Einführung

1. **P0:** Fehlerfallback, robuste Fokus-/Rückkehrpfade und ehrliche Editorzustände abschließen.
2. **P1a:** `views`, `sceneStates`, stabile Asset-IDs und Preflight als additive Schemas einführen.
3. **P1b:** `introduction`, `overview`, `focus`, `compare`, `summary`, `explore` im bestehenden Editor komponierbar machen.
4. **P2:** Medienbezüge, Quellen, Unsicherheit, Transkripte und Vergleichsansichten ausbauen.
5. **P3/P4:** Reveal, Schnitt, Explosionsansicht, Zeitachsen und XR nur nach einem konkreten, getesteten Vermittlungsauftrag modular ergänzen.

## Noch redaktionell zu entscheiden

- Welche Befunde und Quellen tragen die Heidentor-Rekonstruktion?
- Welche Starhemberg-Details bilden eine kuratierte Kernsequenz; welche bleiben freie Vertiefung?
- Welche Terminologie unterscheidet Befund, Ergänzung, Rekonstruktion und Hypothese institutionsweit?
- Welche Rechte- und Quellenfelder sind vor Veröffentlichung zwingend?
- Welche fachliche Größenbeziehung muss bei Mehrmodell-Vergleichen erhalten bleiben?

Diese Entscheidungen gehören nicht in Three.js-Code. Das Schema schafft die Stellen, an denen Redaktion und Fachwissenschaft sie explizit und prüfbar treffen können.
