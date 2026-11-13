import test from 'node:test';import assert from 'node:assert/strict';
import {participationResult,participationSummary} from '../../lib/participation-rules.ts';
import {volunteerSearchTerms,volunteerListUrl} from '../../lib/volunteer-search-criteria.ts';
import {registrationLogistics} from '../../lib/registration-logistics.ts';
import {registrationChanges} from '../../lib/registration-changes.ts';
import {compactParticipationDates} from '../../lib/participation-dates.ts';
import {outingLogisticsMessage} from '../../lib/outing-logistics.ts';
import {uuid} from './helpers.mjs';
const row=extra=>({id:uuid(1),outing_id:uuid(2),outing_start:'2035-01-01',status:'confirmada',outing_status:'completada',attended:false,absent:false,lead_report:false,pending_report:false,...extra});
test('conflicting evidence beats attendance claims; historical assumptions are never real attendance',()=>{
 assert.equal(participationResult(row({attended:true,absent:true,resolution:'participo'})),'Asistencia por conciliar');
 for(const [extra,result]of [
  [{resolution:'participo'},'Participación confirmada · Conciliada'],[{resolution:'no_participo'},'No participó · Conciliado'],
  [{attended:true},'Participación confirmada'],[{absent:true},'No participó según informe'],
  [{outing_status:'cancelada'},'Salida cancelada'],[{status:'cancelada por voluntariado'},'Inscripción cancelada'],
  [{status:'rechazada'},'Inscripción rechazada'],[{status:'espera'},'En lista de espera'],[{status:'revisión'},'Inscripción pendiente'],[{status:'validación'},'Inscripción pendiente'],
  [{historical_participation:'completada'},'Participación registrada · Histórico'],[{historical_participation:'completada_asumida_demo'},'Participación asumida · Demo'],[{},'Asistencia pendiente de confirmar']])assert.equal(participationResult(row(extra)),result);
 assert.equal(participationSummary([row({historical_participation:'completada_asumida_demo'})]).attended,0);
});
test('participation summary deduplicates outings, excludes conflicts and keeps chronological last evidence without mutating input',()=>{
 assert.deepEqual(participationSummary([]),{attended:0,lead:0,pending:0,conflicts:0,last:undefined});
 const rows=[row({attended:true,lead_report:true}),row({attended:true,lead_report:true}),row({outing_id:uuid(3),outing_start:'2035-01-02',attended:true,pending_report:true}),row({outing_id:uuid(4),outing_start:'2035-01-02',attended:true}),row({outing_id:uuid(5),attended:true,absent:true,pending_report:true})];
 const original=structuredClone(rows),result=participationSummary(rows);assert.equal(result.attended,3);assert.equal(result.lead,1);assert.equal(result.pending,2);assert.equal(result.conflicts,1);assert.equal(result.last.outing_id,uuid(4));assert.deepEqual(rows,original);
});
test('transport preserves legacy unknown-seat meaning and rejects unsafe/noninteger numeric counts',()=>{
 assert.deepEqual(registrationLogistics(null),{transport:false,seats:0,legacySeats:false,food:'',other:'',interested70:false});
 assert.equal(registrationLogistics({transporte:true,ofreceTransporte:true}).legacySeats,true);
 for(const ofreceTransporte of [-1,1.5,'2',Number.MAX_SAFE_INTEGER+1])assert.equal(registrationLogistics({transporte:true,ofreceTransporte}).seats,0);
 const data=registrationLogistics({transporte:true,ofreceTransporte:2,alimentacion:' Texto ',otro:' Otro ',interes70:true});assert.equal(data.seats,2);assert.equal(data.food,'Texto');assert.equal(data.other,'Otro');assert.equal(data.interested70,true);
});
test('registration history reports changed fields and preserves legacy seat distinction',()=>{
 const before={starts:'2035-01-10',ends:'2035-01-12',status:'revisión',details:null};
 assert.equal(registrationChanges(before,before),'Sin cambios en los campos de participación.');
 const after={...before,starts:'2035-01-11',ends:'2035-01-13',status:'confirmada',details:{transporte:true,ofreceTransporte:2,alimentacion:'Texto ficticio',interes70:true,otro:'Otro',assigned70:true}};
 const changes=registrationChanges(before,after);for(const label of ['Llegada','Regreso','Estado','Transporte propio','Personas que puede llevar','Restricciones alimentarias','Interés en ser 70','Observaciones','Asignación de 70'])assert.ok(changes.includes(label));
 assert.ok(registrationChanges({...before,details:{transporte:true,ofreceTransporte:true}},after).includes('Cantidad no indicada'));
});
test('search criteria normalize accents, bound terms and encode list URLs',()=>{
 assert.deepEqual(volunteerSearchTerms(' ÉLENA   Álvarez '),['elena','alvarez']);assert.deepEqual(volunteerSearchTerms('   '),[]);
 assert.equal(volunteerSearchTerms(Array(20).fill('a').join(' ')).length,10);assert.equal(volunteerSearchTerms('x'.repeat(121))[0].length,120);
 const url=new URL(volunteerListUrl('Élena & Prueba','Control y Protección/COVIRENA',2),'http://localhost');assert.equal(url.searchParams.get('buscar'),'Élena & Prueba');assert.equal(url.searchParams.get('unidad'),'Control y Protección/COVIRENA');assert.equal(url.searchParams.get('pagina'),'2');
 assert.equal(volunteerListUrl('',''),'/coordinacion/registro');assert.ok(!volunteerListUrl('Persona','UEA',1).includes('pagina'));
});
test('date and logistics summaries keep existing presentation rules',()=>{
 assert.equal(compactParticipationDates('2035-01-10','2035-01-10'),'10 ene. 2035');assert.equal(compactParticipationDates('2035-01-10','2035-01-12'),'10–12 ene. 2035');assert.equal(compactParticipationDates('2035-01-30','2035-02-02'),'30 ene. – 2 feb. 2035');assert.equal(compactParticipationDates('2035-12-31','2036-01-01'),'31 dic. 2035 – 1 ene. 2036');
 assert.equal(outingLogisticsMessage({}), '');assert.equal(outingLogisticsMessage({transport_details:'Bus',food_details:' ',lodging_details:'Albergue'}),'Transporte: Bus\nHospedaje: Albergue');
});
