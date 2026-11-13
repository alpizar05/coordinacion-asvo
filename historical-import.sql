-- Migration-only staging: original snapshots and unresolved associations remain private.
create table if not exists historical_import_batches (
  id text primary key, sha256 text not null unique, metadata jsonb not null,
  created_at timestamptz not null default now(), completed_at timestamptz, summary jsonb
);
create table if not exists historical_import_records (
  batch_id text not null references historical_import_batches,
  entity text not null, source_key text not null, target_id uuid,
  state text not null, payload jsonb not null, notes jsonb not null default '{}',
  primary key(batch_id,entity,source_key)
);
create table if not exists historical_import_report_links (
  batch_id text not null references historical_import_batches,
  report_source_id uuid not null, outing_id uuid not null references outings,
  confidence text not null check(confidence in ('Fuerte','Probable')),
  state text not null check(state in ('asociado_demo','pendiente')),
  evidence text, human_approved boolean not null default false,
  primary key(batch_id,report_source_id,outing_id)
);
create table if not exists historical_import_photos (
  batch_id text not null references historical_import_batches, photo_key text not null,
  source_sha256 text not null, original_drive text not null, original_item text not null,
  thumbnail bytea not null, display_image bytea not null, alt text not null, credit text not null,
  primary key(batch_id,photo_key)
);
-- Core columns (including nullable received_at) are prepared by numbered migrations.
