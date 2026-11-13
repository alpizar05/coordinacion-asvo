import {historicalIdentification} from './form-input';
import {parse} from 'csv-parse/sync';
import type {ImportKind,ImportRow} from './registry-import';
export function parseRegistryCsv(csv:string,kind:ImportKind):{rows:ImportRow[]}|{message:string}{
 if(typeof csv!=='string'||!['volunteers','policies'].includes(kind))return {message:'Seleccioná un CSV de texto válido.'};
 if(!csv.trim())return {message:'Seleccioná un CSV con datos.'};if(Buffer.byteLength(csv,'utf8')>150000)return {message:'El CSV supera el máximo de 150 KB.'};
 const required=kind==='volunteers'?['identificacion','nombre','primer_apellido','correo']:['identificacion','tipo','numero'];
 let records:{record:Record<string,string>;info:{lines:number}}[];
 try{records=parse(csv,{columns:(headers:string[])=>{if(required.some(h=>!headers.includes(h))||new Set(headers).size!==headers.length)throw Error('headers');return headers;},bom:true,skip_empty_lines:true,trim:true,info:true});}
 catch(e){const error=e as {lines?:number;column?:string;message?:string};return {message:error.message==='headers'?`Encabezados requeridos: ${required.join(', ')}. No deben repetirse.`:`No se pudo leer el CSV${error.lines?` en la fila ${error.lines}`:''}${error.column?`, columna ${error.column}`:''}. Revisá comillas, columnas y separadores.`};}
 if(!records.length)return {message:'El CSV no contiene filas de datos.'};
 const seen=new Set<string>();
 return {rows:records.map(({record:r,info},i)=>{
  const id=historicalIdentification(r.identificacion||''),issues:ImportRow['issues']=[],add=(column:string,reason:string)=>issues.push({column,reason});
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
