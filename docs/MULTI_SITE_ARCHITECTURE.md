# Wiederverwendbare Struktur für 3D-Websites

## Aktives Projekt ohne festen Dateinamen

Die Startseite liest ihr aktives Projekt aus dem Ordner `project/`. Dort darf
genau eine beliebig benannte JSON-Exportdatei liegen. Der Entwicklungsserver
liefert sie unter dem stabilen Pfad `/active-project.json` aus; beim
Produktions-Build wird sie unter demselben Namen nach `dist/` geschrieben.
Damit hängt die Startseite nicht vom Projekt- oder Exportdateinamen ab.

Die Rendering- und Editor-Logik bleibt gemeinsam. Inhalte, Branding und Assets werden pro Projekt konfiguriert. Der erste Schritt dafür ist `src/site.config.js`: Dort liegen jetzt Projektname, Stationsdatei, Speicher-Namensraum und Modellpfade.

Im Editor liegt darüber inzwischen eine Laufzeit-Projektverwaltung. Sie speichert mehrere Projekte unter `three_story_projects_v1` im Browser. Jedes Projekt enthält eigene Stationen, Ausrichtung, Branding und Modellreferenzen. `site.config.js` beschreibt nur noch das mitgelieferte Startprojekt; weitere Projekte werden im Editor angelegt und als `.project.json` exportiert.

## Empfohlene Zielstruktur

```text
src/
  core/                 # generische React- und Three.js-Laufzeit
    editor/
    three/
    stations/
  sites/
    heidentor/
      site.config.js
      stations.json
      theme.css
    neues-projekt/
      site.config.js
      stations.json
      theme.css
public/
  sites/
    heidentor/
      models/
      images/
      videos/
    neues-projekt/
      models/
      images/
      videos/
```

## Ausbau in zwei Stufen

1. **Jetzt:** `src/site.config.js` austauschen und die darin referenzierten Assets/Stationsdaten bereitstellen. Das vermeidet weitere Heidentor-Pfade in der Laufzeit.
2. **Bei mehreren aktiven Sites:** Die Konfigurationen nach `src/sites/<site-id>/` verschieben und die aktive Site über eine Vite-Umgebungsvariable wählen, zum Beispiel `VITE_SITE_ID=heidentor`. Die gemeinsame Anwendung importiert dann nur noch eine aufgelöste Site-Konfiguration.

Stationsinhalte gehören nicht in React-Komponenten. Große GLTF/GLB-Dateien, Texturen, Bilder und Videos gehören unter `public/sites/<site-id>/`. Gemeinsame Editor-Komponenten und Three.js-Helfer bleiben in `src/core/` und dürfen keine Projektnamen oder projektspezifischen Pfade enthalten.
