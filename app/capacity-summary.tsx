export function CapacitySummary({ capacity, occupied, detail = false }: {
  capacity: number;
  occupied: number;
  detail?: boolean;
}) {
  const available = Math.max(0, capacity - occupied);
  const label = available === 0 ? 'Cupos completos'
    : available === 1 ? '1 cupo disponible' : `${available} cupos disponibles`;

  return <div className="capacity-summary">
    <strong>{label}</strong>
    {detail && <span>{occupied} de {capacity} inscripciones con cupo</span>}
  </div>;
}
