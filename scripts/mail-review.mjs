import postgres from 'postgres';
import {mailReviewInventory,resolveUncertainMail} from '../lib/mail-attempts.mjs';
const args=process.argv.slice(2);
const allowed=new Set(['mail','attempt','decision','actor','reason','evidence']);
const input={};let apply=false;
for(const arg of args){
 if(arg==='--apply'&&!apply){apply=true;continue;}
 const match=/^--([^=]+)=(.+)$/.exec(arg);
 if(!match||!allowed.has(match[1])||Object.hasOwn(input,match[1]))throw Error('Usá sin argumentos para consultar o indicá --mail, --attempt, --decision, --actor, --reason, --evidence y --apply.');
 input[match[1]]=match[2];
}
if(args.length&&!apply)throw Error('La resolución exige --apply; sin argumentos solo se consulta.');
const sql=postgres(process.env.DATABASE_URL,{max:1});
try{
 if(!apply)console.log(JSON.stringify(await mailReviewInventory(sql),null,2));
 else console.log(JSON.stringify(await resolveUncertainMail(sql,{...input,mailId:input.mail,attemptId:input.attempt})));
}catch(error){
 console.error(error?.name==='Error'?error.message:'No se pudo revisar la cola. Consultá el estado de la conexión y las migraciones; no se imprimió la respuesta de base.');process.exitCode=1;
}finally{await sql.end();}
