'use server';
// Replaces app/actions/registrations.ts only in the disposable UI copy.
let decisions=0,edits=0;
const delay=()=>new Promise(r=>setTimeout(r,1800));
export async function loadEditableRegistration(){await delay();return {data:{name:'Persona Ficticia',version:'fictitious-version',starts:'2035-01-10',ends:'2035-01-12',firstDay:'2035-01-10',lastDay:'2035-01-12',flexible:true,general:true,transport:false,seats:0,food:'fields',other:'Observación conservada',interested70:false,confirmed:true}};}
export async function saveEditedRegistration(_id,data){edits++;console.log('[manage-focus-edit] '+edits);if(data.get('food')==='delay')await delay();if(data.get('food')==='success')return {saved:true};if(data.get('food')==='general')return {error:'Conflicto general ficticio.'};return {error:'Error ficticio de edición.',fieldErrors:{food:'Revisá restricciones.',other:'Revisá observaciones.'}};}
export async function loadRegistrationDetail(){await delay();return {data:{general:true,entry:{volunteer:'Persona Ficticia',identification:'800000001',status:'confirmada',starts:'2035-01-10',ends:'2035-01-12',received:null,covered:true,assigned70:false,details:{}},history:{events:[],mail:[]}}};}
export async function manageRegistration(_id,data){decisions++;console.log('[manage-focus-decision] '+decisions);const reason=data.get('reason');if(reason==='demora')await delay();if(reason==='exito')return {saved:true};if(reason==='general')return {error:'Conflicto general ficticio.'};return {error:'Error general junto al campo.',fieldErrors:{reason:'Revisá el motivo ficticio.'}};}
