/** Catalog only: never reads personal records, mail, tokens or historical payloads. */
export async function inspectSchema(sql) {
  const [{ schema }] = await sql`select current_schema() as schema`;
  if (!schema) throw new Error('No hay un esquema seleccionado en search_path.');
  const normalize = value => typeof value === 'string'
    ? value.replaceAll(`"${schema.replaceAll('"','""')}".`, '__schema__.').replace(new RegExp(`\\b${schema.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\.`, 'g'), '__schema__.') : value;
  const clean = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value])=>[key,normalize(value)])));
  const relations = clean(await sql`select c.relname as name,c.relkind::text as kind,c.relpersistence::text as persistence,
    c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.reloptions as options
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=${schema} and c.relkind in ('r','p','v','m','S') and c.relname<>'asvo_schema_migrations' order by c.relname`);
  const columns = clean(await sql`select c.relname as relation,a.attname as name,format_type(a.atttypid,a.atttypmod) as type,
    case when a.attcollation=0 then null else a.attcollation::regcollation::text end as collation,
    a.attnotnull as not_null,a.attidentity::text as identity,a.attgenerated::text as generated,
    pg_get_expr(d.adbin,d.adrelid) as default_expr
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname=${schema} and c.relkind in ('r','p','v','m') and c.relname<>'asvo_schema_migrations'
      and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`);
  const constraints = clean(await sql`select c.relname as relation,k.conname as name,k.contype::text as type,
    regexp_replace(pg_get_constraintdef(k.oid,true),' NOT VALID$','') as definition,k.convalidated as validated
    from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=${schema} and c.relname<>'asvo_schema_migrations' and k.contype<>'n' order by c.relname,k.conname`);
  const indexes = clean(await sql`select c.relname as relation,i.relname as name,pg_get_indexdef(i.oid) as definition,
    x.indisunique as is_unique,x.indisvalid as valid,x.indisready as ready
    from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class c on c.oid=x.indrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname=${schema} and c.relname<>'asvo_schema_migrations' order by c.relname,i.relname`);
  const views = clean(await sql`select c.relname as name,pg_get_viewdef(c.oid,true) as definition
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=${schema} and c.relkind in ('v','m') order by c.relname`);
  const functions = clean(await sql`select p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname=${schema} and p.prokind in ('f','p') order by p.proname,pg_get_function_identity_arguments(p.oid)`);
  const sequences = clean(await sql`select c.relname as name,format_type(s.seqtypid,null) as type,
    s.seqstart::text as start,s.seqincrement::text as increment,s.seqmin::text as min,s.seqmax::text as max,s.seqcache::text as cache,s.seqcycle as cycle,
    owner.relname as relation,a.attname as column_name
    from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_depend d on d.objid=c.oid and d.classid='pg_class'::regclass and d.deptype in ('a','i')
    left join pg_class owner on owner.oid=d.refobjid left join pg_attribute a on a.attrelid=d.refobjid and a.attnum=d.refobjsubid
    where n.nspname=${schema} order by c.relname`);
  const triggers = clean(await sql`select c.relname as relation,t.tgname as name,pg_get_triggerdef(t.oid,true) as definition,t.tgenabled::text as enabled
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=${schema} and not t.tgisinternal order by c.relname,t.tgname`);
  const policies = clean(await sql`select c.relname as relation,p.polname as name,p.polcmd::text as command,p.polpermissive as permissive,
    p.polroles::text as roles,pg_get_expr(p.polqual,p.polrelid) as using_expr,pg_get_expr(p.polwithcheck,p.polrelid) as check_expr
    from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname=${schema} order by c.relname,p.polname`);
  const units = relations.some(r=>r.name==='units'&&r.kind==='r') && columns.some(c=>c.relation==='units'&&c.name==='name'&&c.type==='text')
    ? (await sql`select name from units order by name`).map(row=>row.name) : [];
  return { relations,columns,constraints,indexes,views,functions,sequences,triggers,policies,units };
}

/** Conservative compatibility: required objects must agree; extra core constraints/columns are not silently adopted. */
export function schemaDifferences(expected, actual) {
  const differences = [];
  const managed = new Set(expected.relations.map(r=>r.name));
  const functionNames = new Set(expected.functions.map(r=>r.name));
  const key = row => [row.relation ?? '',row.name,row.arguments ?? ''].join('/');
  for (const group of ['relations','columns','constraints','indexes','views','functions','sequences','triggers','policies']) {
    const wanted = new Map(expected[group].map(row=>[key(row),row]));
    const found = new Map(actual[group].map(row=>[key(row),row]));
    for (const [id,row] of wanted) {
      const current = found.get(id);
      if (!current) { differences.push(`${group}: falta ${id}`); continue; }
      // A validated version of the baseline NOT VALID check is stronger and compatible.
      const comparable = group==='constraints' && row.validated===false ? {...current,validated:false} : current;
      if (JSON.stringify(row)!==JSON.stringify(comparable)) differences.push(`${group}: definición incompatible de ${id}`);
    }
    for (const [id,row] of found) {
      const core = managed.has(row.relation ?? row.name) || (group==='functions'&&functionNames.has(row.name));
      if (!wanted.has(id) && core && !(group==='indexes'&&!row.is_unique&&row.valid&&row.ready))
        differences.push(`${group}: objeto adicional no verificado ${id}`);
    }
  }
  for (const name of expected.units) if (!actual.units.includes(name)) differences.push(`units: falta referencia ${name}`);
  return differences;
}
