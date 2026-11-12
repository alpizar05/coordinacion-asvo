import {validFormDate} from '../lib/form-dates.mjs';
import assert from 'node:assert/strict';
import { validateProfile } from '../lib/profile-validation.ts';
import { fieldErrorMessages, updateFieldError } from '../lib/form-result.ts';
const form = (values={}) => {
  const data=new FormData();
  for(const [key,value] of Object.entries({name:'Persona',surname:'Prueba',email:'persona@example.test',medical:'',member:'',...values})) data.set(key,value);
  return data;
};
assert.deepEqual(validateProfile(form()),{});
const data=form({name:' ',surname:'',email:'mal',volunteer_year:'20',member_year:'abc',birth:'2026-02-30',medical:'sí'});
const errors=validateProfile(data);
assert.deepEqual(new Set(Object.keys(errors)),new Set(['name','surname','email','birth','volunteer_year','member_year','medical_detail']));
assert.equal(data.get('email'),'mal','Validar no borra ni normaliza el formulario original');
assert.deepEqual(validateProfile(form({birth:'2024-02-29',volunteer_year:'2026',medical:'sí',medical_detail:'Texto ficticio'})),{});
assert.ok(validateProfile(form({birth:'2025-02-29'})).birth);
assert.ok(validateProfile(form({medical:'otro',member:'otro'})).medical);
assert.ok(validateProfile(form({medical:'otro',member:'otro'})).member);
assert.equal(validateProfile(form({medical:'no'})).medical_detail,undefined);
const previous={name:'Falta nombre',email:'Correo inválido',custom:'Error de servidor'};
assert.deepEqual(updateFieldError(previous,'name'),{email:'Correo inválido',custom:'Error de servidor'});
assert.deepEqual(updateFieldError(previous,'name','Nuevo error'),{...previous,name:'Nuevo error'});
assert.equal(previous.name,'Falta nombre','Actualizar errores no muta el estado anterior');
assert.deepEqual(fieldErrorMessages(['Primer problema','','Segundo problema']),['Primer problema','Segundo problema']);
assert.deepEqual(updateFieldError(previous,'email',['Formato inválido','Dominio inválido']).email,['Formato inválido','Dominio inválido']);
assert.equal(updateFieldError(previous,'email',[]).email,undefined);
console.log('OK: múltiples errores de ficha, fechas reales, campos condicionales, valores intactos y corrección aislada sin borrar errores ajenos.');

assert.equal(validFormDate('0000-01-01'),false);assert.equal(validFormDate('2026-02-30'),false);assert.equal(validFormDate('2024-02-29'),true);assert.equal(validFormDate('0001-01-01'),true);
