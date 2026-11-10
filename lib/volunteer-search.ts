import { sql } from './db';

const pageSize = 25;
export function volunteerSearchTerms(value: string) {
  return value.trim().slice(0,120).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es')
    .split(/\s+/).filter(Boolean).slice(0,10);
}

export async function searchVolunteers(query: string, unit: string, requestedPage: number) {
  const terms = volunteerSearchTerms(query);
  const where = sql`(${unit}='' or ${unit}=any(units)) and not exists (
    select 1 from unnest(${terms}::text[]) as term(value)
    where strpos(lower(translate(concat_ws(' ',name,surname,second_surname,identification,email),
      'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),term.value)=0
  )`;
  return sql.begin('isolation level repeatable read read only', async tx => {
    const [{ total }] = await tx<{ total: number }[]>`select count(*)::int as total from volunteers where ${where}`;
    const pages = Math.max(1,Math.ceil(total/pageSize));
    const page = Math.min(pages,Math.max(1,Number.isSafeInteger(requestedPage) ? requestedPage : 1));
    const people = await tx<{ id: string; identification: string; name: string; surname: string;
      second_surname: string | null; email: string | null; units: string[] }[]>`
      select id,identification,name,surname,second_surname,email,units from volunteers
      where ${where} order by name,surname,second_surname,id limit ${pageSize} offset ${(page-1)*pageSize}`;
    return { people,total,page,pages,pageSize };
  });
}

export function volunteerListUrl(query: string, unit: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set('buscar',query);
  if (unit) params.set('unidad',unit);
  if (page>1) params.set('pagina',String(page));
  return `/coordinacion/registro${params.size ? `?${params}` : ''}`;
}
