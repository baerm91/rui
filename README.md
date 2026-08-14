# RIU

RIU ist ein funktionsfähiger Browser-Prototyp für veröffentlichbare, interaktive Stories zu extern gehosteten 3D-Modellen. Eine Story besteht aus einer geordneten Liste räumlicher Stationen mit Kamera, Text, Medien und Annotationen.

Die Anwendung führt Galerie, Nutzerbereich, gemeinsamen Three.js-Viewer und Story-Editor in einer Vite-/React-Anwendung zusammen. Burg Starhemberg und das Heidentor sind als veröffentlichte Demo-Storys enthalten; ihre Modelle werden über die bestehenden Vercel-Bereitstellungen geladen.

## Start

Voraussetzungen: Node.js 20 oder neuer und ein WebGL-fähiger Browser.

```bash
npm install
npm run dev
```

Die Entwicklungsanwendung läuft unter `http://localhost:3005`. Der Port ist absichtlich fest, weil die Prototypdaten an den Browser-Origin gebunden sind.

Qualitätsprüfung:

```bash
npm run lint
npm test
npm run build
npm run preview
```

## Kernablauf

1. In der Galerie eine Demo-Story öffnen.
2. Mit Google anmelden und im persönlichen Bereich „Neue Story“ wählen.
3. Titel, Beschreibung und eine öffentliche HTTPS-URL zu `.glb` oder `.gltf` angeben.
4. Im Studio Stationen, Kameras, Texte, Medien und Projekt-Annotationen bearbeiten.
5. Die Scroll-Vorschau prüfen und die Story veröffentlichen.
6. Die veröffentlichte Story erscheint unmittelbar in der Galerie.

Der Modellserver muss CORS für den Browser-Origin erlauben. Eine `.gltf`-Datei muss alle relativen `.bin`- und Texturpfade öffentlich ausliefern. Ladeprobleme werden im Editor mit URL-, CORS- und Pfadhinweisen angezeigt.

## Persistenz und Konten

Konten und vollständige Story-Datensätze liegen zentral in Supabase. Supabase Auth übernimmt die Anmeldung per Google OAuth, PostgreSQL speichert Story-Metadaten, Eigentümer, externe Modell-URLs, Alignment, Einstellungen, Stationen, Kameras und Annotationen. Row Level Security beschränkt Entwürfe und Schreibzugriffe auf Eigentümer und berechtigte Mitwirkende. IndexedDB bleibt als lokaler Cache sowie für noch nicht synchronisierte Editor- und Preview-Daten bestehen.

Beim ersten OAuth-Login werden vorhandene lokale RIU-Daten einmalig übernommen. Dazu gehört ausdrücklich der bisher unter Carnuntum geführte Heidentor-Bestand; Starhemberg wird im selben Schritt zugeordnet. Eine Importmarke verhindert doppelte Übernahmen. Die glTF-Dateien werden nicht in der Datenbank gespeichert oder kopiert, sondern weiterhin direkt von den bestehenden Vercel-Websites geladen. RIU speichert keine Passwörter.

Für lokale Entwicklung werden `VITE_PUBLIC_SUPABASE_URL` und `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` benötigt; die Namen stehen in `.env.example`. In Vercel werden diese Werte durch die Supabase-Integration bereitgestellt. Es dürfen ausschließlich die öffentlichen Browser-Schlüssel in `VITE_PUBLIC_*` stehen.

## Projektstruktur

- `src/platform/` – Galerie, OAuth, Supabase-Synchronisierung, persönlicher Bereich und Routing
- `src/components/` – gemeinsame Viewer- und Editor-Oberflächen
- `src/three/` – Kamera, Rendering, Portal-/Reveal-Übergänge, Annotationen und lokale Modelle
- `src/stations.js` – Normalisierung alter und aktueller Story-Daten
- `src/projects/` – Story-Projektzustand, Metadaten und IndexedDB-Modellablage
- `tests/` – Kamera-, Annotation-, Navigations- und Heidentor-Kompatibilitätstests
- `docs/RIU_ARCHITECTURE.md` – Analyse, Architekturentscheidungen und Einschränkungen

## Demo-Quellen

- Starhemberg-Modell: `https://starhemberg.vercel.app/model/scene.gltf`
- Heidentor-Ruine: `https://heidentor.vercel.app/the_heidentor_in_petronell-carnuntum/scene.gltf`
- Heidentor-Rekonstruktion: `https://heidentor.vercel.app/reconstruction_of_the_heidentor/scene.gltf`

Die normalisierten Story-Inhalte sind im Repository enthalten, damit die Kompatibilität reproduzierbar getestet werden kann. Die Modelle werden nicht dupliziert.

## Bekannte Einschränkungen

- Lokal hochgeladene Modelle, Medien und erzeugte Preview-Videos bleiben browsergebunden; Story-Konfigurationen werden geräteübergreifend synchronisiert.
- Externe Modelle bleiben von Erreichbarkeit, Bandbreite und CORS-Konfiguration des fremden Hosts abhängig.
- Eine im Editor geänderte Modell-URL wird nach einem Neuladen der Studio-Route aktiv.
- Große glTF-Dateien mit separaten Texturen können länger laden als kompakte, optimierte GLB-Dateien.
- Es gibt absichtlich kein Modellhosting, keine Kollaboration, Kommentare, Likes oder Bezahlfunktionen.
