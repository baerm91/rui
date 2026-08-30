const BUNDLED_COVER_URL = /^\//;
const FETCHABLE_COVER_URL = /^(?:data:|blob:|https?:\/\/)/i;

export function isSharedPublishedStoryCover(story) {
  const coverImage = String(story?.coverImage || '').trim();
  return BUNDLED_COVER_URL.test(coverImage)
    || (Boolean(story?.coverImageStoragePath) && /^https?:\/\//i.test(coverImage));
}

export function invalidatePublishedStoryCoverUpload(story) {
  return {
    ...story,
    coverImageStoragePath: '',
    coverImageUploadedAt: ''
  };
}

export async function ensureSharedPublishedStoryCover(story, uploadCover) {
  const coverImage = String(story?.coverImage || '').trim();
  if (!coverImage) throw new Error('Bitte erstellen oder wählen Sie vor der Veröffentlichung ein Vorschaubild.');
  if (isSharedPublishedStoryCover(story)) return story;
  if (!FETCHABLE_COVER_URL.test(coverImage)) {
    throw new Error('Das Vorschaubild hat kein unterstütztes Format.');
  }

  let response;
  try {
    response = await fetch(coverImage);
  } catch {
    throw new Error('Das Vorschaubild konnte nicht für die Veröffentlichung geladen werden.');
  }
  if (!response.ok) throw new Error('Das Vorschaubild konnte nicht für die Veröffentlichung geladen werden.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size === 0) {
    throw new Error('Das Vorschaubild ist keine gültige Bilddatei.');
  }

  const uploadedAt = new Date().toISOString();
  const uploaded = await uploadCover(story, blob, uploadedAt);
  if (!uploaded?.publicUrl) throw new Error('Das Vorschaubild konnte nicht öffentlich gespeichert werden.');
  return {
    ...story,
    coverImage: uploaded.publicUrl,
    coverImageStoragePath: uploaded.storagePath || '',
    coverImageUploadedAt: uploadedAt
  };
}
