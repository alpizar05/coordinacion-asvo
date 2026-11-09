export const statuses = [
  ['validación', 'Solicitud anterior'],
  ['revisión', 'En revisión'],
  ['espera', 'Lista de espera'],
  ['confirmada', 'Confirmada'],
  ['rechazada', 'Rechazada'],
  ['cancelada por coordinación', 'Cancelada por Coordinación'],
  ['cancelada por voluntariado', 'Cancelada por voluntariado'],
] as const;

export const statusLabels = new Map<string, string>(statuses);
