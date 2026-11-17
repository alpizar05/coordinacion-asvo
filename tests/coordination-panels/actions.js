'use server';
// Only copied over the registrations adapter in the disposable UI tree.
export async function findRegistrationVolunteers(){return {people:[{id:'11111111-1111-4111-8111-000000000001',name:'Persona Ficticia',identification:'102340567'}],total:1};}
export async function addRegistration(){return {saved:true,status:'revisión'};}
export async function loadEditableRegistration(){return {error:'Carga ficticia no disponible.'};}
export async function saveEditedRegistration(){return {error:'Edición ficticia no disponible.'};}
export async function loadRegistrationDetail(){return {data:{general:true,entry:{volunteer:'Persona Ficticia',identification:'102340567',status:'confirmada',starts:'2035-01-10',ends:'2035-01-12',received:null,covered:true,assigned70:false,details:{}},history:{events:[],mail:[]}}};}
export async function manageRegistration(id,data){const reason=data.get('reason');if(reason==='demora')await new Promise(r=>setTimeout(r,4000));if(reason==='exito')return {saved:true};return {error:'Conflicto ficticio; no hubo persistencia.',fieldErrors:{reason:['Motivo ficticio incorrecto.']}};}
