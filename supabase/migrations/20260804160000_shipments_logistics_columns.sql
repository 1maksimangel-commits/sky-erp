-- Safely extend public.shipments for the Logistics module.
-- Additive only: no DROP, no table recreate, no data loss.

alter table public.shipments
  add column if not exists voyage text;

alter table public.shipments
  add column if not exists business_case_id uuid references public.business_cases (id) on delete set null;

alter table public.shipments
  add column if not exists tracking_number text;

alter table public.shipments
  add column if not exists booking_number text;

alter table public.shipments
  add column if not exists shipping_line text;

alter table public.shipments
  add column if not exists etd_actual date;

alter table public.shipments
  add column if not exists eta_actual date;

alter table public.shipments
  add column if not exists atd date;

alter table public.shipments
  add column if not exists ata date;

alter table public.shipments
  add column if not exists container_type text;

alter table public.shipments
  add column if not exists seal_number text;

alter table public.shipments
  add column if not exists freight_forwarder text;

alter table public.shipments
  add column if not exists remarks text;

create table if not exists public.shipment_timeline_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  title text not null,
  description text,
  event_date timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists shipments_contract_id_idx
  on public.shipments (contract_id);

create index if not exists shipments_business_case_id_idx
  on public.shipments (business_case_id);

create index if not exists shipments_status_idx
  on public.shipments (status);

create index if not exists shipments_etd_idx
  on public.shipments (etd);

create index if not exists shipments_eta_idx
  on public.shipments (eta);

create index if not exists shipments_vessel_idx
  on public.shipments (vessel);

create index if not exists shipments_tracking_number_idx
  on public.shipments (tracking_number);

create index if not exists shipment_timeline_events_shipment_id_idx
  on public.shipment_timeline_events (shipment_id, event_date desc);

alter table public.shipment_timeline_events enable row level security;

drop policy if exists "Public read shipment_timeline_events" on public.shipment_timeline_events;
create policy "Public read shipment_timeline_events"
  on public.shipment_timeline_events for select to public using (true);

drop policy if exists "Public insert shipment_timeline_events" on public.shipment_timeline_events;
create policy "Public insert shipment_timeline_events"
  on public.shipment_timeline_events for insert to public with check (true);

drop policy if exists "Public update shipment_timeline_events" on public.shipment_timeline_events;
create policy "Public update shipment_timeline_events"
  on public.shipment_timeline_events for update to public using (true);

drop policy if exists "Public delete shipment_timeline_events" on public.shipment_timeline_events;
create policy "Public delete shipment_timeline_events"
  on public.shipment_timeline_events for delete to public using (true);

notify pgrst, 'reload schema';
