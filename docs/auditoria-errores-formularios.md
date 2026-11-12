# Auditoría integral de errores por campo

Fecha: 11 de noviembre de 2026. Entorno: desarrollo y PostgreSQL demo local. No se publicaron cambios, no se usó la beta y no se hicieron cargas ni envíos reales.

## Alcance y criterio

Se inventariaron los puntos de entrada que renderizan formularios y los componentes usados para editar, filtrar o confirmar. La revisión sigue las ramas realmente mostradas por cada página: no cuenta varias instancias de una misma tabla como formularios distintos. Errores de formato, selección, obligatoriedad y límites pertenecen al campo o grupo correspondiente. Acceso, conexión, evidencia, versión desactualizada y conflictos de cupos/pertenencia permanecen generales. Una operación se confirma únicamente con `saved: true`, una respuesta comprobada de generación de enlace o la navegación de éxito posterior a esa escritura.

El [patrón compartido](errores-de-formularios.md) documenta los contratos y la implementación de cada etapa. Este inventario se refiere al estado final de la auditoría.

## Inventario de formularios activos

| Familia / ubicación | Formularios y campos comprobados | Presentación |
| --- | --- | --- |
| PDP pública / `remember-registration.tsx` | Inscripción: identificación, fechas, transporte, restricciones | Campos + resumen; identificación inexistente/póliza conserva su aviso importante |
| Enlace privado / `private-registration-forms.tsx` | Editar inscripción; cancelar con motivo y aceptación cuando corresponda | Campos + resumen; conserva los valores al fallar |
| Coordinación / `add-registration.tsx`, `edit-registration.tsx` | Persona seleccionada, fechas y logística de inscripción | Modal; errores independientes, versión y permisos generales |
| `manage-registration-form.tsx` | Confirmar, espera, rechazar, cancelar, recuperar; asignar/quitar 70 | Motivo, identificación y aprobación de fechas cuando aplican; acciones sin campos conservan errores generales |
| `split-group-form.tsx` | Crear salida desde una agrupación: título y cupos | Modal compartido; agrupación modificada es un conflicto general |
| `outing-decision-form.tsx` | Registrar decisión de agrupación; completar; cancelar convocatoria; eliminar convocatoria | Motivo o aceptación junto al control; no redirige ni pierde datos ante errores |
| Nueva convocatoria / `new-outing-form.tsx` | Nueva individual y nuevo bloque: datos, varios periodos, cupo, cierre, fotos | Resumen, secciones y claves estables de periodo/foto |
| `outing-editor.tsx` | Editar convocatoria individual o bloque | Edición directa para individual; personalización/herencia solamente en series |
| `collection-editor.tsx` | Editar datos comunes: campos seleccionados, fuente de fotos y confirmación | Alcance explícito, resumen y versión de la serie |
| `collection-form.tsx` | Crear serie manual: nombre, descripción y salidas | Campos/grupo, conserva búsqueda y selección |
| `photo-dialog.tsx`, `attach-photos.tsx` | Nueva foto, galería y editar metadatos | Archivo, descripción, crédito, autorización y selección; conserva archivos preparados |
| Registro / `profile-editor.tsx` | Corregir ficha | Modal compartido; solo Administración |
| Registro / `volunteer-units.tsx` | Actualizar unidades | Error en grupo; Voluntariado General obligatorio |
| Registro / `RegistryModal` policy | Verificar póliza: tipo, número, fuente y vigencia | Campos; solo Administración |
| Registro / `RegistryForm` incident | Registrar incidente: fecha, salida y descripción | Campos; vínculo desaparecido es un conflicto general |
| `attendance-reconciliation.tsx` | Conciliar asistencia: decisión y motivo | Campos; evidencia modificada es general |
| Administración / `RegistryForm` grant | Asignar/revocar permiso: identidad, rol, unidad y acción | Campos/grupo; restricciones de acceso o autorrevocación generales |
| `importer.tsx` | Importar voluntariado y pólizas | CSV junto al selector; fila/columna/motivo, selección válida y confirmación explícita |
| `private-link-form.tsx` | Generar invitación; generar enlace privado del 70 | Identificación o persona seleccionada; cambio de asignación/acceso general |
| `report-form.tsx` | Guardar borrador y finalizar informe del 70 | Campos y grupos accesibles; borrador no acredita asistencia; finalizado no editable |
| `StatusFilter` en Solicitudes e Informes | Estado, unidad, Desde y Hasta | Rango invertido atribuido a Hasta; criterios y URL conservados |
| Filtros restantes | Convocatorias, series, voluntariado, Resumen, galería | Búsqueda y opciones predefinidas; no se inventan errores para resultados vacíos |

### Operaciones sin campos editables

Inicio/cierre de sesión, destacar/retirar portada, copiar o compartir, revocar enlaces y recordar un informe no reciben errores artificialmente asociados a sus botones. Conexión, autorización, estado no permitido, fallo del portapapeles o notificación pendiente se presentan como avisos generales. El recordatorio muestra una previsualización, no campos que la persona pueda corregir.

La edición manual de una serie ya creada no existe en la vista activa: su ficha es de consulta. No se marca como un formulario migrado.

### Compatibilidad que no constituye interfaz activa

La página de detalle todavía contiene JSX de ediciones anteriores para datos, solicitud, fechas, visibilidad, cupo y reordenación de fotos. En modo edición se renderiza `OutingEditor` y sus acciones finales; esas ramas antiguas de Información/Herramientas no se muestran. Sus adaptadores de servidor se conservan por compatibilidad, pero no se usan como evidencia de cobertura de una pantalla activa. Se corrigieron retornos que podían producir confirmación sin guardado en acciones desconocidas y en el adaptador antiguo de datos comunes. Retirar definitivamente estas ramas es una limpieza separada.

