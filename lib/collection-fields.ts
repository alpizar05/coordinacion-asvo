export const commonOutingFields = [
  { name: 'title', label: 'Título', multiline: false, required: true },
  { name: 'location', label: 'Estación o lugar', multiline: false, required: true },
  { name: 'unit', label: 'Unidad responsable', multiline: false, required: true },
  { name: 'requirements', label: 'Requisitos', multiline: true, required: false },
  { name: 'logistics', label: 'Logística', multiline: true, required: false },
] as const;

export const supportRequestFields = [
  { name: 'organization', label: 'Organización solicitante', multiline: false },
  { name: 'contact', label: 'Contacto solicitante', multiline: false },
  { name: 'area', label: 'Área silvestre protegida', multiline: false },
  { name: 'activity', label: 'Tipo de actividad', multiline: false },
  { name: 'plan', label: 'Plan de trabajo', multiline: true },
] as const;
