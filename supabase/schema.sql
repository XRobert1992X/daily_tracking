-- Einrichtung der Synchronisation (einmalig im Supabase-Projekt ausführen)
--
-- 1. Auf supabase.com ein Projekt anlegen (Free-Plan reicht).
-- 2. Links „SQL Editor“ öffnen, diesen Inhalt einfügen und „Run“ drücken.
-- 3. Unter „Project Settings → API“ die „Project URL“ und den „anon public“ Key kopieren und in der App
--    unter „Synchronisation“ eintragen (oder in src/sync/config.ts).
-- 4. Unter „Authentication → Sign In / Providers → Email“ kannst du „Confirm email“ ausschalten.
--    Nachdem dein Konto angelegt ist, unter „Authentication → Sign In / Providers“ die Option
--    „Allow new users to sign up“ ausschalten, damit sich niemand sonst registrieren kann.

-- Alle Einträge aller Themen liegen in einer Tabelle (store = Thema, id = Eintrag, data = Inhalt).
create table if not exists public.records (
  user_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  store     text        not null,
  id        text        not null,
  data      jsonb,
  -- Zeitpunkt der letzten Änderung auf dem Gerät (ms); die jüngere Änderung gewinnt
  u         bigint      not null,
  deleted   boolean     not null default false,
  synced_at timestamptz not null default now(),
  primary key (user_id, store, id)
);

create index if not exists records_pull_idx on public.records (user_id, synced_at);

alter table public.records enable row level security;

drop policy if exists "eigene Daten" on public.records;
create policy "eigene Daten" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Setzt den Server-Zeitstempel und ignoriert veraltete Schreibzugriffe
create or replace function public.records_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.u < old.u then
    return null;
  end if;
  new.synced_at := now();
  return new;
end;
$$;

drop trigger if exists records_guard on public.records;
create trigger records_guard
  before insert or update on public.records
  for each row execute function public.records_guard();

-- Fotos: privater Speicher, jeder Nutzer sieht nur seinen eigenen Ordner (<user_id>/<foto_id>)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "Fotos lesen" on storage.objects;
create policy "Fotos lesen" on storage.objects
  for select using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Fotos hochladen" on storage.objects;
create policy "Fotos hochladen" on storage.objects
  for insert with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Fotos ändern" on storage.objects;
create policy "Fotos ändern" on storage.objects
  for update using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Fotos löschen" on storage.objects;
create policy "Fotos löschen" on storage.objects
  for delete using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
