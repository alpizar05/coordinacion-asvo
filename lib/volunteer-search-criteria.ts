export function volunteerSearchTerms(value: string) {
  return value.trim().slice(0,120).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es')
    .split(/\s+/).filter(Boolean).slice(0,10);
}

export function volunteerListUrl(query: string, unit: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set('buscar',query);
  if (unit) params.set('unidad',unit);
  if (page>1) params.set('pagina',String(page));
  return `/coordinacion/registro${params.size ? `?${params}` : ''}`;
}
