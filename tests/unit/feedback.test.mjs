import test from 'node:test';import assert from 'node:assert/strict';
import {validateProfile} from '../../lib/profile-validation.ts';
import {fieldErrorMessages,updateFieldError} from '../../lib/form-result.ts';
import {validFormDate} from '../../lib/form-dates.mjs';
import {validateDateFilter} from '../../lib/filter-validation.ts';
import {form} from './helpers.mjs';
test('profile reports all independent corrections without mutating submitted values',()=>{
 const data=form({name:' ',surname:'',email:'mal',volunteer_year:'20',member_year:'abc',birth:'2026-02-30',medical:'sí'});
 const snapshot=[...data];const errors=validateProfile(data);
 assert.deepEqual(Object.keys(errors).sort(),['name','surname','email','volunteer_year','member_year','birth','medical_detail'].sort());assert.deepEqual([...data],snapshot);
});
test('profile accepts optional fields, leap dates and conditional medical details',()=>{
 const basic={name:'Persona',surname:'Prueba'};
 assert.deepEqual(validateProfile(form(basic)),{});
 assert.deepEqual(validateProfile(form({...basic,email:'persona@example.test',birth:'2024-02-29',volunteer_year:'2026',member_year:'2026',medical:'sí',medical_detail:'Ficticio',member:'no'})),{});
 assert.ok(validateProfile(form({...basic,birth:'2025-02-29'})).birth);
 assert.deepEqual(Object.keys(validateProfile(form({...basic,medical:'otro',member:'otro'}))).sort(),['medical','member']);
 assert.equal(validateProfile(form({...basic,medical:'no'})).medical_detail,undefined);
});
test('field corrections preserve unrelated server errors and accept multiple messages',()=>{
 const original={name:'Falta nombre',email:'Correo inválido',custom:'Error de servidor'};
 assert.deepEqual(updateFieldError(original,'name'),{email:'Correo inválido',custom:'Error de servidor'});
 assert.deepEqual(updateFieldError(original,'name','Nuevo error'),{...original,name:'Nuevo error'});
 assert.equal(original.name,'Falta nombre');assert.deepEqual(fieldErrorMessages(['Uno',' ','Dos']),['Uno','Dos']);
 assert.deepEqual(fieldErrorMessages('Mensaje'),['Mensaje']);assert.deepEqual(fieldErrorMessages(),[]);
 assert.deepEqual(updateFieldError(original,'email',['Formato','Dominio']).email,['Formato','Dominio']);assert.equal(updateFieldError(original,'email',[]).email,undefined);
});
test('ISO calendar dates reject year zero, overflow and non-ISO input',()=>{
 for(const value of ['0000-01-01','2026-02-30','2025-02-29','2035-13-01','1/1/2035',''])assert.equal(validFormDate(value),false,value);
 for(const value of ['0001-01-01','2024-02-29','2035-01-01'])assert.equal(validFormDate(value),true,value);
});
test('date filters allow open/equal ranges and associate inverted range with Hasta only',()=>{
 for(const range of [['',''],['','2035-02-01'],['2035-02-01',''],['2035-02-02','2035-02-02']])assert.deepEqual(validateDateFilter(...range),{});
 assert.deepEqual(Object.keys(validateDateFilter('2035-02-02','2035-02-01')),['hasta']);
 assert.deepEqual(Object.keys(validateDateFilter('2035-02-30','2035-02-31')),['desde','hasta']);assert.ok(validateDateFilter('0000-01-01','').desde);
});
