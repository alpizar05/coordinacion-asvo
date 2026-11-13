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
