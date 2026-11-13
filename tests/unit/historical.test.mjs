import test from 'node:test';import assert from 'node:assert/strict';
import {planHistoricalImport,safeBetaEmail,photoForOuting} from '../../lib/historical-import-plan.mjs';
import {uuid} from './helpers.mjs';
function fixture(){
 const people=Array.from({length:17},(_,i)=>({id:uuid(i+1),identification:String(800000000+i)}));
 const entries=people.map((person,i)=>({id:uuid(100+i),volunteer_id:person.id,identification:person.identification,outing_id:uuid(50),starts:'2026-01-10',ends:'2026-01-12',demo_generated:true,status_candidate:'confirmada',received_at:null}));
 const report={id:uuid(200),group_links:[{outing_id:uuid(50),confidence:'Fuerte'}],valid_date_range:true,starts_original_iso:'2026-01-10',ends_original_iso:'2026-01-12'};
 const outing={id:uuid(50),request_id:uuid(40),starts:'2026-01-10',ends:'2026-01-12',location:'Estación Robles-Kaufman',title:'DEMO',registration_ids:entries.map(r=>r.id),lead70:true,lead70_candidates:[{report_id:report.id,registration_id:entries[0].id,volunteer_id:people[0].id}]};
 return {format:'asvo-historical-migration-staging',version:3,migration_contract:{demo:true},volunteers:people,requests:[{id:uuid(40)}],outings:[outing],registrations:entries,reports:[report]};
}
const plan=data=>planHistoricalImport(data,Buffer.from('fixture sintético; ningún dato privado'),'2026-11-12');
test('synthetic import preserves demo provenance, strong lead links and private non-open defaults',()=>{
 const data=fixture(),copy=structuredClone(data),result=plan(data);
 assert.equal(result.summary.people,17);assert.equal(result.summary.demoRegistrations,17);assert.equal(result.summary.originalRegistrations,0);assert.equal(result.operational.length,1);assert.equal(result.staged.length,0);assert.equal(result.leadIds.size,1);
 assert.equal(result.outings[0].status,'completada');assert.equal(result.outings[0].capacity,17);assert.equal(result.outings[0].listed,false);assert.equal(result.outings[0].photo,'tortuguero');assert.equal(result.summary.unitFallback,1);assert.deepEqual(data,copy);
});
test('probable, ambiguous and invalid-date reports stay staged rather than becoming definitive',()=>{
 for(const change of [r=>{r.group_links[0].confidence='Probable';},r=>{r.group_links.push({...r.group_links[0]});},r=>{r.valid_date_range=false;},r=>{r.starts_original_iso=null;}]){
  const data=fixture();change(data.reports[0]);const result=plan(data);assert.equal(result.operational.length,0);assert.equal(result.staged.length,1);assert.ok(result.staged[0].reasons.length);
 }
 const data=fixture();data.outings[0].lead70_candidates=[];assert.equal(plan(data).staged.length,1);
});
test('historic contracts, duplicates, authorization count, relationships and dates fail independently',()=>{
 for(const change of [
  d=>{d.version=2;},d=>{d.volunteers.push(d.volunteers[0]);},d=>{d.registrations.push(d.registrations[0]);},
  d=>{d.registrations[0].demo_generated=false;},d=>{d.registrations[0].volunteer_id=uuid(999);},
  d=>{d.registrations[0].ends='2026-01-01';},d=>{d.outings[0].request_id=uuid(999);},
  d=>{d.outings[0].registration_ids.push(uuid(999));},d=>{d.outings[0].lead70_candidates[0].registration_id=uuid(999);},
 ]){const data=fixture();change(data);assert.throws(()=>plan(data));}
 const original=fixture();original.registrations.push({...original.registrations[0],id:uuid(300),demo_generated:false,received_at:null});assert.throws(()=>plan(original),/recepción ausente/);
});
test('historical statuses and capacity never fabricate public availability',()=>{
 const cancelled=fixture();for(const row of cancelled.registrations)row.status_candidate='cancelada';assert.equal(plan(cancelled).outings[0].status,'cancelada');assert.equal(plan(cancelled).outings[0].capacity,1);
 const future=fixture();future.outings[0].ends='2035-01-12';future.outings[0].unit_candidate='UEA';assert.equal(plan(future).outings[0].status,'confirmada');assert.equal(plan(future).summary.unitFallback,0);
 const noLead=fixture();noLead.outings[0].lead70=false;noLead.registrations[0].legacy_status='completada';assert.equal(plan(noLead).outings[0].status,'completada');
});
test('email allowance is explicit and photo assignment uses place before unit',()=>{
 assert.equal(safeBetaEmail(null,'1',new Set()),null);assert.equal(safeBetaEmail(' a@example.org ','1',new Set()),'a@example.org.test');assert.equal(safeBetaEmail('a@EXAMPLE.TEST','1',new Set()),'a@EXAMPLE.TEST');assert.equal(safeBetaEmail('allowed@example.org','DEMO',new Set(['DEMO'])),'allowed@example.org');
 for(const [location,unit,photo]of [['Montezuma','UEA','montezuma'],['Tortuguero','BRIF','tortuguero'],['Lugar','UEA','uea'],['Lugar','BRIF','brif'],['Lugar','Control y Protección/COVIRENA','covirenas'],['Lugar','General','general']])assert.equal(photoForOuting({location,title:''},unit),photo);
});
