import test from 'node:test';import assert from 'node:assert/strict';
import {formText,scalarInputErrors,textValues} from '../../lib/form-input.ts';
import {validateParticipation,validateCancellation,validateRegistrationData} from '../../lib/registration-validation.ts';
import {parsePhotoMetadata} from '../../lib/photo-metadata.ts';
import {parseRegistryCsv} from '../../lib/registry-csv.ts';
import {graphAccessToken,graphItemId} from '../../lib/graph-response.mjs';
import {form,schedule,uuid} from './helpers.mjs';
test('scalar FormData refuses files and ambiguous duplicate values without modifying input',()=>{
 const f=form({starts:schedule.starts,ends:schedule.ends,transport:'on',rides:'0'});f.set('food',new File(['x'],'x.txt'));f.append('rides','1');
 const before=[...f];assert.deepEqual(Object.keys(validateParticipation(f,schedule)).sort(),['food','rides']);assert.deepEqual([...f],before);
 assert.equal(formText(f,'rides'),'');assert.equal(formText(f,'missing'),'');assert.deepEqual(textValues(f,'food'),['']);assert.deepEqual(scalarInputErrors(form({food:' Texto '}),['food']),{});
 const cancel=form({reason:new File(['x'],'reason.txt'),acknowledge:'on'});assert.ok(validateCancellation(cancel,false).reason);
});
test('typed service input is validated at runtime with the same inclusive date and transport rules',()=>{
 for(const rides of [0,100])assert.deepEqual(validateRegistrationData(schedule.starts,schedule.ends,{transporte:true,ofreceTransporte:rides},schedule),{});
 for(const rides of [-1,101,1.1,Infinity,NaN,'2'])assert.ok(validateRegistrationData(schedule.starts,schedule.ends,{transporte:true,ofreceTransporte:rides},schedule).rides);
 const bad=validateRegistrationData(null,[],{transporte:'on',alimentacion:42,otro:[],ofreceTransporte:101},schedule);for(const key of ['starts','ends','transport','food','other'])assert.ok(bad[key]);
 assert.ok(validateRegistrationData(schedule.starts,schedule.ends,null,schedule).transport);
 assert.deepEqual(validateRegistrationData('2035-01-09','2035-01-16',{},schedule),{});
 assert.ok(validateRegistrationData('2035-01-09',schedule.ends,{}, {...schedule,flexible:false}).starts);
});
test('photo JSON rejects malformed structure, keys, repeated items and independent metadata errors',()=>{
 for(const raw of [null,'{','{}','[null]','[[]]','[1]',JSON.stringify(Array(7).fill({}))])assert.ok(Object.keys(parsePhotoMetadata(raw).fieldErrors).length);
 const photo={key:uuid(1),kind:'gallery',id:uuid(1),alt:'Foto ficticia',credit:''};assert.deepEqual(parsePhotoMetadata(JSON.stringify([photo])).fieldErrors,{});
 assert.ok(parsePhotoMetadata(JSON.stringify([photo,photo])).fieldErrors.photos);
 assert.ok(Object.keys(parsePhotoMetadata(JSON.stringify([photo,{...photo,key:'otra'}])).fieldErrors).length);
 const errors=parsePhotoMetadata(JSON.stringify([{key:'new-1',kind:'upload',alt:{},credit:42,permission:'true'}])).fieldErrors;
 for(const key of ['new-1-alt','new-1-credit','new-1-permission'])assert.ok(errors[key]);
 assert.deepEqual(parsePhotoMetadata(JSON.stringify([{key:'new-1',kind:'upload',alt:'Foto',credit:'',permission:true}])).fieldErrors,{});
 assert.ok(parsePhotoMetadata(JSON.stringify([{...photo,key:'../file'}])).fieldErrors.photos);
 assert.ok(parsePhotoMetadata(JSON.stringify([{...photo,kind:'unknown'}])).fieldErrors.photos);
});
test('CSV validates runtime types, header structure, rows, duplicate keys and column diagnostics',()=>{
 for(const csv of [null,{},new File(['x'],'a.csv'),'','x'.repeat(150001),'identificacion,nombre\n1,a','identificacion,nombre,primer_apellido,correo,correo\n1,a,b,c,d'])assert.ok(parseRegistryCsv(csv,'volunteers').message);
 assert.ok(parseRegistryCsv('a','unknown').message);
 const csv='identificacion,nombre,primer_apellido,correo\n102340567,Persona,Ficticia,a@example.test\n102340567,Otra,Ficticia,mal\n?,,,';
 const {rows}=parseRegistryCsv(csv,'volunteers');assert.equal(rows[0].valid,true);assert.equal(rows[1].valid,false);assert.equal(rows[1].line,3);assert.deepEqual(rows[1].issues.map(i=>i.column),['correo','identificacion']);assert.ok(rows[2].issues.length>=3);
 const policies=parseRegistryCsv('identificacion,tipo,numero\n102340567,DEMO,001\n102340568,,','policies').rows;assert.equal(policies[0].valid,true);assert.equal(policies[1].valid,false);
 assert.ok(parseRegistryCsv('identificacion,tipo,numero\n"broken','policies').message);
});
test('Graph response readers fail closed on malformed successful responses without disclosing payload',()=>{
 for(const value of [null,[],{},'secret',{access_token:3},{access_token:''},{access_token:'a\r\nb'},{access_token:'a b'}])assert.throws(()=>graphAccessToken(value),/respuesta de autenticación inválida/);
 assert.equal(graphAccessToken({access_token:'opaque.test-token',unused:true}),'opaque.test-token');
 for(const value of [null,[],{},'id',{id:[]},{id:''},{id:'bad\n'}])assert.throws(()=>graphItemId(value),/identificador/);
 assert.equal(graphItemId({id:'opaque-id'}),'opaque-id');
});

test('other shared validators reject File-as-text and duplicate controls; draft reports reject malformed types',async()=>{
 const {validateProfile}=await import('../../lib/profile-validation.ts');const {validateRegistryForm}=await import('../../lib/registry-validation.ts');const {validateReport}=await import('../../lib/outing-report-validation.ts');
 const f=form({name:'Persona',surname:'Ficticia',email:new File(['x'],'a.txt')});assert.ok(validateProfile(f).email);
 f.set('name','Persona');f.append('name','Otra');assert.ok(validateProfile(f).name);
 assert.ok(validateRegistryForm(form({description:new File(['x'],'a.txt'),occurred_on:'2035-01-01'}),'incident').description);
 const errors=validateReport({labour:[],location:{},actions:null,host:4,observations:[],activity:'',starts:'',ends:''},[{}],'yes',true);
 for(const name of ['location','actions','host','observations','participants','accuracy'])assert.ok(errors[name]);
});
