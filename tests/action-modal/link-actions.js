'use server';
// Deliberately malformed responses in the temporary UI copy only. No persistence.
export async function generateBrief(_id,_previous,form){
 const mode=form.get('lead');
 if(mode==='throw')throw Error('Fictitious rejection');
 if(mode==='missing')return undefined;
 if(mode==='fields')return {fieldErrors:{lead:['Revisá la persona','Selección ficticia inválida']}};
 if(mode==='contradictory')return {saved:true,link:'/fictitious-private-link',error:'No se guardó'};
 return {saved:true,link:'/fictitious-private-link'};
}
export async function createOutingInvitation(id,previous,form){return generateBrief(id,previous,form);}
export async function revokeBrief(){return {saved:true,error:'No se revocó'};}
