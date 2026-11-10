export const outingLogisticsFields = [
  { name: 'transport_details', label: 'Transporte', placeholder: 'Cómo llegar, punto de encuentro, transporte disponible, costos y qué debe coordinar cada persona.' },
  { name: 'food_details', label: 'Alimentación', placeholder: 'Si se brindan comidas, qué debe llevar cada persona, cocina disponible y costos.' },
  { name: 'lodging_details', label: 'Hospedaje', placeholder: 'Si hay hospedaje, tipo de alojamiento, disponibilidad, costos y equipo que se debe llevar.' },
] as const;
export type OutingLogistics = Partial<Record<typeof outingLogisticsFields[number]['name'],string | null>>;
export function outingLogisticsMessage(outing: OutingLogistics) {
  return outingLogisticsFields.filter(item => outing[item.name]?.trim()).map(item => `${item.label}: ${outing[item.name]}`).join('\n');
}
