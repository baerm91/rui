export const EXHIBITION_STORAGE_KEY = 'riu-exhibition-prototype-v1';

const makeArtwork = (label, foreground, background) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="${background}"/><circle cx="320" cy="178" r="118" fill="${foreground}" opacity=".16"/><path d="M208 304c37-38 56-83 59-136 2-51 25-77 53-77s51 26 53 77c3 53 22 98 59 136z" fill="${foreground}"/><text x="32" y="365" fill="white" opacity=".78" font-family="Arial" font-size="22" letter-spacing="5">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const MODEL_LIBRARY = [
  { id: 'vessel', name: 'Gefäß 01', detail: 'Keramik · 2. Jh.', color: '#b76f48' },
  { id: 'fragment', name: 'Fragment 02', detail: 'Kalkstein · 4. Jh.', color: '#c9c1ae' },
  { id: 'disc', name: 'Scheibe 03', detail: 'Bronze · 1. Jh.', color: '#527c72' }
];

export const DEFAULT_EXHIBITION = {
  id: 'riu-room-prototype',
  title: 'Spuren der Zeit',
  activeStationId: 'station-origin',
  stations: [
    {
      id: 'station-origin',
      order: 1,
      eyebrow: 'Station 01 · Ursprung',
      title: 'Drei Objekte,\ndrei Perspektiven',
      introduction: 'Eine kleine Auswahl materieller Spuren. Wählen Sie ein Objekt, um Form, Oberfläche und Geschichte aus der Nähe zu betrachten.',
      activeModelId: 'vessel',
      thumbnails: [
        { id: 'thumb-vessel', modelId: 'vessel', image: makeArtwork('GEFÄSS 01', '#b76f48', '#26221f'), x: 5, y: 8, width: 27 },
        { id: 'thumb-fragment', modelId: 'fragment', image: makeArtwork('FRAGMENT 02', '#c9c1ae', '#252725'), x: 36.5, y: 8, width: 27 },
        { id: 'thumb-disc', modelId: 'disc', image: makeArtwork('SCHEIBE 03', '#527c72', '#1d2826'), x: 68, y: 8, width: 27 }
      ]
    }
  ]
};

export function normalizeExhibition(value) {
  if (!value || !Array.isArray(value.stations) || value.stations.length === 0) return structuredClone(DEFAULT_EXHIBITION);
  const stations = value.stations.map((station, stationIndex) => ({
    ...structuredClone(DEFAULT_EXHIBITION.stations[0]),
    ...station,
    order: stationIndex + 1,
    thumbnails: Array.isArray(station.thumbnails) ? station.thumbnails.map((thumbnail, index) => ({
      id: thumbnail.id || `thumbnail-${station.id || stationIndex}-${index}`,
      modelId: MODEL_LIBRARY.some((model) => model.id === thumbnail.modelId) ? thumbnail.modelId : MODEL_LIBRARY[0].id,
      image: thumbnail.image || makeArtwork(`OBJEKT ${index + 1}`, '#b76f48', '#26221f'),
      x: Math.max(0, Math.min(88, Number(thumbnail.x) || 0)),
      y: Math.max(0, Math.min(72, Number(thumbnail.y) || 0)),
      width: Math.max(16, Math.min(42, Number(thumbnail.width) || 24))
    })) : []
  }));
  return { ...structuredClone(DEFAULT_EXHIBITION), ...value, stations };
}

