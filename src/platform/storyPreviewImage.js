const PREVIEW_WIDTH = 960;
const PREVIEW_HEIGHT = 540;

const escapeXml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const shorten = (value, maximum) => {
  const text = String(value || '').trim();
  if (text.length <= maximum) return text;
  return `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
};

const hashText = (value) => {
  let hash = 2166136261;
  for (const character of String(value || 'RIU')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const storyCategory = (story) => story?.metadata?.categories?.[0]
  || story?.metadata?.category
  || story?.category
  || 'Story';

const storyType = (story) => story?.settings?.experienceType === 'room'
  ? 'Scrolling-Ausstellung'
  : '3D-Story';

export function getStoryPreviewImageSignature(story) {
  return JSON.stringify([
    story?.name || story?.branding?.title || '',
    story?.branding?.subtitle || '',
    storyCategory(story),
    storyType(story),
    Array.isArray(story?.stations) ? story.stations.length : 0
  ]);
}

export function createAutomaticStoryPreviewImage(story) {
  const title = shorten(story?.name || story?.branding?.title || 'Unbenannte Story', 52);
  const subtitle = shorten(story?.branding?.subtitle || story?.description || '', 82);
  const category = shorten(storyCategory(story), 28);
  const stationCount = Array.isArray(story?.stations) ? story.stations.length : 0;
  const details = `${storyType(story)} · ${stationCount} ${stationCount === 1 ? 'Station' : 'Stationen'}`;
  const hash = hashText(`${story?.id || ''}:${title}:${category}`);
  const hue = hash % 360;
  const accentHue = (hue + 34 + (hash % 47)) % 360;
  const titleY = subtitle ? 350 : 374;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue} 30% 12%)"/>
        <stop offset="1" stop-color="hsl(${accentHue} 36% 22%)"/>
      </linearGradient>
      <radialGradient id="light" cx="72%" cy="27%" r="70%">
        <stop offset="0" stop-color="hsl(${accentHue} 68% 67%)" stop-opacity=".52"/>
        <stop offset="1" stop-color="hsl(${hue} 30% 12%)" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-opacity=".35"/></filter>
    </defs>
    <rect width="960" height="540" fill="url(#background)"/>
    <rect width="960" height="540" fill="url(#light)"/>
    <g opacity=".2" fill="none" stroke="hsl(${accentHue} 70% 78%)">
      <circle cx="760" cy="126" r="196"/>
      <circle cx="760" cy="126" r="140"/>
      <circle cx="760" cy="126" r="84"/>
      <path d="M520 126h440M760 0v330M610 18l300 216M610 234L910 18"/>
    </g>
    <g filter="url(#shadow)">
      <path d="M590 236 760 138l170 98-170 98z" fill="hsl(${accentHue} 48% 72%)" fill-opacity=".22" stroke="hsl(${accentHue} 58% 80%)" stroke-opacity=".55"/>
      <path d="m590 236 170 98v124l-170-98z" fill="hsl(${hue} 38% 20%)" fill-opacity=".75" stroke="hsl(${accentHue} 58% 80%)" stroke-opacity=".35"/>
      <path d="m930 236-170 98v124l170-98z" fill="hsl(${accentHue} 42% 30%)" fill-opacity=".7" stroke="hsl(${accentHue} 58% 80%)" stroke-opacity=".35"/>
    </g>
    <g font-family="Arial, Helvetica, sans-serif" fill="#f7f4ed">
      <text x="64" y="72" font-size="18" font-weight="700" letter-spacing="6">RIU</text>
      <text x="64" y="116" font-size="13" letter-spacing="2.8" fill="#ddd6ca">${escapeXml(category.toUpperCase())}</text>
      <text x="64" y="${titleY}" font-family="Georgia, serif" font-size="48" font-weight="400">${escapeXml(title)}</text>
      ${subtitle ? `<text x="66" y="400" font-size="18" fill="#ddd6ca">${escapeXml(subtitle)}</text>` : ''}
      <text x="66" y="470" font-size="13" letter-spacing="1.8" fill="#c7c0b5">${escapeXml(details.toUpperCase())}</text>
    </g>
    <rect x="64" y="501" width="832" height="1" fill="#f7f4ed" opacity=".28"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function ensurePublishedStoryPreviewImage(story) {
  if (!story || story.status !== 'published') return story;
  const signature = getStoryPreviewImageSignature(story);
  const hasCoverImage = Boolean(String(story.coverImage || '').trim());
  const automaticImageIsCurrent = story.previewImageSource === 'automatic'
    && story.previewImageSignature === signature;
  if (hasCoverImage && (story.previewImageSource !== 'automatic' || automaticImageIsCurrent)) return story;

  return {
    ...story,
    coverImage: createAutomaticStoryPreviewImage(story),
    previewImageSource: 'automatic',
    previewImageSignature: signature,
    previewImageGeneratedAt: story.previewImageGeneratedAt
      || story.publishedAt
      || story.updatedAt
      || new Date().toISOString()
  };
}

export function ensurePublishedStoryPreviewImages(stories) {
  return (Array.isArray(stories) ? stories : []).map(ensurePublishedStoryPreviewImage);
}
