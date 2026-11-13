import {formText as val,scalarInputErrors,textValues} from './form-input';
import {parsePhotoMetadata} from './photo-metadata';
import {validFormDate as date} from './form-dates.mjs';
import type {FieldErrors} from './form-result';
import {commonOutingFields,supportRequestFields} from './collection-fields';
import {outingLogisticsFields} from './outing-logistics';

export function validatePhoto(form:FormData,{mode='upload',maxBytes=3.75*1024*1024,authorized=false}:{mode?:string;maxBytes?:number;authorized?:boolean}={}):FieldErrors{
 const e:FieldErrors={...scalarInputErrors(form,['alt','credit','permission','photoId'])},file=form.get('photo');
 if(form.getAll('photo').length>1)e.photo='Seleccioná un único archivo.';
 if(!val(form,'alt')||val(form,'alt').length>240)e.alt='Indicá una descripción de hasta 240 caracteres.';
 if(val(form,'credit').length>150)e.credit='Usá hasta 150 caracteres para el crédito.';
 if(mode==='upload'){
  if(!(file instanceof File)||!file.size||!['image/jpeg','image/png','image/webp'].includes(file.type))e.photo='Elegí un archivo JPG, PNG o WebP válido.';
  else if(file.size>Math.min(3*1024*1024,maxBytes))e.photo='La imagen supera el límite de 3 MB por archivo o 3,75 MB en conjunto.';
  if(!authorized&&val(form,'permission')!=='on')e.permission='Confirmá la autorización para publicar esta foto.';
 }else if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(val(form,'photoId')))e.photoId='Seleccioná una foto válida de la galería.';
 return {...e,...scalarInputErrors(form,['alt','credit','permission','photoId'])};
}
export function validateNewOuting(f:FormData):FieldErrors{
 const e:FieldErrors={};for(const n of ['title','location'])if(!val(f,n)||val(f,n).length>240)e[n]='Completá este campo usando hasta 240 caracteres.';
 if(!val(f,'unit'))e.unit='Seleccioná una unidad.';
 const starts=textValues(f,'starts'),ends=textValues(f,'ends'),ids=textValues(f,'periodId'),seen=new Set();
 if(!starts.length||starts.length>24||starts.length!==ends.length)e.dates='Ingresá entre 1 y 24 periodos completos.';
 starts.forEach((s,i)=>{const prefix=`period-${ids[i]||i}`,end=ends[i]||'';if(!date(s))e[`${prefix}-starts`]=`Periodo ${i+1}: indicá una llegada válida.`;if(!date(end)||date(s)&&end<s)e[`${prefix}-ends`]=`Periodo ${i+1}: revisá el regreso.`;if(date(s)&&date(end)){if(seen.has(s+'/'+end))e[`${prefix}-starts`]=`Periodo ${i+1}: este rango está repetido.`;seen.add(s+'/'+end);}});
 const capacity=Number(val(f,'capacity'));if(!Number.isSafeInteger(capacity)||capacity<1||capacity>10000)e.capacity='Ingresá entre 1 y 10 000 cupos.';
 for(const item of [...outingLogisticsFields,...commonOutingFields.filter(f=>f.multiline),...supportRequestFields])if(val(f,item.name).length>5000)e[item.name]='Usá hasta 5000 caracteres.';
 const deadline=val(f,'registrationDeadline');if(deadline&&(!date(deadline)||starts.some(s=>date(s)&&deadline>s)))e.registrationDeadline='El cierre debe ser igual o anterior al inicio de cada periodo.';
 const copied=textValues(f,'copyPhoto'),files=[...f.entries()].filter(([k])=>/^photo-\d+$/.test(k));
 if(copied.some(id=>!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)))e.photos='Seleccioná fotos válidas de la galería.';
 if(copied.length+files.length>6||new Set(copied).size!==copied.length)e.photos='Elegí hasta seis fotos sin repetir.';
 if(val(f,'action')==='publicar'&&!copied.length&&!files.length)e.photos='Agregá una foto de portada para publicar.';
 let bytes=0;
 for(const[k,file]of files){const index=k.slice(6),data=new FormData();if(f.getAll(k).length>1)e[`new-${index}-photo`]='Seleccioná un único archivo por foto.';data.set('photo',file);data.set('alt',val(f,`alt-${index}`));data.set('credit',val(f,`credit-${index}`));data.set('permission',val(f,`permission-${index}`));for(const[n,m]of Object.entries(validatePhoto(data)))e[`new-${index}-${n}`]=m;if(file instanceof File)bytes+=file.size;}
 if(bytes>3.75*1024*1024)e.photos='Las fotos nuevas superan 3,75 MB en conjunto.';
 for(const id of copied){if(f.has(`copyAlt-${id}`)&&(!val(f,`copyAlt-${id}`)||val(f,`copyAlt-${id}`).length>240))e[`existing-${id}-alt`]='Revisá la descripción de esta foto.';if(val(f,`copyCredit-${id}`).length>150)e[`existing-${id}-credit`]='Revisá el crédito de esta foto.';}
 return {...e,...outingScalarErrors(f,true)};
}
export function validateOutingEdit(f:FormData,initial:Record<string,string>,defaults:Record<string,string>,isSeries:boolean,used=0,requestInitial:Record<string,unknown>={},shared=false):FieldErrors{
 const e:FieldErrors={},personal=new Set(f.getAll('personal').map(String));
 for(const item of commonOutingFields){const v=!isSeries||personal.has(item.name)?val(f,item.name):defaults[item.name]||'';if(item.required&&!v)e[item.name]='Completá este campo.';else if(v.length>(item.multiline?5000:240))e[item.name]='El texto supera la longitud permitida.';}
 for(const item of outingLogisticsFields)if(val(f,item.name).length>5000)e[item.name]='Usá hasta 5000 caracteres.';
 const starts=val(f,'starts'),ends=val(f,'ends'),mode=val(f,'mode'),capacity=Number(val(f,'capacity'));
 if(!date(starts))e.starts='Indicá un inicio válido.';if(!date(ends)||date(starts)&&ends<starts)e.ends='Indicá un fin igual o posterior al inicio.';if(!['fija','flexible'].includes(mode))e.mode='Seleccioná una modalidad.';
 if((starts!==initial.starts||ends!==initial.ends||mode!==initial.mode)&&!val(f,'dateReason'))e.dateReason='Indicá el motivo del cambio de fechas o modalidad.';
 if(!Number.isSafeInteger(capacity)||capacity<Math.max(1,used)||capacity>10000)e.capacity=`Ingresá entre ${Math.max(1,used)} y 10 000 cupos.`;
 if(val(f,'capacity')!==initial.capacity&&!val(f,'capacityReason'))e.capacityReason='Indicá el motivo del ajuste de cupos.';
 if(!['publica','privada'].includes(val(f,'visibility')))e.visibility='Seleccioná la visibilidad.';
 const deadline=val(f,'registrationDeadline');if(!date(deadline)||date(starts)&&deadline>starts)e.registrationDeadline='El cierre debe ser igual o anterior al inicio.';
 const requestChanged=f.has('editRequest')&&supportRequestFields.some(item=>val(f,`request-${item.name}`)!==String(requestInitial[item.name]??'').trim());
 if(requestChanged&&shared&&val(f,'confirmShared')!=='on')e.confirmShared='Confirmá los cambios comunes para todos los bloques.';
 if(requestChanged)for(const item of supportRequestFields){const v=val(f,`request-${item.name}`);if(['organization','activity'].includes(item.name)&&!v)e[`request-${item.name}`]='Completá este campo.';else if(v.length>5000)e[`request-${item.name}`]='Usá hasta 5000 caracteres.';}
 if(val(f,'photoMode')==='personal'){
  const parsed=parsePhotoMetadata(val(f,'photos'));Object.assign(e,parsed.fieldErrors);
  let bytes=0;
  for(const p of parsed.photos){
   if(p.kind!=='upload')continue;
   const data=new FormData(),file=f.get(`photo-${p.key}`);if(f.getAll(`photo-${p.key}`).length>1)e[`${p.key}-photo`]='Seleccioná un único archivo por foto.';data.set('alt',typeof p.alt==='string'?p.alt:'');data.set('credit',typeof p.credit==='string'?p.credit:'');data.set('photo',file||'');if(p.permission===true)data.set('permission','on');
   for(const[n,m]of Object.entries(validatePhoto(data)))e[`${p.key}-${n}`]=m;
   if(file instanceof File)bytes+=file.size;
  }
  if(bytes>3.75*1024*1024)e.photos='Las fotos nuevas superan 3,75 MB en conjunto.';
 }
 return {...e,...outingScalarErrors(f)};
}
export function validateManualSeries(f:FormData):FieldErrors{const e:FieldErrors={};if(!val(f,'name')||val(f,'name').length>120)e.name='Indicá un nombre de hasta 120 caracteres.';if(val(f,'description').length>2000)e.description='Usá hasta 2000 caracteres.';if(!f.getAll('outing').length)e.outing='Seleccioná al menos una salida.';return {...e,...outingScalarErrors(f)};}
export function validateCommonSeries(f:FormData):FieldErrors{const e:FieldErrors={},apply=new Set(f.getAll('apply').map(String));if(!apply.size||[...apply].some(n=>!['support','photos',...commonOutingFields.map(f=>f.name)].includes(n)))e.apply='Seleccioná explícitamente los datos que querés actualizar.';if(val(f,'confirm')!=='on')e.confirm='Confirmá el alcance del cambio.';for(const item of commonOutingFields)if(apply.has(item.name)){if(item.required&&!val(f,item.name))e[item.name]='Completá este campo seleccionado.';else if(val(f,item.name).length>(item.multiline?5000:240))e[item.name]='El texto supera la longitud permitida.';}if(apply.has('support'))for(const item of supportRequestFields)if(val(f,item.name).length>5000)e[item.name]='Usá hasta 5000 caracteres.';if(apply.has('photos')&&!val(f,'photoSource'))e.photoSource='Elegí un bloque con portada.';return {...e,...outingScalarErrors(f,false,['block','editableBlock'])};}

function outingScalarErrors(form:FormData,periods=false,repeated:readonly string[]=[]):FieldErrors{
 const errors=scalarInputErrors(form,[...new Set(form.keys())].filter(name=>![...repeated,...(periods?['starts','ends','periodId']:[]),'copyPhoto','personal','apply','outing','photo'].includes(name)&&!/^photo-/.test(name)));
 for(const name of repeated)if(form.getAll(name).some(value=>typeof value!=='string'))errors[name]='Revisá el valor de este campo.';
 const result:FieldErrors={};for(const[name,message]of Object.entries(errors)){const match=/^(alt|credit|permission)-(\d+)$/.exec(name);result[match?`new-${match[2]}-${match[1]}`:name]=message;}return result;
}
