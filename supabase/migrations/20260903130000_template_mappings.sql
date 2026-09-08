create table if not exists public.template_mappings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  placeholder text not null,
  sky_variable text,
  is_repeating_product_row boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, placeholder)
);
alter table public.template_mappings enable row level security;
drop policy if exists "Public read template mappings" on public.template_mappings;
create policy "Public read template mappings" on public.template_mappings for select to public using (true);
drop policy if exists "Public write template mappings" on public.template_mappings;
create policy "Public write template mappings" on public.template_mappings for all to public using (true) with check (true);
