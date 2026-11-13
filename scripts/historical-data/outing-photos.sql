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
