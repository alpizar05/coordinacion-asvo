import {AsyncLocalStorage} from 'node:async_hooks';
export const requestContext=new AsyncLocalStorage();
export const cookies=async()=>({get:name=>requestContext.getStore()?.cookies?.[name]===undefined?undefined:{value:requestContext.getStore().cookies[name]},set(name,value,options){const context=requestContext.getStore();if(!context?.cookieWrites)throw Error('Cookie writes not allowed in this test');context.cookies??={};context.cookies[name]=value;context.cookieWrites.push({action:'set',name,value,options});},delete(name){const context=requestContext.getStore();if(!context?.cookieWrites)throw Error('Cookie writes not allowed in this test');delete context.cookies?.[name];context.cookieWrites.push({action:'delete',name});}});
export const revalidatePath=(path,type)=>{requestContext.getStore()?.effects?.push({path,type});};
export const redirect=path=>{throw Error('REDIRECT:'+path);};
export const notFound=()=>{throw Error('NOT_FOUND');};
// Only the provider transport is replaced. Actual staff(), SQL grants and policies run unchanged.
export default function NextAuth(){return {auth:async()=>null,handlers:{},signIn:async()=>{throw Error('Provider calls prohibited');},signOut:async()=>{throw Error('Provider calls prohibited');}};}

export const headers=async()=>new Headers(requestContext.getStore()?.headers??{host:'localhost:3031'});
