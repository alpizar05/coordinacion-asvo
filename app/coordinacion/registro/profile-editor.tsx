'use client';

import { ActionModal } from '../action-modal';
import { FormField } from '../../form-feedback/form-feedback';
import { editProfile } from '../../actions/volunteers';
import { profileFieldLabels, validateProfile, type ProfileField, type ProfileInitial } from '../../../lib/profile-validation';

const groups: { title:string; fields: {name:ProfileField;type?:string}[] }[] = [
  {title:'Identidad y contacto',fields:[{name:'name'},{name:'surname'},{name:'second_surname'},{name:'email',type:'email'},{name:'birth',type:'date'},{name:'whatsapp',type:'tel'}]},
  {title:'Ubicación',fields:[{name:'province'},{name:'canton'},{name:'district'}]},
  {title:'Contacto de emergencia',fields:[{name:'emergency_name'},{name:'emergency_phone',type:'tel'},{name:'emergency_relation'}]},
  {title:'Trayectoria',fields:[{name:'volunteer_year'},{name:'member_year'}]},
];
export function ProfileEditor({ id,initial }: {id:string;initial:ProfileInitial}) {
  return <ActionModal title="Corregir ficha" successMessage="Datos de la persona voluntaria actualizados."
    saveLabel="Guardar correcciones" wide action={editProfile.bind(null,id)} validate={validateProfile} fieldLabels={profileFieldLabels} fieldDependencies={{medical:['medical_detail']}}>
    {groups.map(group=><fieldset key={group.title}><legend>{group.title}</legend><div className="grid">
      {group.fields.map(({name,type})=><FormField key={name} name={name} label={profileFieldLabels[name]}>
        <input name={name} type={type || 'text'} defaultValue={initial[name]} required={name==='name'||name==='surname'} />
      </FormField>)}
    </div></fieldset>)}
    <div className="grid">{(['medical','member'] as const).map(name=><FormField key={name} name={name} label={profileFieldLabels[name]}>
      <select name={name} defaultValue={initial[name]}><option value="">Por confirmar</option><option value="sí">Sí</option><option value="no">No</option></select>
    </FormField>)}</div>
    <FormField name="medical_detail" label={profileFieldLabels.medical_detail}><textarea name="medical_detail" defaultValue={initial.medical_detail} /></FormField>
  </ActionModal>;
}
