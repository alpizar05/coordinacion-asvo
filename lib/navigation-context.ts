const detailPattern = /^\/coordinacion\/(?:registro\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|salidas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/resumen)?|colecciones\/(?:automaticas|manuales)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const criteria: Record<string, string[]> = {
  '/coordinacion': ['unidad','dias','pestana'],
  '/coordinacion/inscripciones': ['estado','unidad','desde','hasta'],
  '/coordinacion/informes': ['estado','unidad','desde','hasta'],
  '/coordinacion/registro': ['buscar','unidad','pagina'],
  '/coordinacion/convocatorias': ['salidaBuscar','salidaUnidad','salidaEstado','salidaAcceso','salidaOrden','serieBuscar','serieTipo','serieDisponibilidad'],
};
/** Explicit route/criteria allowlist. Never retain tokens, messages or nested return URLs. */
export function navigationDestination(value: string): string | null {
  if (typeof value!=='string'||value.length>4096||!(value==='/coordinacion'||value.startsWith('/coordinacion?')||value.startsWith('/coordinacion/'))||/[\\#\r\n]/.test(value))return null;
  const path=value.split('?')[0];if(/(?:^|\/)\.\.?(?:\/|$)|%(?:2e|2f|5c)/i.test(path))return null;
  const url = new URL(value, 'https://asvo.invalid');
  if (url.origin !== 'https://asvo.invalid') return null;
  const keys = criteria[url.pathname] ?? (detailPattern.test(url.pathname)
    ? url.pathname.includes('/registro/') ? ['seccion'] : url.pathname.endsWith('/resumen') ? ['informe'] : ['estado','pestana','desglose'] : null);
  if (!keys) return null;
  const query = new URLSearchParams();
  for (const key of keys) {
    const values = url.searchParams.getAll(key);
    if (values.length > 1 || (values[0]?.length ?? 0) > 150 || /[\u0000-\u001f\u007f]/.test(values[0]??'')) return null;
    if(key==='desglose'&&values[0]&&!['transporte','alimentacion'].includes(values[0]))return null;
    if (values[0]) query.set(key, values[0]);
  }
  return url.pathname + (query.size ? `?${query}` : '');
}
export function registrationListDestination(value: string) {
  return value.split('?')[0] === '/coordinacion/inscripciones' ? navigationDestination(value) : null;
}
export function navigationLabel(destination: string): string {
  const path=destination.split('?')[0];
  if(path==='/coordinacion')return 'Volver a Resumen';
  if(path==='/coordinacion/inscripciones')return 'Volver a solicitudes de inscripción';
  if(path==='/coordinacion/registro')return 'Volver a voluntariado';
  if(path==='/coordinacion/informes')return 'Volver a informes de salida';
  if(path==='/coordinacion/convocatorias')return 'Volver a convocatorias de salida';
  if(path.includes('/colecciones/'))return 'Volver a la convocatoria en serie';
  if(path.includes('/registro/'))return 'Volver a participaciones de la persona voluntaria';
  const query=new URLSearchParams(destination.split('?')[1]??'');
  if(query.get('pestana')==='logistica'||query.has('desglose'))return 'Volver a logística de la salida';
  return 'Volver a inscripciones de la salida';
}
export type NavigationFrame = { destination:string; anchor:string; offset:number; y:number; list?:string; index?:number; neighbors?:string[]; panelY?:number };
export type ListContext = { detail:string; frames:NavigationFrame[]; time:number };
function validFrame(value: unknown): value is NavigationFrame {
  if(!value || typeof value!=='object')return false;
  const c=value as NavigationFrame;
  return typeof c.destination==='string' && navigationDestination(c.destination)===c.destination
    && typeof c.anchor==='string' && /^(?:inscripcion|salida|persona|informe|participacion|bloque|serie-automaticas|serie-manuales|summary-review|summary-no-lead|summary-report|summary-upcoming|transporte|alimentacion)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c.anchor)
    && (c.list===undefined || /^[a-z-]{1,60}$/.test(c.list))
    && (c.index===undefined || (Number.isSafeInteger(c.index)&&c.index>=0))
    && (c.neighbors===undefined || (Array.isArray(c.neighbors)&&c.neighbors.length<=16&&c.neighbors.every(id=>typeof id==='string'&&/^[a-z-]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))))
    && (c.panelY===undefined||(Number.isFinite(c.panelY)&&c.panelY>=0))
    && Number.isFinite(c.offset) && Number.isFinite(c.y) && c.y>=0;
}
export function validListContext(value: unknown, now = Date.now()): value is ListContext {
  if(!value || typeof value!=='object')return false;
  const c=value as ListContext;
  return typeof c.detail==='string' && (detailPattern.test(c.detail)||Object.hasOwn(criteria,c.detail))
    && Array.isArray(c.frames) && c.frames.length>0 && c.frames.length<=8 && c.frames.every(validFrame)
    && new Set(c.frames.map(f=>f.destination.split('?')[0])).size===c.frames.length
    && !c.frames.some(f=>f.destination.split('?')[0]===c.detail)
    && Number.isFinite(c.time) && c.time<=now && now-c.time<30*60_000;
}
/** Visiting an ancestor pops the trail instead of creating a navigation cycle. */
export function navigationTrail(frames: NavigationFrame[], source: NavigationFrame, target: string): NavigationFrame[] {
  const ancestor=frames.findIndex(f=>f.destination.split('?')[0]===target);
  if(ancestor>=0)return frames.slice(0,ancestor);
  if(source.destination.split('?')[0]===target||frames.length>=8)return [];
  return [...frames,source];
}

