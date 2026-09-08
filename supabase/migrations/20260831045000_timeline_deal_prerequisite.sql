-- The following historical migration relaxes this legacy relationship, but no
-- tracked migration creates it. Add it AFTER platform creates the complete table.
alter table public.timeline_events
  add column if not exists business_case_id uuid
  references public.business_cases(id) on delete set null;
