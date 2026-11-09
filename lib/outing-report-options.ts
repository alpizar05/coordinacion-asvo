export const labourOptions = ['BRIF', 'UCP-COVIRENAS', 'UEA', 'Mantenimiento y otros'] as const;
export const activityOptions = [
  'Salida BRIF',
  'Salida COVIRENAS (control de turismo, presencia, patrullajes, retenes)',
  'Salida UEA (monitoreos, conteos, charlas, exposiciones)',
  'Salida general (mantenimiento, colaboración en oficinas, ferias)',
  'Salida a estaciones de ASVO (Montezuma, Tortuguero, Buena Vista)',
  'Salida empresarial',
  'Gira de junta directiva',
] as const;

export function reportDefaults(unit: string) {
  if (unit === 'BRIF') return { labour: [labourOptions[0]], activity: activityOptions[0] };
  if (unit === 'Control y Protección/COVIRENA') return { labour: [labourOptions[1]], activity: activityOptions[1] };
  if (unit === 'UEA') return { labour: [labourOptions[2]], activity: activityOptions[2] };
  return { labour: [labourOptions[3]], activity: activityOptions[3] };
}