## Problemas encontrados y correcciones

1. **Rangos de filtros:** ambos listados mostraban un aviso general. Ahora `validateDateFilter` asocia el rango invertido a Hasta. No intercambia, borra ni normaliza silenciosamente los criterios. La consulta conserva su protección para rangos inválidos y no ejecuta una búsqueda incoherente.
2. **Foco en grupos:** la elección inicial consideraba solamente controles con `name`, pasando por alto aliases de asistencia/fotos. Se utiliza el orden del documento y también `data-feedback-fields`, excluyendo campos ocultos de transporte de datos.
3. **Distribución móvil:** el resumen del filtro permanece fuera del modal; su enlace abre el modal y enfoca Hasta. El aviso ocupa una fila completa de la barra, sin desplazar el contador ni el botón. No se roba foco al cargar una URL con filtros.
4. **Estilos:** las reglas de Coordinación ocultaban el borde de error y cambiaban el aspecto de los enlaces del resumen. Se corrigió la especificidad; el mensaje y la asociación accesible acompañan al color.
5. **Errores de grupos ocultos:** los mensajes de los adaptadores de secciones ahora se alojan dentro de la sección/fieldset, evitando que una foto inválida aparezca fuera de su sección.
6. **Acciones finales y decisión de agrupación:** usaban formularios con redirección que perdían el motivo y podían confirmar una acción sin aplicarla. Se migraron al resultado compartido, bloqueo/versión en servidor, errores junto a motivo/aceptación y conservación de datos.
7. **Servidor y validaciones residuales:** selección de unidad inexistente y selección de galería inválida se identifican por campo; acceso a unidades, portada desaparecida y conflictos concurrentes continúan generales. El alcance común no usa una confirmación de éxito cuando devuelve errores.
8. **Conservación de acciones finales:** el panel de acciones del editor permanece montado al cambiar de sección. Un error abre Publicación y los desplegables nativos antes del foco, sin perder el motivo ni la aceptación.
9. **Fechas inválidas en servidor:** se unificó la fecha de calendario en `form-dates.mjs`, incluido el rechazo del año cero que PostgreSQL no admite. Se verificaron días inexistentes y años bisiestos.
10. **Doble envío:** `ActionModal` agrega protección síncrona además del estado pendiente. Se conservan las protecciones y transacciones de los demás flujos.

## Comprobaciones y evidencia

- `npm run check`, `npm run build` y `git diff --check`.
- `test-form-audit.mjs`: rangos invertidos, fechas reales, motivos/aceptaciones, permisos y versiones como generales, acción desconocida sin falso éxito, decisión idempotente, cancelación, finalización y eliminación con auditoría. Cancelar notifica una sola vez en la bandeja demo; no utiliza correo real. La transacción se revierte.
- `test-outing-form-errors.mjs`: periodos/fotos múltiples, autorización, alcance de serie, edición directa/herencia, versión obsoleta, borrador sin asistencia y finalización bloqueada.
- `test-registry-form-errors.mjs`: registro, pólizas, unidades, incidentes, permisos ficticios, conciliación, CSV con errores localizables, preview sin escrituras y reintentos.
- `test-staff-form-errors.mjs`: decisiones y recuperación, permisos, aprobación, agrupaciones y dos decisiones concurrentes sobre la misma versión: una escritura, un conflicto, una auditoría y una notificación demo.
- `test-registration-workflow.mjs`, `test-public-registration.mjs`, `test-form-feedback.mjs` y `test-mail-test-recipients.mjs`: regresión de cupos, espera/promoción, edición, cancelación, recepción concurrente, auditoría, reintentos y protección de destinatarios de prueba.
- Navegador local: filtro invertido con Hasta marcado y descrito; Enter en el resumen lleva el foco al campo; IDs sin duplicados en la página. A 390 px el resumen abre el modal y enfoca Hasta. Corregir con teclado retira el error y conserva Desde/Estado en la URL; sin desbordamiento horizontal. Se comprobó también Hasta en el modal de Informes conservando Estado=Borrador, y los motivos vacíos/espacios de decisión y cancelación conservaron los datos, la pestaña y la URL, sin franja de éxito.

## Limitaciones y pendientes explícitos

- La comprobación de lectores de pantalla usa el árbol de accesibilidad y asociaciones del DOM. **No sustituye una sesión manual con VoiceOver, NVDA o TalkBack**; esa validación permanece pendiente, con especial atención a controles nativos de fecha y anuncios de grupos.
- La revisión visual se hace por componentes y flujos representativos compartidos; no es una matriz exhaustiva de todos los navegadores/dispositivos ni de todas las combinaciones de secciones. Safari/iOS y Android reales permanecen pendientes.
- Graph, Entra y SharePoint reales no se ejercitan en esta auditoría. Se verifican la clasificación general y la conservación local; la integración real continúa siendo una prueba separada autorizada.
- Los reintentos de publicación tras una respuesta perdida requieren una futura estrategia de idempotencia de la creación. La protección síncrona evita envíos simultáneos desde el mismo formulario, pero no equivale a una garantía distribuida de publicación exactamente una vez.
- Mantener el inventario al introducir formularios nuevos; conservar los adaptadores legados no significa que estén accesibles como interfaz ni que puedan retirarse sin revisar compatibilidad.
