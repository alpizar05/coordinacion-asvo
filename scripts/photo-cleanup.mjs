import {registerHooks} from 'node:module';import {existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&c.parentURL&&!/\.[a-z]+$/.test(s)){const path=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(path)))return next(path.href,c);}return next(s,c);}});
const args=process.argv.slice(2);if(args.length!==1||!['--plan','--apply'].includes(args[0]))throw Error('Usá --plan (solo consulta) o --apply (limpieza explícita).');
const {sql}=await import('../lib/db.ts');
try{
 if(args[0]==='--plan')console.log(JSON.stringify(await sql`select state,count(*)::int as items from photo_upload_items group by state order by state`));
 else{const {cleanupPhotoOrphans}=await import('../lib/photo-upload-workflow.ts');const {graphPhotoStore}=await import('../lib/outing-photos.ts');console.log(JSON.stringify(await cleanupPhotoOrphans(sql,graphPhotoStore())));}
}finally{await sql.end();}
