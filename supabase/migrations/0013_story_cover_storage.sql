update storage.buckets
set allowed_mime_types = array[
  'video/webm',
  'video/mp4',
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp'
]
where id = 'story-previews';
