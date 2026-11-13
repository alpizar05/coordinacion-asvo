import test from 'node:test';import assert from 'node:assert/strict';
import {validateParticipation,validateCancellation,registrationDetails} from '../../lib/registration-validation.ts';
import {validateStaffParticipation,validateEntryManagement,validateSplitGroup} from '../../lib/staff-registration-validation.ts';
import {cancellationWarning,suggestedGroups,outingIsEditable} from '../../lib/registration-rules.ts';
import {form,schedule,uuid} from './helpers.mjs';
const valid=(extra={})=>form({identification:'102340567',starts:schedule.starts,ends:schedule.ends,...extra});
test('public identification is exactly nine digits; historical reconciliation is a distinct rule',()=>{
 assert.deepEqual(validateParticipation(valid(),schedule,true),{});
 for(const identification of ['10234056','1023405670','1-0234-0567',' 102340567','１２３４５６７８９','ABC123456'])assert.ok(validateParticipation(valid({identification}),schedule,true).identification,identification);
 assert.deepEqual(validateEntryManagement(form({identification:' demo-0001 '}),'validar'),{});
 for(const identification of ['?','abc','a'.repeat(31)])assert.ok(validateEntryManagement(form({identification}),'validar').identification);
});
test('independent errors returned together and submitted values preserved',()=>{
 const data=valid({identification:'1-234',starts:'',ends:'',transport:'on',rides:'-1',food:'x'.repeat(501),other:'x'.repeat(501)}),before=[...data];
 assert.deepEqual(Object.keys(validateParticipation(data,schedule,true)),['identification','starts','ends','rides','food','other']);assert.deepEqual([...data],before);
});
test('flexible participation includes either boundary, single days and extensions; disjoint/inverted ranges fail',()=>{
 for(const [starts,ends]of [['2035-01-10','2035-01-10'],['2035-01-15','2035-01-15'],['2035-01-09','2035-01-16'],['2035-01-09','2035-01-10']])assert.deepEqual(validateParticipation(valid({starts,ends}),schedule),{});
 assert.deepEqual(Object.keys(validateParticipation(valid({starts:'2035-01-01',ends:'2035-01-09'}),schedule)),['starts','ends']);
 assert.deepEqual(Object.keys(validateParticipation(valid({starts:'2035-01-16',ends:'2035-01-17'}),schedule)),['starts','ends']);
 assert.ok(validateParticipation(valid({ends:'2035-01-09'}),schedule).ends);
 assert.deepEqual(validateParticipation(form(),{...schedule,flexible:false}),{},'Fixed dates come from the outing on the public server path');
});
test('transport accepts zero through 100 whole seats only when transport is selected',()=>{
 for(const rides of ['0','1','100'])assert.deepEqual(validateParticipation(valid({transport:'on',rides}),schedule),{});
 for(const rides of ['','-1','1.5','101','NaN','9007199254740992'])assert.ok(validateParticipation(valid({transport:'on',rides}),schedule).rides,rides);
 assert.ok(validateParticipation(valid({transport:'otro'}),schedule).transport);
 assert.equal(validateParticipation(valid({rides:'-1'}),schedule).rides,undefined);
 assert.deepEqual(validateParticipation(valid({food:'x'.repeat(500),other:'x'.repeat(500)}),schedule),{});
});
test('cancellation requires a bounded reason and expense acknowledgement only when warned',()=>{
 assert.deepEqual(Object.keys(validateCancellation(form(),true)),['reason','acknowledge']);
 assert.ok(validateCancellation(form({reason:'x'.repeat(2001)}),false).reason);
 assert.deepEqual(validateCancellation(form({reason:'x'.repeat(2000)}),false),{});
 assert.deepEqual(validateCancellation(form({reason:'Motivo ficticio',acknowledge:'on'}),true),{});
});
test('staff selection, fixed dates, reasons and explicit out-of-range approval',()=>{
 assert.deepEqual(Object.keys(validateStaffParticipation(form({starts:'',ends:'',transport:'on',rides:'-1'}),schedule,true)).sort(),['ends','rides','starts','volunteer']);
 assert.deepEqual(validateStaffParticipation(valid({volunteer:uuid(1)}),schedule,true),{});
 assert.deepEqual(Object.keys(validateStaffParticipation(valid({starts:'2035-01-09',ends:'2035-01-16'}),{...schedule,flexible:false})),['starts','ends']);
 assert.deepEqual(validateStaffParticipation(valid(),{...schedule,flexible:false}),{});
 for(const action of ['espera','rechazar','cancelar']){assert.ok(validateEntryManagement(form(),action).reason);assert.deepEqual(validateEntryManagement(form({reason:'Justificación'}),action),{});}
 assert.deepEqual(validateEntryManagement(form(),'confirmar'),{});
 assert.ok(validateEntryManagement(form(),'confirmar','2035-01-09/2035-01-12').approveDates);
 assert.deepEqual(validateEntryManagement(form({approveDates:'2035-01-09/2035-01-12'}),'confirmar','2035-01-09/2035-01-12'),{});
});
test('split group preserves occupied places and enforces title/capacity bounds',()=>{
 assert.deepEqual(Object.keys(validateSplitGroup(form({title:'',capacity:'0'}))),['title','capacity']);
 for(const capacity of ['2','1.5','10001',''])assert.ok(validateSplitGroup(form({title:'Grupo',capacity}),3).capacity);
 assert.deepEqual(validateSplitGroup(form({title:'x'.repeat(200),capacity:'3'}),3),{});assert.ok(validateSplitGroup(form({title:'x'.repeat(201),capacity:'3'}),3).title);
 assert.deepEqual(validateSplitGroup(form({title:'Grupo',capacity:'10000'})),{});
});
test('details translation honors general-unit lead interest and does not retain transport seats when unchecked',()=>{
 assert.deepEqual(registrationDetails(valid({transport:'on',rides:'2',food:' Texto ',lead:'on',other:' Otro '}),true),{transporte:true,ofreceTransporte:2,alimentacion:'Texto',interes70:true,otro:'Otro'});
 assert.deepEqual(registrationDetails(valid({rides:'5',lead:'on'}),false),{transporte:false,ofreceTransporte:0,alimentacion:'',interes70:false,otro:''});
});
test('warning uses injected clock/window at Costa Rica midnight and inclusive threshold',()=>{
 const start=Date.parse('2035-01-10T00:00:00-06:00');
 assert.equal(cancellationWarning('2035-01-10',start-48*3600000,48),true);
 assert.equal(cancellationWarning('2035-01-10',start-48*3600000-1,48),false);
 assert.equal(cancellationWarning('2035-01-10',start+1,48),true);
 assert.equal(cancellationWarning('2035-01-10',start-24*3600000,12),false);
});
test('suggested groups are inclusive transitive date intersections without reordering input',()=>{
 const rows=[{id:'c',starts:'2035-01-14',ends:'2035-01-15'},{id:'a',starts:'2035-01-10',ends:'2035-01-12'},{id:'b',starts:'2035-01-12',ends:'2035-01-14'},{id:'d',starts:'2035-01-17',ends:'2035-01-18'}];const copy=structuredClone(rows);
 const groups=suggestedGroups(rows);assert.equal(groups.length,2);assert.deepEqual(groups[0].people.map(p=>p.id),['a','b','c']);assert.equal(groups[0].ends,'2035-01-15');assert.deepEqual(rows,copy);
 assert.deepEqual(suggestedGroups([]),[]);assert.equal(suggestedGroups([{starts:'2035-01-01',ends:'2035-01-10'},{starts:'2035-01-02',ends:'2035-01-03'}])[0].ends,'2035-01-10');
});
test('only existing editable outing states are accepted',()=>{
 for(const status of ['borrador','abierta','confirmada'])assert.equal(outingIsEditable(status),true);
 for(const status of ['cancelada','completada','desconocido'])assert.equal(outingIsEditable(status),false);
});
