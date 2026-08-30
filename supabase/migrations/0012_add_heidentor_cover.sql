update public.stories
set
  story = jsonb_set(
    jsonb_set(
      jsonb_set(story, '{coverImage}', '"/heidentor-cover.jpg"'::jsonb, true),
      '{previewImageSource}', '"bundled"'::jsonb, true
    ),
    '{previewImageSignature}', '""'::jsonb, true
  ),
  updated_at = now()
where id = 'demo-heidentor'
  and (
    nullif(btrim(story ->> 'coverImage'), '') is null
    or story ->> 'previewImageSource' = 'automatic'
  );
