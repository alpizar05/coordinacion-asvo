'use server';
// Synthetic results only; these actions replace imports in a disposable UI tree.
let adds=0,edits=0;
export async function findRegistrationVolunteers(){return {people:[{id:'11111111-1111-4111-8111-111111111111',name:'Persona Ficticia',identification:'800000001'}],total:1};}
export async function loadEditableRegistration(){return {data:{name:'Persona Ficticia',version:'fictitious-version',starts:'2035-01-10',ends:'2035-01-12',firstDay:'2035-01-10',lastDay:'2035-01-12',flexible:true,general:true,transport:false,seats:0,food:'fields',other:'Conservar observación',interested70:false}};}
async function response(data,count){
 const mode=data.get('food');
 if(mode==='fields')return {error:'General ficticio junto a campos',fieldErrors:{starts:['Primera corrección','Segunda corrección'],other:'Revisá la observación'}};
 if(mode==='missing')return undefined;
 if(mode==='null')return null;
 if(mode==='array')return [];
 if(mode==='string')return 'OK';
 if(mode==='empty-errors')return {fieldErrors:{starts:[]}};
 if(mode==='truthy')return {saved:'true',status:'revisión'};
 if(mode==='contradictory')return {saved:true,status:'espera',error:'No se guardó'};
 if(mode==='no-status')return {saved:true};
 if(mode==='invalid-status')return {saved:true,status:'confirmada'};
 if(mode==='throw')throw Error('Fictitious rejected operation');
 if(mode==='delay'){await new Promise(resolve=>setTimeout(resolve,3000));return {error:`Respuesta demorada ficticia. Invocación ${count}`};}
 return {saved:true,status:mode==='wait'?'espera':'revisión'};
}
export async function addRegistration(_id,data){adds++;console.log('[staff-ui-add] '+adds);return response(data,adds);}
export async function saveEditedRegistration(_id,data){edits++;console.log('[staff-ui-edit] '+edits);return response(data,edits);}
