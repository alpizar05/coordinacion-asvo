import test from 'node:test';import assert from 'node:assert/strict';
import {validateNewOuting,validatePhoto,validateOutingEdit,validateCommonSeries,validateManualSeries} from '../../lib/outing-form-validation.ts';
import {validateReport} from '../../lib/outing-report-validation.ts';
import {labourOptions,activityOptions,reportDefaults} from '../../lib/outing-report-options.ts';
import {form,uuid} from './helpers.mjs';
const image=(size=1,type='image/png')=>new File([new Uint8Array(size)],'fake.png',{type});
const initial={title:'Salida',location:'Lugar',unit:'Voluntariado General',starts:'2035-01-10',ends:'2035-01-12',mode:'fija',capacity:'2'};
const edit=(extra={})=>form({...initial,visibility:'privada',registrationDeadline:'2035-01-10',photoMode:'keep',...extra});
const fresh=(extra={})=>form({...initial,action:'publicar',copyPhoto:uuid(1),...extra});
test('new outing reports every invalid period under its stable form identifier',()=>{
 const errors=validateNewOuting(form({starts:['','2035-01-13'],ends:['','2035-01-11'],periodId:['7','12'],capacity:'0',action:'publicar'}));
 for(const key of ['title','location','unit','capacity','period-7-starts','period-7-ends','period-12-ends','photos'])assert.ok(errors[key],key);
 assert.deepEqual(validateNewOuting(fresh()),{});
 assert.ok(validateNewOuting(fresh({starts:['2035-01-10','2035-01-10'],ends:['2035-01-12','2035-01-12'],periodId:['a','b']}))['period-b-starts']);
 for(const extra of [{starts:[],ends:[]},{starts:Array(25).fill('2035-01-01'),ends:Array(25).fill('2035-01-01')},{starts:['2035-01-01'],ends:[]}])assert.ok(validateNewOuting(fresh(extra)).dates);
 assert.ok(validateNewOuting(fresh({registrationDeadline:'2035-01-11'})).registrationDeadline);
 assert.ok(validateNewOuting(fresh({registrationDeadline:'invalid'})).registrationDeadline);
 assert.deepEqual(validateNewOuting(fresh({registrationDeadline:'2035-01-10',title:'x'.repeat(240),requirements:'x'.repeat(5000)})),{});
 assert.ok(validateNewOuting(fresh({title:'x'.repeat(241),requirements:'x'.repeat(5001)})).requirements);
 for(const capacity of ['1','10000'])assert.equal(validateNewOuting(fresh({capacity})).capacity,undefined);
 for(const capacity of ['0','1.1','10001'])assert.ok(validateNewOuting(fresh({capacity})).capacity);
});
test('photo metadata, MIME, per-file/batch budgets and gallery IDs retain separate errors',()=>{
 const original=form({photo:image(),alt:'',credit:'x'.repeat(151)}),before=[...original];
 assert.deepEqual(Object.keys(validatePhoto(original)),['alt','credit','permission']);assert.deepEqual([...original],before);
 assert.ok(validatePhoto(form({photo:image(0),alt:'DEMO',permission:'on'})).photo);
 assert.ok(validatePhoto(form({photo:image(1,'text/plain'),alt:'DEMO',permission:'on'})).photo);
 assert.ok(validatePhoto(form({photo:image(3*1024*1024+1),alt:'DEMO',permission:'on'})).photo);
 assert.ok(validatePhoto(form({photo:image(2),alt:'DEMO',permission:'on'}),{maxBytes:1}).photo);
 assert.deepEqual(validatePhoto(form({photo:image(3*1024*1024),alt:'x'.repeat(240),credit:'x'.repeat(150),permission:'on'})),{});
 assert.deepEqual(validatePhoto(form({photo:image(),alt:'DEMO'}),{authorized:true}),{});
 assert.ok(validatePhoto(form({alt:'Galería'}),{mode:'gallery'}).photoId);
 assert.deepEqual(validatePhoto(form({alt:'Galería',photoId:uuid(1)}),{mode:'gallery'}),{});
 const staged=edit({photoMode:'personal',photos:JSON.stringify([{key:'new-demo',kind:'upload',alt:'',credit:'x'.repeat(151)}]),'photo-new-demo':image()});const errors=validateOutingEdit(staged,initial,{},false);
 for(const key of ['new-demo-alt','new-demo-credit','new-demo-permission'])assert.ok(errors[key]);
});
test('photo lists bound counts, duplicates, descriptions and combined size',()=>{
 assert.ok(validateNewOuting(fresh({copyPhoto:[uuid(1),uuid(1)]})).photos);
 assert.ok(validateNewOuting(fresh({copyPhoto:Array.from({length:7},(_,i)=>uuid(i))})).photos);
 assert.ok(validateNewOuting(fresh({['copyAlt-'+uuid(1)]:''}))[`existing-${uuid(1)}-alt`]);
 assert.ok(validateNewOuting(fresh({['copyCredit-'+uuid(1)]:'x'.repeat(151)}))[`existing-${uuid(1)}-credit`]);
 const files=fresh({copyPhoto:[],'photo-0':image(2*1024*1024),'photo-1':image(2*1024*1024),'alt-0':'Foto','alt-1':'Foto','permission-0':'on','permission-1':'on'});
 assert.ok(validateNewOuting(files).photos);
 for(const photos of ['bad','{}',JSON.stringify(Array(7).fill({}))])assert.ok(validateOutingEdit(edit({photoMode:'personal',photos}),initial,{},false).photos);
 const good=JSON.stringify([{key:'existing',kind:'gallery',id:uuid(1),alt:'Foto',credit:''}]);assert.deepEqual(validateOutingEdit(edit({photoMode:'personal',photos:good}),initial,{},false),{});
});
test('individual editing is direct; series inherits unless explicitly personalized',()=>{
 assert.deepEqual(validateOutingEdit(edit(),initial,{},false),{});
 assert.ok(validateOutingEdit(edit({title:''}),initial,initial,false).title);
 assert.equal(validateOutingEdit(edit({title:''}),initial,initial,true).title,undefined);
 assert.ok(validateOutingEdit(edit({title:'',personal:['title']}),initial,initial,true).title);
 const errors=validateOutingEdit(edit({starts:'',ends:'',mode:'bad',capacity:'0',visibility:'bad',registrationDeadline:'bad'}),initial,{},false);
 for(const name of ['starts','ends','mode','dateReason','capacity','capacityReason','visibility','registrationDeadline'])assert.ok(errors[name]);
 assert.ok(validateOutingEdit(edit({capacity:'2',capacityReason:'Ajuste'}),initial,{},false,3).capacity);
 assert.ok(validateOutingEdit(edit({transport_details:'x'.repeat(5001)}),initial,{},false).transport_details);
 assert.ok(validateOutingEdit(edit({starts:'2035-01-11',ends:'2035-01-10',dateReason:'Cambio'}),initial,{},false).ends);
 assert.ok(validateOutingEdit(edit({registrationDeadline:'2035-01-11'}),initial,{},false).registrationDeadline);
});
test('shared support changes require scope confirmation; common/manual series validate only chosen fields',()=>{
 const changed=edit({editRequest:'on','request-organization':'','request-activity':'','request-contact':'x'.repeat(5001)});
 const errors=validateOutingEdit(changed,initial,{},false,0,{organization:'DEMO',activity:'Labor'},true);
 for(const key of ['confirmShared','request-organization','request-activity','request-contact'])assert.ok(errors[key]);
 assert.equal(validateOutingEdit(edit({editRequest:'on',confirmShared:'on','request-organization':'DEMO','request-activity':'Labor'}),initial,{},false,0,{},true).confirmShared,undefined);
 assert.equal(Object.keys(validateCommonSeries(form())).length,2);
 assert.ok(validateCommonSeries(form({apply:['invalid'],confirm:'on'})).apply);
 assert.ok(validateCommonSeries(form({apply:['title'],confirm:'on',title:''})).title);
 assert.ok(validateCommonSeries(form({apply:['logistics'],confirm:'on',logistics:'x'.repeat(5001)})).logistics);
 assert.ok(validateCommonSeries(form({apply:['support'],confirm:'on',plan:'x'.repeat(5001)})).plan);
 assert.ok(validateCommonSeries(form({apply:['photos'],confirm:'on'})).photoSource);
 assert.deepEqual(validateCommonSeries(form({apply:['photos'],confirm:'on',photoSource:uuid(1)})),{});
 assert.equal(Object.keys(validateManualSeries(form())).length,2);
 assert.ok(validateManualSeries(form({name:'x'.repeat(121),description:'x'.repeat(2001)})).description);
 assert.deepEqual(validateManualSeries(form({name:'x'.repeat(120),description:'x'.repeat(2000),outing:uuid(1)})),{});
});
const blank={labour:[],activity:'',location:'',starts:'',ends:'',actions:'',host:'',observations:''};
const report={labour:[labourOptions[0]],activity:activityOptions[0],location:'Lugar',starts:'2035-01-10',ends:'2035-01-12',actions:'Labor ficticia',host:'Responsable ficticio',observations:''};
test('draft is incomplete but not unvalidated; final report requires attendance and accuracy',()=>{
 assert.deepEqual(validateReport(blank,[],false,true),{});
 for(const field of ['labour','activity','location','starts','ends','actions','host','participants','accuracy'])assert.ok(validateReport(blank,[],false)[field],field);
 assert.deepEqual(validateReport(report,[uuid(1)],true),{});
 const invalid={...report,labour:['unknown'],activity:'unknown',starts:'invalid',ends:'invalid',location:'x'.repeat(501),host:'x'.repeat(501),actions:'x'.repeat(10001),observations:'x'.repeat(5001)};
 for(const field of ['labour','activity','starts','ends','location','host','actions','observations'])assert.ok(validateReport(invalid,[],false,true)[field],field);
 assert.ok(validateReport({...report,ends:'2035-01-09'},[uuid(1)],true).ends);
 assert.ok(validateReport({...report,labour:null},[uuid(1)],true).labour);
 assert.deepEqual(validateReport({...report,location:'x'.repeat(500),host:'x'.repeat(500),actions:'x'.repeat(10000),observations:'x'.repeat(5000)},[uuid(1)],true),{});
});
test('report defaults preserve unit vocabulary and general fallback',()=>{
 for(const [unit,index]of [['BRIF',0],['Control y Protección/COVIRENA',1],['UEA',2],['Voluntariado General',3]])assert.deepEqual(reportDefaults(unit),{labour:[labourOptions[index]],activity:activityOptions[index]});
});

test('common series accepts repeated block identifiers while rejecting file-valued metadata and duplicate scalar values',()=>{
 const values={apply:['title'],confirm:'on',title:'Serie',block:[uuid(1),uuid(2)],editableBlock:[uuid(1),uuid(2)]};
 assert.deepEqual(validateCommonSeries(form(values)),{});
 const invalid=form(values);invalid.append('block',new File(['fake'],'bad.csv'));assert.ok(validateCommonSeries(invalid).block);
 const scalar=form(values);scalar.append('title','Otra');assert.ok(validateCommonSeries(scalar).title);
});
