create table if not exists grants (
  subject text not null, role text not null check (role in ('admin','general','unidad')),
  unit text not null default '', primary key(subject,role,unit)
);
create table if not exists units (name text primary key);
insert into units values ('Voluntariado General'),('UEA'),('Control y Protección/COVIRENA'),('BRIF') on conflict do nothing;
create table if not exists volunteers (
  id uuid primary key default gen_random_uuid(), identification text unique not null,
  name text not null, surname text not null, second_surname text, email text, birth date,
  whatsapp text, province text, canton text, district text, medical boolean, medical_detail text,
  emergency_name text, emergency_phone text, emergency_relation text,
  volunteer_year int, member boolean, member_year int, units text[] not null default '{}'
);
create table if not exists requests (
  id uuid primary key default gen_random_uuid(), organization text not null, contact text,
  area text, activity text not null, plan text, logistics text
);
create table if not exists outings (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references requests,
  title text not null, location text not null, unit text not null references units,
  starts date not null, ends date not null check(ends >= starts), flexible boolean not null,
  capacity int not null check(capacity > 0), requirements text, logistics text,
  status text not null default 'borrador'
);
create table if not exists policies (
  id uuid primary key default gen_random_uuid(), volunteer_id uuid not null references volunteers,
  kind text not null, number text not null, starts date, ends date, source text,
  verified_by text, verified_at timestamptz, check(ends >= starts)
);
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(), outing_id uuid not null references outings,
  volunteer_id uuid references volunteers, identification text not null,
  received_at timestamptz not null default clock_timestamp(), validated_at timestamptz,
  validated_by text, validation_channel text, status text not null default 'validación',
  starts date not null, ends date not null check(ends >= starts),
  details jsonb not null, policy_id uuid references policies
);
create unique index if not exists one_valid_registration on registrations(outing_id,volunteer_id)
where status in ('revisión','espera','confirmada');
create table if not exists links (
  digest text primary key, registration_id uuid not null references registrations,
  purpose text not null, expires timestamptz not null
);
create table if not exists attempts (
  bucket text not null, slot bigint not null, count int not null, primary key(bucket,slot)
);
create table if not exists audit (
  id bigint generated always as identity primary key, actor text not null, action text not null,
  target text not null, reason text, happened_at timestamptz not null default now()
);
create table if not exists demo_mail (
  id bigint generated always as identity primary key, recipient text not null, url text not null
);
create unique index if not exists one_pending_policy on policies(volunteer_id,kind,number)
where verified_at is null;

create table if not exists outing_photos (
  id uuid primary key default gen_random_uuid(),
  outing_id uuid not null references outings,
  position smallint check (position between 1 and 6),
  alt text not null,
  credit text not null,
  original_item text,
  original_drive text,
  thumbnail bytea not null,
  display_image bytea not null,
  unique (outing_id, position) deferrable initially deferred
);

alter table outings add column if not exists listed boolean not null default true;

create table if not exists volunteer_incidents (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers,
  outing_id uuid references outings,
  occurred_on date not null,
  description text not null check (char_length(btrim(description)) between 1 and 4000),
  recorded_by text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists volunteer_incidents_history
  on volunteer_incidents(volunteer_id, occurred_on desc, recorded_at desc);

alter table volunteers alter column units set default array['Voluntariado General']::text[];
update volunteers set units = array_prepend('Voluntariado General', units)
  where not (units @> array['Voluntariado General']::text[]);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'volunteers'::regclass and conname = 'volunteers_general_unit_required'
  ) then
    alter table volunteers add constraint volunteers_general_unit_required
      check (units @> array['Voluntariado General']::text[]);
  end if;
end;
$$;

-- Retirar la antigua opción del catálogo y de las membresías existentes.
delete from units where name = 'Otros';
update volunteers set units = array_remove(units, 'Otros')
  where units @> array['Otros']::text[];

create table if not exists outing_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);
create table if not exists outing_collection_members (
  collection_id uuid not null references outing_collections on delete cascade,
  outing_id uuid not null references outings on delete cascade,
  primary key (collection_id, outing_id)
);
create index if not exists outing_collection_members_outing on outing_collection_members(outing_id);

alter table outings add column if not exists registration_deadline date;

