import 'server-only';
import {createHmac} from 'node:crypto';
import {readRateConfiguration} from './server-config.mjs';
import {abuseLimits} from './security-rules.mjs';
import type {Transaction} from './registration';
export const rateLimitMessage='Se alcanzó el límite de intentos para esta operación. Esperá unos minutos antes de volver a enviar.';
export function abuseBucket(scope:string,value:string){return 'abuse:'+scope+':'+createHmac('sha256',readRateConfiguration().secret).update(value).digest('hex');}
export async function consumeAbuseLimit(tx:Transaction,scope:string,value:string,limit:number){
 const bucket=abuseBucket(scope,value);
 const [row]=await tx`insert into attempts(bucket,slot,count) values(${bucket},floor(extract(epoch from clock_timestamp())/${abuseLimits.windowSeconds})::bigint,1)
 on conflict(bucket,slot)do update set count=attempts.count+1 returning count`;
 return row.count<=limit;
}
/** A standalone committed transaction keeps an invalid-link failure from undoing its abuse counter. */
export async function consumePrivateBudget(db:import('postgres').Sql,scope:'private'|'report',token:string,network:string|null){
 return db.begin(async tx=>{
  if(network&&!await consumeAbuseLimit(tx,scope+':network',network,abuseLimits.network))return false;
  return consumeAbuseLimit(tx,scope+':token',token,scope==='report'?abuseLimits.report:abuseLimits.privateMutation);
 });
}
