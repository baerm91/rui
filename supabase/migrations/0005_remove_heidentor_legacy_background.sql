update public.stories
set
  story = jsonb_set(
    jsonb_set(
      jsonb_set(story, '{stations,0,bgImage}', '""'::jsonb, true),
      '{stations,1,bgImage}', '""'::jsonb, true
    ),
    '{stationRevision}', '1'::jsonb, true
  ),
  updated_at = now()
where id = 'demo-heidentor';