create table if not exists outing_invitations (
  digest text primary key,
  outing_id uuid not null references outings on delete cascade,
  volunteer_id uuid not null references volunteers,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists outing_invitations_outing on outing_invitations(outing_id);

alter table requests add column if not exists outing_defaults jsonb;
alter table outings add column if not exists outing_overrides text[] not null default '{}';

-- Use the first block as the starting point and preserve existing differences.
with first_blocks as (
  select distinct on (request_id) request_id,title,location,unit,requirements,logistics
  from outings order by request_id,starts,id
), initialized as (
  update requests r set outing_defaults=jsonb_build_object(
    'title',b.title,'location',b.location,'unit',b.unit,
    'requirements',coalesce(b.requirements,''),'logistics',coalesce(b.logistics,''))
  from first_blocks b where r.id=b.request_id and r.outing_defaults is null
  returning r.id,r.outing_defaults
)
update outings o set outing_overrides=array(
  select key from jsonb_each_text(i.outing_defaults) as defaults(key,value)
  where coalesce(to_jsonb(o)->>key,'') is distinct from value
)
from initialized i where o.request_id=i.id;

create table if not exists request_outing_photos (
  request_id uuid not null references requests on delete cascade,
  position smallint not null check (position between 1 and 6),
  alt text not null,
  credit text not null,
  original_item text,
  original_drive text,
  thumbnail bytea not null,
  display_image bytea not null,
  primary key(request_id,position)
);
alter table requests add column if not exists outing_photos_initialized boolean not null default false;

do $$
begin
  if exists (select 1 from requests where not outing_photos_initialized and outing_defaults is not null) then
    insert into request_outing_photos
    select r.id,p.position,p.alt,p.credit,p.original_item,p.original_drive,p.thumbnail,p.display_image
    from requests r
    join lateral (select id from outings where request_id=r.id order by starts,id limit 1) first on true
    join outing_photos p on p.outing_id=first.id and p.position is not null
    where not r.outing_photos_initialized and r.outing_defaults is not null
    on conflict do nothing;

    update outings o set outing_overrides=array_append(o.outing_overrides,'photos')
    from requests r where o.request_id=r.id and not r.outing_photos_initialized and r.outing_defaults is not null
      and not ('photos'=any(o.outing_overrides))
      and (
        exists (select position,alt,credit,original_item,original_drive,thumbnail,display_image
          from outing_photos where outing_id=o.id and position is not null
          except select position,alt,credit,original_item,original_drive,thumbnail,display_image
          from request_outing_photos where request_id=r.id)
        or exists (select position,alt,credit,original_item,original_drive,thumbnail,display_image
          from request_outing_photos where request_id=r.id
          except select position,alt,credit,original_item,original_drive,thumbnail,display_image
          from outing_photos where outing_id=o.id and position is not null)
      );
    update requests set outing_photos_initialized=true where not outing_photos_initialized and outing_defaults is not null;
  end if;
end;
$$;

create table if not exists homepage_feature (
  singleton boolean primary key default true check (singleton),
  outing_id uuid references outings on delete cascade,
  request_id uuid references requests on delete cascade,
  check (num_nonnulls(outing_id,request_id) = 1)
);

alter table registrations alter column status set default 'revisión';
alter table demo_mail add column if not exists subject text;
alter table demo_mail add column if not exists body text;
create table if not exists registration_mail_outbox (
  id bigint generated always as identity primary key,
  registration_id uuid not null references registrations,
  recipient text not null,
  url text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  retry_at timestamptz not null default now()
);
create index if not exists registration_mail_pending on registration_mail_outbox(retry_at,id) where sent_at is null;
alter table registration_mail_outbox add column if not exists html_body text;
create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now());

create table if not exists registration_receipts (
  digest text primary key,
  registration_id uuid not null references registrations on delete cascade,
  status text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create table if not exists outing_brief_links (
  digest text primary key,
  outing_id uuid not null references outings on delete cascade,
  lead_registration_id uuid not null references registrations on delete cascade,
  created_by text not null,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);

create table if not exists outing_reports (
  id uuid primary key default gen_random_uuid(),
  outing_id uuid not null references outings on delete cascade,
  lead_registration_id uuid not null references registrations on delete cascade,
  lead_name text not null,
  lead_email text not null,
  labour text not null,
  location text not null,
  activity text not null,
  starts date not null,
  ends date not null check (ends >= starts),
  actions text not null,
  host text not null,
  observations text not null default '',
  participants jsonb not null,
  submitted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (outing_id,lead_registration_id)
);

alter table outing_reports add column if not exists labour_types text[] not null default '{}';