/** Keep the next captured row first; preceding rows are a fallback after deletions. */
export function chooseNavigationAnchor(frame: NavigationFrame, available: readonly string[]): string | null {
  for (const id of [frame.anchor,...(frame.neighbors ?? [])]) if (available.includes(id)) return id;
  return available[Math.min(frame.index ?? 0,Math.max(0,available.length-1))] ?? null;
}
export function navigationCriteria(value:string) {
  const destination=navigationDestination(value);
  if(!destination)return null;
  const url=new URL(destination,'https://asvo.invalid');
  for(const key of url.pathname==='/coordinacion'?[]:['pestana','seccion','desglose'])url.searchParams.delete(key);
  return url.pathname+(url.searchParams.size?`?${url.searchParams}`:'');
}

export function preserveNavigationUrl(href:string,current:string):string {
  const normalized=navigationDestination(current);
  let target:URL,source:URL;try{target=new URL(href,'https://asvo.invalid');source=new URL(current,'https://asvo.invalid');}catch{return normalized??'/coordinacion';}
  if(target.origin!=='https://asvo.invalid'||!navigationDestination(target.pathname+target.search))return normalized??'/coordinacion';
  if(target.pathname!==source.pathname||!normalized)return target.pathname+target.search+target.hash;
  const criteria=new URL(normalized,'https://asvo.invalid').searchParams;
  const id=source.searchParams.get('navContext');if(id&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))criteria.set('navContext',id);
  for(const [key,value]of criteria)if(!target.searchParams.has(key))target.searchParams.set(key,value);
  return target.pathname+target.search+target.hash;
}

export function navigationResetList(before:string,after:string):string|undefined {
  const url=new URL(after,'https://asvo.invalid');
  if(url.pathname==='/coordinacion')return 'summary-attention';
  if(url.pathname==='/coordinacion/convocatorias'){
    const old=new URL(before,'https://asvo.invalid');
    return ['serieBuscar','serieTipo','serieDisponibilidad'].some(key=>old.searchParams.get(key)!==url.searchParams.get(key))?'series':'outings';
  }
  if(url.pathname==='/coordinacion/registro')return 'volunteers';
  if(url.pathname==='/coordinacion/inscripciones')return 'requests';
  if(url.pathname==='/coordinacion/informes')return 'reports';
  if(/^\/coordinacion\/salidas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(url.pathname))return 'outing-registrations';
}


export const navigationLifetime=30*60_000;
export const navigationStorePrefix='asvo:list-context:v3:';
export function navigationStoreKey(subject:string){return navigationStorePrefix+encodeURIComponent(subject);}
/** Search text can contain personal identifiers: keep its entire trail in memory only. */
export function navigationContextPersistable(context:ListContext){
  return context.frames.every(frame=>!Array.from(new URL(frame.destination,'https://asvo.invalid').searchParams).some(([key,value])=>/buscar/i.test(key)&&!!value));
}
/** Copy only navigation metadata, never arbitrary properties from form/response objects. */
export function cleanNavigationContext(value:unknown,now=Date.now()):ListContext|null {
  if(!validListContext(value,now))return null;
  return {detail:value.detail,time:value.time,frames:value.frames.map(f=>({destination:f.destination,anchor:f.anchor,offset:f.offset,y:f.y,
    ...(f.list!==undefined?{list:f.list}:{}),...(f.index!==undefined?{index:f.index}:{}),...(f.neighbors!==undefined?{neighbors:[...f.neighbors]}:{}),...(f.panelY!==undefined?{panelY:f.panelY}:{})}))};
}
export type PositionRequest={frame:NavigationFrame;origin:string|null;expires:number};
export function navigationRestorationDecision(request:PositionRequest|null,destination:string|null,{now=Date.now(),dialog=false,restorableDialog=false,errorFocus=false}={}){
  if(!request||request.expires<=now||errorFocus)return 'discard' as const;
  if(destination!==request.frame.destination)return destination===request.origin?'wait' as const:'discard' as const;
  return dialog&&!restorableDialog?'wait' as const:'restore' as const;
}
