import { createHash } from 'node:crypto';
export const BETA_IDENTIFICATIONS = new Set((process.env.BETA_IMPORT_ALLOWED_IDENTIFICATIONS || '').split(',').map(value=>value.trim()).filter(Boolean));
export const safeBetaEmail = (email, identification, allowed = BETA_IDENTIFICATIONS) => {
  if (!email?.trim()) return null;
  const value=email.trim();
  return allowed.has(identification) || value.toLowerCase().endsWith('.test') ? value : `${value}.test`;
};
export const photoKeys=['montezuma','general','tortuguero','uea','covirenas','brif'];
export function photoForOuting(outing,unit) {
  const location=`${outing.location} ${outing.title}`.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  if(location.includes('montezuma'))return 'montezuma';
  if(location.includes('tortuguero') || location.includes('robles-kaufman'))return 'tortuguero';
  return unit==='UEA'?'uea':unit==='BRIF'?'brif':unit==='Control y Protección/COVIRENA'?'covirenas':'general';
}
export function planHistoricalImport(data, bytes, today) {
  if(data.format!=='asvo-historical-migration-staging' || data.version!==3 || !data.migration_contract)throw new Error('Contrato o versión no compatible');
  const hash=createHash('sha256').update(bytes).digest('hex');
  const batch=`voluntariado-2026-v3-${hash.slice(0,16)}`;
  const index=(rows,key='id')=>{
    const map=new Map(rows.map(row=>[row[key],row]));
    if(map.size!==rows.length)throw new Error(`Referencias duplicadas: ${key}`);
    return map;
  };
  const people=index(data.volunteers),byIdentification=index(data.volunteers,'identification'),outings=index(data.outings),requests=index(data.requests),registrations=index(data.registrations),reports=index(data.reports);
  if(data.registrations.filter(r=>r.demo_generated).length!==17)throw new Error('Cantidad de inscripciones demo no autorizada');
  for(const r of data.registrations){
    if(!outings.has(r.outing_id)||people.get(r.volunteer_id)?.identification!==r.identification)throw new Error('Relación de inscripción inválida');
    if(!r.starts||!r.ends||r.starts>r.ends)throw new Error('Fechas de inscripción inválidas');
    if(!r.received_at&&!r.demo_generated)throw new Error('Fecha original de recepción ausente');
  }
  const effectiveOutings=data.outings.map(o=>{
    if(!requests.has(o.request_id)||!o.starts||!o.ends||o.starts>o.ends)throw new Error('Convocatoria inválida');
    const entries=o.registration_ids.map(id=>registrations.get(id));
    if(entries.some(r=>!r||r.outing_id!==o.id))throw new Error('Miembros de convocatoria inválidos');
    const historical=entries.some(r=>r.legacy_status==='completada');
    const active=entries.filter(r=>r.status_candidate==='confirmada').length;
    const status=entries.length && !active ? 'cancelada' : o.ends<today && (historical||o.lead70) ? 'completada' : 'confirmada';
    const unit=o.unit_candidate || 'Voluntariado General';
    return {...o,unit,status,capacity:Math.max(1,active),flexible:false,listed:false,photo:photoForOuting(o,unit),
      assumptions:{unit_fallback:!o.unit_candidate,capacity:'Valor técnico DEMO: máximo entre 1 e inscripciones confirmadas; no acredita cupo autorizado.',flexible:'false técnico; modalidad original no consta.',status:'Estado operativo DEMO derivado del cierre del periodo, estados individuales e informe fuerte; estado original íntegro en staging.',private:true}};
  });
  const operational=[],staged=[];
  for(const report of data.reports){
    const strong=report.group_links.filter(link=>link.confidence==='Fuerte');
    const reasons=[];
    if(strong.length!==1)reasons.push(strong.length?'Informe con varios grupos fuertes: requiere consolidación/asociación.':'Sin vínculo fuerte con una convocatoria.');
    if(!report.valid_date_range)reasons.push('Rango de fecha/hora original inválido; no se corrige.');
    const outing=strong.length===1?outings.get(strong[0].outing_id):null;
    const lead=outing?.lead70_candidates.find(c=>c.report_id===report.id);
    const registration=lead&&registrations.get(lead.registration_id);
    if(strong.length===1&&(!registration||registration.outing_id!==outing.id||registration.volunteer_id!==lead.volunteer_id))reasons.push('Responsable sin inscripción verificable en ese grupo.');
    if(!report.starts_original_iso||!report.ends_original_iso)reasons.push('Fechas ausentes.');
    if(reasons.length)staged.push({report,reasons});
    else operational.push({report,outing,lead,registration});
  }
  const leadIds=new Set(effectiveOutings.flatMap(o=>o.lead70_candidates.map(c=>c.registration_id)));
  for(const id of leadIds)if(!registrations.has(id))throw new Error('70 sin inscripción');
  return {batch,hash,today,data,people,byIdentification,outings:effectiveOutings,operational,staged,leadIds,
    summary:{people:people.size,requests:requests.size,outings:outings.size,registrations:registrations.size,
      originalRegistrations:data.registrations.filter(r=>!r.demo_generated).length,demoRegistrations:data.registrations.filter(r=>r.demo_generated).length,
      reports:reports.size,operationalReports:operational.length,stagedReports:staged.length,
      strongLinks:data.reports.flatMap(r=>r.group_links).filter(l=>l.confidence==='Fuerte').length,
      probableLinks:data.reports.flatMap(r=>r.group_links).filter(l=>l.confidence==='Probable').length,
      assigned70:leadIds.size,unitFallback:effectiveOutings.filter(o=>o.assumptions.unit_fallback).length,
      photoAssignments:Object.fromEntries(photoKeys.map(key=>[key,effectiveOutings.filter(o=>o.photo===key).length])),
      statuses:Object.fromEntries([...new Set(effectiveOutings.map(o=>o.status))].map(key=>[key,effectiveOutings.filter(o=>o.status===key).length]))}};
}
