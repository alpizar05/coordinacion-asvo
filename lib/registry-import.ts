import {parse} from 'csv-parse/sync';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {FormResult} from './form-result';
import {audit,field,identification,type Transaction} from './registration';
export type ImportKind='volunteers'|'policies';
export type ImportRow={key:string;line:number;id:string;name:string;surname:string;email:string;kind:string;number:string;valid:boolean;checked:boolean;state:string;issues:{column:string;reason:string}[];current?:{id:string;name:string;surname:string;email:string|null};version:string};
export type ImportPreview=FormResult & {rows?:ImportRow[];token?:string};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function signature(value:string){const secret=process.env.AUTH_SECRET||(process.env.ASVO_DEMO==='1'&&process.env.NODE_ENV==='development'?'local-demo-import':null);if(!secret)throw Error('No está configurada la firma de previsualizaciones.');return createHmac('sha256',secret).update(value).digest('hex');}
function parseRows(csv:string,kind:ImportKind):{rows:ImportRow[]}|{message:string}{
 if(!csv.trim())return {message:'Seleccioná un CSV con datos.'};if(Buffer.byteLength(csv,'utf8')>150000)return {message:'El CSV supera el máximo de 150 KB.'};
 const required=kind==='volunteers'?['identificacion','nombre','primer_apellido','correo']:['identificacion','tipo','numero'];
 let records:{record:Record<string,string>;info:{lines:number}}[];
 try{records=parse(csv,{columns:(headers:string[])=>{if(required.some(h=>!headers.includes(h))||new Set(headers).size!==headers.length)throw Error('headers');return headers;},bom:true,skip_empty_lines:true,trim:true,info:true});}
 catch(e){const error=e as {lines?:number;column?:string;message?:string};return {message:error.message==='headers'?`Encabezados requeridos: ${required.join(', ')}. No deben repetirse.`:`No se pudo leer el CSV${error.lines?` en la fila ${error.lines}`:''}${error.column?`, columna ${error.column}`:''}. Revisá comillas, columnas y separadores.`};}
 if(!records.length)return {message:'El CSV no contiene filas de datos.'};
 const seen=new Set<string>();
 return {rows:records.map(({record:r,info},i)=>{
  const id=identification(r.identificacion||''),issues:ImportRow['issues']=[],add=(column:string,reason:string)=>issues.push({column,reason});
  if(!/^[A-Z0-9]{4,30}$/.test(id))add('identificacion','Identificación inválida.');
  if(kind==='volunteers'){
   if(!r.nombre||r.nombre.length>200)add('nombre','Indicá un nombre de hasta 200 caracteres.');
   if(!r.primer_apellido||r.primer_apellido.length>200)add('primer_apellido','Indicá un apellido de hasta 200 caracteres.');
   if(r.correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.correo))add('correo','Correo inválido.');
  }else{
   if(!r.tipo||r.tipo.length>200)add('tipo','Indicá un tipo de póliza de hasta 200 caracteres.');
   if(!r.numero||r.numero.length>200)add('numero','Indicá un número de póliza de hasta 200 caracteres.');
  }
  const key=kind==='volunteers'?id:`${id}/${r.tipo}/${r.numero}`;
  if(seen.has(key))add('identificacion','Registro repetido dentro del archivo.');seen.add(key);
  return {key:String(i),line:info.lines,id,name:r.nombre||'',surname:r.primer_apellido||'',email:r.correo||'',kind:r.tipo||'',number:r.numero||'',issues,valid:!issues.length,checked:false,state:'',version:''};
 })};
}
export async function prepareRegistryImport(tx:Transaction,csv:string,kind:ImportKind):Promise<ImportPreview>{
 const parsed=parseRows(csv,kind);if('message'in parsed)return {fieldErrors:{csv:parsed.message}};
 const rows=parsed.rows;
 const ids=rows.map(r=>r.id);
 const known=await tx`select id,identification,name,surname,email from volunteers where identification=any(${ids}::text[])order by id`;
 for(const row of rows){
  const current=known.find(p=>p.identification===row.id);
  if(current)row.current={id:String(current.id),name:String(current.name),surname:String(current.surname),email:current.email};
  row.version=hash(JSON.stringify(row.current||null));
  if(kind==='policies'&&!current){row.issues.push({column:'identificacion',reason:'No hay coincidencia en el registro de personas voluntarias.'});row.valid=false;}
  row.state=!row.valid?'Inválida':current?(kind==='policies'?'Póliza pendiente':'Coincidencia'):'Alta';
  row.checked=row.valid&&(kind==='policies'||!current);
 }
 // Signed against the original file and the state actually previewed, without writing a preview record.
 const payload=JSON.stringify({kind,csv:hash(csv),versions:rows.map(r=>r.version)});
 return {rows,token:signature(payload)};
}
export async function applyRegistryImport(tx:Transaction,form:FormData,kind:ImportKind,actor:string):Promise<FormResult>{
 const csv=String(form.get('csv')??'');
 const parsed=parseRows(csv,kind);if('message'in parsed)return {fieldErrors:{csv:parsed.message}};
 const selected=form.getAll('selected').map(String),errors:Record<string,string>={};
 if(!selected.length)errors.selected='Seleccioná al menos una fila válida.';
 if(field(form,'confirm')!=='on')errors.confirm='Confirmá que revisaste las filas seleccionadas.';
 // Serializes overlapping imports, so a retry can be compared after the first transaction commits.
 await tx`select pg_advisory_xact_lock(7162032026)`;
 const preview=await prepareRegistryImport(tx,csv,kind);if(!preview.rows||!preview.token)return preview;
 const rows=preview.rows;
 if(selected.some(key=>!rows.some(r=>r.key===key&&r.valid)))errors.selected='La selección contiene filas inválidas. Corregí el archivo o desmarcá esas filas.';
 if(Object.keys(errors).length)return {fieldErrors:errors};
 const supplied=field(form,'preview');
 const actual=preview.token;
 if(supplied.length!==actual.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(actual))){
  // A retry of an already applied plan is harmless if every selected row is already identical.
  const identical=selected.every(key=>{const r=rows.find(r=>r.key===key)!;return kind==='volunteers'&&r.current&&r.current.name===r.name&&r.current.surname===r.surname&&(r.current.email||'')===r.email;});
  if(!identical)return {error:'El registro cambió o falta una previsualización válida. Volvé a revisar el CSV antes de confirmar.'};
  // Still require a signature from an authentic prior preview, even for no-op rows.
  const originals=field(form,'versions');
  let versions:unknown;try{versions=JSON.parse(originals);}catch{return {error:'La previsualización no es válida.'};}
  if(!Array.isArray(versions)||versions.length!==rows.length||signature(JSON.stringify({kind,csv:hash(csv),versions}))!==supplied)return {error:'La previsualización no es válida.'};
  return {saved:true};
 }
 // Lock affected people and recheck the snapshot after acquiring locks against non-import edits.
 for(const row of rows.filter(r=>selected.includes(r.key)&&r.current))await tx`select id from volunteers where id=${row.current!.id} for update`;
 const locked=await prepareRegistryImport(tx,csv,kind);if(locked.token!==actual)return {error:'El registro cambió durante la aplicación. Volvé a previsualizar el archivo.'};
 for(const row of rows.filter(r=>selected.includes(r.key))){
  if(kind==='volunteers'){
   if(row.current){
    if(row.current.name===row.name&&row.current.surname===row.surname&&(row.current.email||'')===row.email)continue;
    const [updated]=await tx`update volunteers set name=${row.name},surname=${row.surname},email=${row.email||null} where id=${row.current.id} returning id`;
    await audit(tx,actor,'Actualizó ficha',updated.id);
   }else{
    const [added]=await tx`insert into volunteers(identification,name,surname,email)values(${row.id},${row.name},${row.surname},${row.email||null})on conflict do nothing returning id`;
    if(!added)throw Error('El registro cambió durante la importación.');
    await audit(tx,actor,'Importó ficha',added.id);
   }
  }else{
   const [policy]=await tx`insert into policies(volunteer_id,kind,number)values(${row.current!.id},${row.kind},${row.number})on conflict do nothing returning id`;
   if(policy)await audit(tx,actor,'Importó póliza pendiente',policy.id);
  }
 }
 return {saved:true};
}
