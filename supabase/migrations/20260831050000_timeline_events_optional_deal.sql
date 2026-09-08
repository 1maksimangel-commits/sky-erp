-- Platform timeline events may belong directly to contracts, documents,
-- shipments, payments, or commissions before they are linked to a Deal.
-- Preserve the legacy Deal link when present, but do not require it.

alter table public.timeline_events
  alter column business_case_id drop not null;

notify pgrst, 'reload schema';
