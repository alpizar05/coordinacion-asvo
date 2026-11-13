import test from 'node:test';import assert from 'node:assert/strict';
import {allows,canOperate,canAdminister,staffScope,authorizationMatrix,allowsPhoto,allowsPublicOuting,validPrivateToken} from '../../lib/authorization.ts';
const user=(roles=[])=>({subject:'fictitious-user',grants:roles});
const admin=user([{role:'admin',unit:''}]),general=user([{role:'general',unit:''}]),brif=user([{role:'unidad',unit:'BRIF'}]);
test('compatibility policies match the former predicates across grants, combinations and units',()=>{
 const choices=[{role:'admin',unit:''},{role:'general',unit:''},{role:'unidad',unit:'BRIF'},{role:'unidad',unit:'UEA'},{role:'unknown',unit:'BRIF'},{role:'unidad',unit:''}];
 for(let mask=0;mask<64;mask++)for(const unit of [undefined,'','BRIF','UEA','Voluntariado General','unknown']){
  const actor=user(choices.filter((_,i)=>mask&(1<<i)));
  const old=!!actor.grants.some(g=>g.role==='general'||(unit&&g.role==='unidad'&&g.unit===unit));
  assert.equal(canOperate(actor,unit),old);assert.equal(canAdminister(actor),actor.grants.some(g=>g.role==='admin'));
 }
 assert.equal(canOperate(null,'BRIF'),false);assert.equal(canAdminister(null),false);assert.deepEqual(staffScope(null),{general:false,admin:false,units:[]});
});
test('matrix denies unknown operations and unsigned actors; admin never implicitly coordinates',()=>{
 for(const operation of Object.keys(authorizationMatrix))assert.equal(allows(null,operation,{unit:'BRIF',units:['BRIF'],createdBy:'fictitious-user'}),false);
 for(const operation of ['unknown','toString','__proto__','constructor'])assert.equal(allows(general,operation),false);
 for(const operation of ['volunteers.correct','policies.verify','volunteers.import','policies.import','permissions.manage','administration.read']){
  assert.equal(allows(admin,operation),true);assert.equal(allows(general,operation),false);assert.equal(allows(brif,operation),false);
 }
 for(const operation of ['volunteers.read','volunteers.units']){assert.equal(allows(admin,operation),true);assert.equal(allows(general,operation),true);assert.equal(allows(brif,operation),false);}
 assert.equal(allows(admin,'volunteers.incident'),false);assert.equal(allows(general,'volunteers.incident'),true);
 for(const [op,rule]of Object.entries(authorizationMatrix))if(rule==='unit'){
  assert.equal(allows(admin,op,{unit:'BRIF'}),false);assert.equal(allows(general,op,{unit:'UEA'}),true);
  assert.equal(allows(brif,op,{unit:'BRIF'}),true);assert.equal(allows(brif,op,{unit:'UEA'}),false);assert.equal(allows(brif,op),false);
 }
 assert.equal(allows(user(), 'operations.read'),false);assert.equal(allows(brif,'operations.read'),true);
 assert.equal(allows(user([{role:'unknown',unit:'BRIF'}]),'operations.read'),false);
});
test('all blocks are required for series changes; manual collections preserve owner constraint',()=>{
 assert.equal(allows(brif,'series.common-edit',{units:['BRIF']}),true);assert.equal(allows(brif,'series.common-edit',{units:['BRIF','UEA']}),false);
 assert.equal(allows(general,'series.common-edit',{units:[]}),false);assert.equal(allows(general,'series.feature'),false);
 assert.equal(allows(general,'series.feature',{units:['BRIF','UEA']}),true);
 assert.equal(allows(brif,'collections.read',{createdBy:brif.subject}),true);assert.equal(allows(brif,'collections.read',{createdBy:'other'}),false);
 assert.equal(allows(general,'collections.read',{createdBy:'other'}),true);assert.equal(allows(admin,'collections.read',{createdBy:admin.subject}),false);
 assert.equal(allows(user([{role:'general',unit:''},{role:'admin',unit:''}]),'volunteers.correct'),true);
});
test('photos keep direct public access, active scoped capabilities and staff unit restrictions',()=>{
 const resource={unit:'UEA',status:'abierta',accepting:true};assert.equal(allowsPublicOuting(resource),true);assert.equal(allowsPhoto(null,resource),true);
 const closed={...resource,accepting:false};assert.equal(allowsPhoto(null,closed),false);assert.equal(allowsPhoto(brif,closed),false);assert.equal(allowsPhoto(general,closed),true);assert.equal(allowsPhoto(admin,closed),false);
 assert.equal(allowsPhoto(null,closed,{receipt:true}),true);assert.equal(allowsPhoto(null,{...closed,status:'confirmada'},{invitation:true}),true);
 assert.equal(allowsPhoto(null,{...closed,status:'cancelada'},{receipt:true,invitation:true}),false);
 assert.equal(allowsPhoto(general,{...closed,status:'cancelada'}),true);
 for(const token of [null,undefined,{},'', 'a'.repeat(42),'a'.repeat(44),'a'.repeat(42)+'?'])assert.equal(validPrivateToken(token),false);
 assert.equal(validPrivateToken('a'.repeat(43)),true);
});
