# RIU Designsystem

Diese Datei beschreibt das visuelle System der RIU-Plattform. Die technisch wirksamen Tokens stehen am Anfang von `src/platform/platform.css`. Änderungen an Farben, Radien, Schatten oder Seitenrändern sollten dort ausschließlich über die `--riu-*` Variablen erfolgen.

## Gestaltungsprinzip

RIU verwendet die ruhige, editoriale Bildsprache der Stitch-Referenz: große Medienflächen, viel Weißraum, Serifentitel und zurückhaltende Bedienelemente. Terrakotta markiert aktive Elemente und Handlungen. Flächen sind in Light Mode warm-elfenbeinfarben und in Dark Mode neutral-anthrazit.

## Zentrale Tokens

| Token | Aufgabe | Light | Dark |
| --- | --- | --- | --- |
| `--riu-bg` | Seitenhintergrund | `#faf9f4` | `#131413` |
| `--riu-panel` | normale Oberfläche | `#f5f4ef` | `#1b1c1b` |
| `--riu-panel-high` | hervorgehobene Oberfläche | `#e9e8e3` | `#272824` |
| `--riu-panel-low` | Karten und Formulare | `#ffffff` | `#171816` |
| `--riu-ink` | primäre Schrift | `#1b1c19` | `#faf9f5` |
| `--riu-muted` | sekundäre Schrift | `#5d5f5b` | `#c6c7c2` |
| `--riu-muted-soft` | Metadaten | `#87736b` | `#92938b` |
| `--riu-line` | Linien und Rahmen | Terrakotta 18 % | Lachs 16 % |
| `--riu-accent` | Links, aktive Zustände, CTA | `#823b18` | `#ffb596` |
| `--riu-accent-soft` | Hover und Verläufe | `#a0522d` | `#ffb596` |
| `--riu-on-accent` | Text auf Akzentflächen | `#ffffff` | `#361000` |

Weitere globale Tokens:

- `--riu-shadow` und `--riu-shadow-strong` für Karten und Dialoge
- `--riu-radius-sm`, `--riu-radius-md` und `--riu-radius-pill` für Radien
- `--riu-page-inline` für den responsiven Seitenrand
- `--riu-font-display` für Überschriften
- `--riu-font-body` für Navigation, Fließtext und Formulare

## Typografie

- Display und Überschriften: Cormorant Garamond
- Navigation, Labels und Fließtext: Inter
- Große Titel bleiben in normaler Serifenschreibweise; nur Labels und Metadaten werden in Versalien mit erhöhter Laufweite gesetzt.

### Lesbare Typografieskala

Die folgenden Größen sind Mindestwerte für Besucheransichten und werden über die `--riu-type-*` Tokens in `src/platform/platform.css` gesteuert. Editor-Hilfstexte dürfen kompakter sein, wenn sie keine inhaltlich relevante Information tragen.

| Einsatz | Token | Richtwert |
| --- | --- | --- |
| Große Stationstitel | `--riu-type-display-xl` | responsiv `48–68px` |
| Längerer Fließtext | `--riu-type-body` | responsiv `15–16px` |
| Kurze Begleittexte | `--riu-type-body-compact` | mindestens `14px` |
| Navigation und Labels | `--riu-type-label` | mindestens `11px` |
| Quellen und Metadaten | `--riu-type-meta` | mindestens `10px` |

- Längerer Fließtext verwendet `1.55–1.75` Zeilenhöhe und bleibt möglichst bei `45–70` Zeichen pro Zeile.
- Inhaltlich relevante Texte dürfen auf Desktop nicht unter `14px`, Metadaten nicht unter `10px` fallen. Kleinere Schrift ist nur für rein dekorative Nummern oder nicht notwendige Editor-Hinweise zulässig.
- Displaytitel und Fließtext sollen nicht unabhängig voneinander skaliert werden: Wird der Titel stark vergrößert, muss der Fließtext mindestens auf der regulären Lesestufe bleiben.
- Auf Bildern oder 3D-Szenen liegt Text auf einer ausreichend deckenden, ruhigen Fläche; Schriftgröße ersetzt keinen fehlenden Kontrast.

## Abstände und Layout

- Maximale Inhaltsbreite der Discover-Galerie: `1440px`
- Desktop-Seitenrand: `--riu-page-inline`
- Mobile-Seitenrand: `20–24px`
- Kartenraster: 4 Spalten Desktop, 2 Spalten Tablet, 1 Spalte Mobile
- Medien: bevorzugt `16:9`; der Discover-Hero kombiniert das Medium links mit einem kompakten Editorial-Text rechts und stapelt beides mobil
- Große Sektionen verwenden etwa `80–120px` vertikalen Abstand.

## Light und Dark Mode

Das aktive Theme steht auf `html[data-riu-theme="light|dark"]`. Die Auswahl wird unter `riu-theme` in `localStorage` gespeichert. Ohne gespeicherte Auswahl gilt die Betriebssystempräferenz. Der Theme-Schalter wird auf allen Plattformseiten im Header angezeigt.

Neue Komponenten dürfen keine eigenen Light-/Dark-Farbwerte benötigen. Sie sollen ausschließlich die zentralen Tokens verwenden. Ausnahmen sind Medien-Overlays, auf denen Weiß und halbtransparentes Schwarz unabhängig vom Theme für ausreichenden Kontrast sorgen.

## Komponentenregeln

- Primärbuttons: Akzentfarbe, Pillenform, kompakte Beschriftung
- Karten: `--riu-panel-low`, `--riu-line`, `--riu-radius-md`, `--riu-shadow`
- Formulare: ruhige Unterstreichung oder feiner Rahmen; Fokus immer `--riu-accent`
- Dialoge: stärkster Schatten, klare Oberflächentrennung, identische Tokens in beiden Themes
- Bilder und WebM-Vorschauen: kleine Karten verwenden ausschließlich das Coverbild; nur der Discover-Hero spielt WebM automatisch stumm und geloopt
- Animationen: kurze Farbwechsel um `300ms`; größere Bewegungen mit weichem Expo-Easing

## Schnell ändern

1. `src/platform/platform.css` öffnen.
2. Im ersten `:root`-Block Light-Werte ändern.
3. Im direkt folgenden `html[data-riu-theme="dark"]`-Block Dark-Werte ändern.
4. Keine einzelnen Seitenfarben überschreiben, solange ein bestehendes Token die Aufgabe beschreibt.
5. Danach `npm run lint`, `npm test` und `npm run build` ausführen und mindestens Home, Discover, Dashboard und Login in beiden Themes prüfen.
