import {validateProfile, type ProfileField} from "./profile-validation";
import {type FormResult} from "./form-result";
import {audit, field} from "./registration";

export async function correctVolunteerProfile(connection:import("postgres").Sql,id:string,form:FormData,actor:string):Promise<FormResult<ProfileField>> {
  const name = field(form,'name'), surname = field(form,'surname');
  const birth = field(form,'birth'), email = field(form,'email');
  const volunteerYear = field(form,'volunteer_year'), memberYear = field(form,'member_year');
  const boolean = (name: string) => {
    const value = field(form,name);
    return value === 'sí' ? true : value === 'no' ? false : null;
  };
  const member = boolean('member'), medical = boolean('medical');
  const fieldErrors = validateProfile(form);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const saved = await connection.begin(async tx => {
    const [updated] = await tx`update volunteers set name=${name},surname=${surname},second_surname=${field(form,'second_surname') || null},
      birth=${birth || null}, email=${email || null}, whatsapp=${field(form,'whatsapp') || null},
      province=${field(form,'province') || null},canton=${field(form,'canton') || null},district=${field(form,'district') || null},
      medical=${medical},medical_detail=${medical ? field(form,'medical_detail') : null},
      emergency_name=${field(form,'emergency_name') || null},emergency_phone=${field(form,'emergency_phone') || null},
      emergency_relation=${field(form,'emergency_relation') || null},volunteer_year=${volunteerYear || null},
      member=${member},member_year=${member ? memberYear || null : null} where id=${id} returning id`;
    if (!updated) return false;
    await audit(tx,actor,'Corrigió ficha',id);
    return true;
  });
  if (!saved) return { error: 'La persona ya no está disponible. Actualizá el registro antes de continuar.' };
  return { saved: true };
}
