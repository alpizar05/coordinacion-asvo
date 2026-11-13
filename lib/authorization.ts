/** Application permissions only. No provider grants, sessions, IO or cross-request cache. */
export type StaffPrincipal={subject:string;grants:readonly {role:string;unit:string}[]}|null;
export type PolicyResource={unit?:string;units?:readonly string[];createdBy?:string};
type Rule='admin'|'general'|'registry'|'unit'|'operations'|'all-units'|'owned-collection';
/** Executable operation/role/resource matrix. Unknown operations deny by default. */
export const authorizationMatrix={
 'administration.read':'admin','permissions.manage':'admin',
 'volunteers.read':'registry','volunteers.correct':'admin','volunteers.units':'registry',
 'volunteers.incident':'general','policies.verify':'admin','volunteers.import':'admin','policies.import':'admin',
 'operations.read':'operations','outings.manage':'unit','outings.read':'unit','outings.create':'unit',
 'registrations.read':'unit','registrations.manage':'unit','registrations.add':'unit',
 'reports.read':'unit','reports.remind':'unit','attendance.reconcile':'unit',
 'briefs.generate':'unit','briefs.revoke':'unit','invitations.generate':'unit',
 'photos.manage':'unit','photos.gallery':'unit','photos.staff-read':'unit',
 'series.create':'operations','series.common-edit':'all-units','series.feature':'all-units',
 'collections.read':'owned-collection','demo.mail-read':'general',
} as const satisfies Record<string,Rule>;
export type StaffOperation=keyof typeof authorizationMatrix;
export function staffScope(user:StaffPrincipal){
 const grants=user?user.grants:[];
 return {general:grants.some(g=>g.role==='general'),admin:grants.some(g=>g.role==='admin'),
   units:grants.filter(g=>g.role==='unidad').map(g=>g.unit)};
}
export function allows(user:StaffPrincipal,operation:string,resource:PolicyResource={}):boolean{
 if(!user||!Object.hasOwn(authorizationMatrix,operation))return false;
 const scope=staffScope(user),unit=(name?:string)=>scope.general||!!name&&scope.units.includes(name);
 switch(authorizationMatrix[operation as StaffOperation]){
  case 'admin':return scope.admin;
  case 'general':return scope.general;
  case 'registry':return scope.general||scope.admin;
  case 'unit':return unit(resource.unit);
  case 'operations':return scope.general||scope.units.length>0;
  case 'all-units':return !!resource.units?.length&&resource.units.every(name=>unit(name));
  case 'owned-collection':return (scope.general||scope.units.length>0)&&(scope.general||resource.createdBy===user.subject);
  default:return false;
 }
}
/** Compatibility helpers preserve the old no-unit => general-only semantics. */
export const canOperate=(user:StaffPrincipal,unit?:string)=>allows(user,'outings.manage',{unit});
export const canAdminister=(user:StaffPrincipal)=>allows(user,'administration.read');
export function validPrivateToken(token:unknown):token is string{return typeof token==='string'&&/^[\w-]{43}$/.test(token);}
/** Direct PDP/photo availability deliberately does not require listed=true. */
export function allowsPublicOuting(resource:{status:string;accepting:boolean}){
 return resource.status==='abierta'&&resource.accepting===true;
}
export function allowsPhoto(user:StaffPrincipal,resource:{unit:string;status:string;accepting:boolean},access:{invitation?:boolean;receipt?:boolean}={}){
 return allowsPublicOuting(resource)||(['abierta','confirmada'].includes(resource.status)&&!!(access.invitation||access.receipt))||allows(user,'photos.staff-read',{unit:resource.unit});
}
