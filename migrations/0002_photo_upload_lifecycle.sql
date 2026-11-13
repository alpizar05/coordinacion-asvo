-- Additive ledger only: existing photos and references are not rewritten.
create table photo_upload_operations (
 id text primary key, actor text not null, scope text not null, fingerprint text not null,
 state text not null check(state in ('uploading','failed','committed')),
 attempt uuid not null, lease_until timestamptz not null,
 result jsonb, created_at timestamptz not null default clock_timestamp(),
 check((state='committed')=(result is not null))
);
create table photo_upload_items (
 id uuid primary key, operation_id text not null references photo_upload_operations,
 attempt uuid not null, photo_key text not null, drive text not null, folder text not null, name text not null,
 item text, state text not null check(state in ('planned','uploaded','attached','cleanup','cleaning','deleted','protected')),
 uncertain boolean not null default true, retry_at timestamptz not null default clock_timestamp(),
 cleanup_attempts integer not null default 0, created_at timestamptz not null default clock_timestamp(),
 unique(drive,folder,name)
);
create index photo_upload_cleanup on photo_upload_items(state,retry_at);
create index photo_upload_references on photo_upload_items(drive,item) where item is not null;
-- Fence against references appearing after the cleanup decision but before external DELETE.
create function protect_photo_upload_reference()returns trigger language plpgsql as $$
declare lifecycle text;
begin
 if NEW.original_drive is null or NEW.original_item is null then return NEW;end if;
 select state into lifecycle from photo_upload_items
 where drive=NEW.original_drive and item=NEW.original_item for share;
 if lifecycle in ('cleanup','cleaning','deleted') then
  raise exception 'El archivo está pendiente de limpieza; volvé a seleccionar o cargar la foto.';
 end if;
 return NEW;
end$$;
create trigger protect_outing_photo_upload before insert or update of original_drive,original_item on outing_photos
 for each row execute function protect_photo_upload_reference();
create trigger protect_request_photo_upload before insert or update of original_drive,original_item on request_outing_photos
 for each row execute function protect_photo_upload_reference();
