import {preparePhoto, graphPhotoStore} from "./outing-photos";
import {withPhotoUploads} from "./photo-upload-workflow";
import {authorizeCreationPhotos, saveOutingCreation} from "./outing-creation";
import {sql} from "./db";

export async function createStaffOuting(sql:import("postgres").Sql,principal:NonNullable<import("./authorization").StaffPrincipal>,form:FormData){
 const files=[...form].filter((entry):entry is [string,File]=>/^photo-\d+$/.test(entry[0])&&entry[1] instanceof File).map(([key,file])=>({key:`new-${key.slice(6)}`,file}));
 const result=await withPhotoUploads({sql,principal,scope:'create-outing',form,files,prepare:preparePhoto,store:graphPhotoStore(),
  authorize:(tx,user)=>authorizeCreationPhotos(tx,form,user),
  validate:(tx,user)=>saveOutingCreation(tx,form,user,{preflightOnly:true}),
  commit:async(tx,user,uploads,snapshot)=>saveOutingCreation(tx,form,user,{uploads,expectedSnapshot:(snapshot as {snapshot:string}).snapshot}),
 });
 return result.destination!;
}
