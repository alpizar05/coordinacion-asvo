# Transiciones de convocatorias, inscripciones e informes

Refactorización local verificada el 12 de noviembre de 2026. Conserva estados, permisos, motivos, orden de precondiciones, auditoría, notificaciones y transacciones vigentes. No agrega transiciones de negocio ni migra datos históricos.

## Implementación

- `lib/workflow-transitions.ts`: inventario conocido, categorías de inscripción, decisiones puras de recepción, promoción, gestión, asignación de 70, edición, cancelación privada, creación/cierre de salida e informe; textos de auditoría y avisos correspondientes.
- `lib/registration-workflow.ts`: mantiene reservas y comprobaciones SQL, FIFO, capacidad, unidad/póliza y promociones dentro de la transacción del llamador. Comparte la recuperación de una inscripción en validación entre la acción actual y su adaptador anterior.
- `lib/outing-state-transition.ts`: aplica publicación, finalización, eliminación y cancelación con sus efectos SQL y auditoría. Es común a `saveOutingDecision` y `manageOuting`; sus adaptadores conservan sus contratos de error y navegación.
- `lib/public-registration.ts` y `lib/edit-registration.ts`: usan la misma decisión de edición, con mensajes distintos para voluntariado y Coordinación. La cancelación privada conserva su reintento idempotente.
- `lib/outing-report.ts`: comparte la decisión de borrador/finalización y conserva la autorización, versión, lista de participantes, bloqueo de finalizados y escritura condicional en SQL.
- `lib/registration-rules.ts`: reexporta `outingIsEditable` para mantener los consumidores existentes. El cálculo de agrupaciones permanece intacto.

Las funciones puras reciben el estado leído dentro de la operación autorizada. No consultan ni escriben DB, no liberan bloqueos, no generan enlaces ni envían correos. Su resultado **no es un permiso**: se mantienen las comprobaciones de la [matriz de autorización](autorizacion.md). Los servicios internos requieren los bloqueos y las comprobaciones de identidad/recurso descritos en sus contratos.

## Estados conocidos

| Entidad | Estados |
| --- | --- |
| Convocatoria | `borrador`, `abierta`, `confirmada`, `completada`, `cancelada` |
| Inscripción | `validación`, `revisión`, `espera`, `confirmada`, `rechazada`, `cancelada por coordinación`, `cancelada por voluntariado` |
| Informe | `borrador`, `finalizado` |

Las filas de base siguen teniendo estados textuales: el inventario no fuerza conversiones ni convierte automáticamente un valor desconocido en un estado conocido. Eliminar una convocatoria es una eliminación de registro, no un nuevo estado. Visibilidad, vencimiento del plazo y asignación de 70 son dimensiones distintas del estado.

## Convocatorias

Actor: Coordinación autorizada sobre la unidad y, para cambios comunes, sobre los bloques que corresponda.

| Acción / origen → destino | Precondiciones y motivo | Auditoría | Notificaciones |
| --- | --- | --- | --- |
| Crear → abierta o borrador | Validación y autorización existentes; portada al publicar | `Creó y publicó convocatoria` / `Creó salida` | Ninguna |
| Publicar borrador → abierta | Portada existente | `Publicó convocatoria` | Ninguna |
| Completar abierta/confirmada → completada | Día posterior al regreso en Costa Rica y confirmación de actividad realizada | `Completó convocatoria` | Ninguna; las inscripciones mantienen su estado |
| Cancelar editable → cancelada | Existe al menos una inscripción de cualquier estado y motivo obligatorio | `Canceló convocatoria`, con motivo | Cancela `validación`, `revisión`, `espera`, `confirmada` y avisa a esas inscripciones con el motivo |
| Eliminar editable → registro eliminado | Ninguna inscripción, ni siquiera cancelada, y confirmación explícita | `Eliminó convocatoria`, con título | Ninguna |
| Separar agrupación → nueva salida con estado heredado | Origen abierto/confirmado, flexible, miembros actuales, título y capacidad suficientes | `Trasladó inscripción a otra salida`, `Separó agrupación`, `Creó salida desde agrupación` | Aviso a miembros trasladados; promoción en origen y destino cuando corresponde |

Editable significa borrador, abierta o confirmada. No hay una nueva acción que convierta una salida abierta en confirmada: el estado se conserva para los registros/importaciones existentes y las agrupaciones que lo heredan. Una convocatoria no se completa automáticamente por tener un informe finalizado. El vencimiento del plazo tampoco cambia su estado.

La cancelación conserva la auditoría general existente; no inventa una auditoría adicional por inscripción. Tampoco agrega limpieza de `assigned70` ni revocación física de enlaces al cancelar toda la salida: las comprobaciones de acceso rechazan el estado cancelado, como antes. Estados históricos de inscripción fuera del conjunto activo no se modifican en el cierre masivo.

La decisión de agrupación no cambia estado. El formulario actual evita repetir una auditoría idéntica; el adaptador anterior conserva su comportamiento previo. Publicar otra vez desde ese adaptador, si ya no es borrador, sigue sin producir una nueva transición.

## Inscripciones

| Acción / origen → destino | Actor y precondiciones | Motivo | Auditoría y aviso |
| --- | --- | --- | --- |
| Recibir → revisión/espera | Voluntariado o Coordinación; identidad, fechas, póliza/unidad y duplicados según el flujo; se promueve la espera anterior antes de reservar | No | `Recibió inscripción`; recepción con cupo reservado o lista de espera |
| Promover espera → revisión | Sistema/Coordinación dentro de transacción; cupo libre, FIFO por `received_at,id` | No | `Asignó cupo desde lista de espera`; aviso de cupo reservado y confirmación pendiente |
| Confirmar revisión/espera → confirmada | Coordinación; estado de salida, fechas fuera de rango aprobadas si son flexibles, persona/unidad y póliza. Desde espera requiere cupo libre | No | `Confirmó cupo`, y `Aprobó fechas fuera del rango` cuando corresponda; aviso de confirmación |
| Reactivar cancelada por coordinación/voluntariado → confirmada | Coordinación; sin otra inscripción activa, prioridad de espera existente, cupo libre, unidad y póliza | No | `Reactivó y confirmó inscripción cancelada`; mismo aviso de confirmación |
| Mover activa → espera | Coordinación; no estar ya en espera. Se excluye a esta persona de la promoción inmediata de esa transacción | Sí | `Movió a lista de espera`; aviso con motivo y promoción de otras personas si queda cupo |
| Rechazar activa → rechazada | Coordinación | Sí | `rechazada`; aviso con motivo y promoción si corresponde |
| Cancelar activa → cancelada por coordinación | Coordinación | Sí | `cancelada por coordinación`; aviso con motivo y promoción si corresponde |
| Cancelar activa → cancelada por voluntariado | Enlace privado vigente y salida abierta/confirmada; aceptación de gastos cuando corresponde | Sí | `Canceló inscripción`; aviso a voluntariado y a Coordinación, más promoción |
| Editar confirmada con fechas distintas → revisión | Persona por enlace o Coordinación; fechas, unidad y cobertura válidas | Reglas de edición existentes | `Editó inscripción` / `Editó inscripción desde Coordinación`; aviso específico de fechas en revisión |
| Editar otros datos o fechas de revisión/espera | Mismos controles del flujo, sin transición adicional | Reglas existentes | Misma auditoría/aviso de edición; un cambio idéntico no los duplica |
| Recuperar validación histórica → revisión/espera | Coordinación; identificación, correo, unidad y ausencia de duplicado según su adaptador; primero promueve espera anterior | No | `Recuperó inscripción anterior`; aviso de incorporación al flujo actual |
| Asignar/retirar 70, sin cambio de estado | Coordinación; inscripción confirmada y salida abierta/confirmada | No | `Asignó como 70` / `Retiró asignación de 70`; aviso específico |

Activa significa revisión, espera o confirmada. Solo revisión y confirmada consumen cupo. Validación participa en algunas comprobaciones de duplicados, pero no consume cupo; se preservan las diferencias exactas entre consultas existentes. Rechazada no se reactiva mediante confirmar.

La confirmación de una revisión ya reservada no agrega una comprobación nueva de capacidad: ese registro ya consume su cupo. La confirmación manual de una persona en espera conserva sus controles actuales; no se reemplaza por una nueva selección automática distinta. Al reactivar una cancelada, se mantiene la promoción previa de la espera incluso si después se rechaza esa reactivación por falta de cupo u otra precondición. Las promociones que efectivamente ocurren tienen su propio cambio, auditoría y mensaje atómicos.

La recuperación histórica en validación mantiene su regla anterior, distinta de la confirmación: no se agregó una comprobación de póliza que esos adaptadores no realizaban. La adaptación histórica masiva sigue siendo un comando explícito separado, con sus marcas y sin comunicaciones; no se invoca desde las nuevas decisiones.

El motivo de cancelación privada sigue limitado a 2000 caracteres y conserva la aceptación condicional. Los motivos de gestión y sus mensajes siguen en los validadores existentes; no se unificaron imponiendo límites nuevos al adaptador anterior.

Pasar desde confirmada a revisión por edición conserva el cupo y revoca el acceso de 70 correspondiente. Mover a espera/rechazar/cancelar desde Coordinación conserva la limpieza de asignación y revocación existentes. La cancelación privada conserva su tratamiento anterior de los metadatos; la validación de estado impide usar el enlace de 70. La asignación de 70 repetida conserva sus avisos anteriores: esta etapa no inventa idempotencia general para operaciones que no la tenían.

## Informes del 70

Actor de auditoría: `70:<inscripción>`, obtenido del enlace autorizado, no de un campo editable del formulario.

| Acción | Resultado | Controles y efectos |
| --- | --- | --- |
| Guardar borrador nuevo/existente | borrador | Campos parciales válidos; conserva selección de asistencia sin acreditarla; auditoría `Guardó borrador de informe`; sin correo |
| Finalizar nuevo/borrador | finalizado | Campos finales, vocabularios, asistencia, exactitud, roster y versión actuales; auditoría `Finalizó informe de salida`; asistencia disponible como evidencia; sin correo |
| Modificar finalizado | Rechazado | No se reabre ni convierte en borrador; sin escritura ni nueva auditoría |

La autorización del enlace y de la asignación de 70 se vuelve a consultar en la transacción, después de bloquear la salida. Las versiones de borrador se comparan en el mismo lugar que antes; se conserva el contrato de compatibilidad para llamadores que no proporcionan versión. El `ON CONFLICT ... WHERE outing_reports.status='borrador'` sigue siendo la última protección contra reemplazar un finalizado. La vista de evidencia conserva su filtro de informes finalizados: marcar personas en un borrador no acredita participación.

Un estado de informe desconocido no se convierte en borrador: la decisión conserva su tratamiento previo y el guard de escritura SQL impide sobrescribirlo. La base nueva ya tenía un CHECK de los dos estados de informe; no se añadió ni se debilitó aquí.

## Transacciones, concurrencia y cola

No se trasladaron al cliente ni fuera de transacción las lecturas de estado, versiones, fechas, unidad, póliza, roster, duplicados o cupos. Se mantienen los bloqueos de salida/solicitud/inscripción y su orden por cada adaptador. Los helpers compartidos usan el `tx` recibido y no abren una conexión o transacción aparte.

Cambio de estado, auditoría, enlaces de gestión y registros de correo se crean en la misma transacción. El envío sigue ocurriendo después del commit mediante el despacho/reintentos existentes. No se modificaron el worker ni el cron. Las pruebas de idempotencia comprueban registros y mensajes de cola únicos en reintentos; no prometen entrega exactamente una vez por Graph, que sigue siendo una tarea distinta.

Se conservan los reintentos específicos: cancelación privada propia, edición idéntica, promoción sin nuevos cupos y conflictos de versiones no vuelven a producir sus mensajes. Los errores siguen siendo generales o por campo según el contrato compartido, y los adaptadores mantienen filtros, foco, modales y destinos actuales.

## Revisión histórica y decisión sobre PostgreSQL

Se revisaron el SQL vigente, el importador, sus snapshots/staging y el paquete local `outputs/migracion-coordinacion-2026/migracion-voluntariado-2026.json`, solo en lectura y sin reimportarlo. Resumen de sus 837 inscripciones:

| Campo original `legacy_status` | Cantidad |
| --- | ---: |
| `completada` | 724 |
| `Cancelada por Coordinación` | 14 |
| `Cancelada por voluntariado` | 59 |
| `Confirmada` | 23 |
| Sin estado original, generadas para demo | 17 |

Los candidatos operativos del paquete son 764 confirmadas, 14 canceladas por coordinación y 59 por voluntariado; la participación histórica conserva 724 completadas y 17 asumidas demo. Los originales continúan en snapshots y referencias de importación, sin confundirlos con asistencia acreditada. El paquete contiene 129 informes, pero no demuestra todos los valores que puede tener hoy una base existente.

**No se añadió ninguna restricción nueva ni migración de estados.** Outings/registrations siguen admitiendo texto y los estados desconocidos no se normalizan ni se descartan. Se conservan CHECK existentes de informes, fechas/capacidad e índices de inscripciones. `0001_initial.sql`, su checksum y las transformaciones históricas no se modificaron para esta etapa.

Antes de una restricción futura: inventariar todos los estados y snapshots en la base objetivo autorizada, separar operativos/históricos, resolver compatibilidad explícita sin sobrescribir originales y preparar una migración numerada nueva. Debe probarse adopción y aplicación en copias locales desechables, incluidos valores desconocidos y segunda ejecución. No corresponde un CHECK cerrado basado únicamente en el paquete revisado. Esa evaluación sigue pendiente en TODO; no se consultó beta.

## Comprobaciones

- 80 pruebas unitarias correctas, incluyendo ocho nuevas de transiciones; mismos consumidores reales, sin DB/red/credenciales. Medición de 31 módulos puros: 100 % líneas, 96,39 % ramas y 99,47 % funciones. `workflow-transitions.ts`: 100 % de las tres métricas, sin afirmar cobertura combinatoria/global.
- 14 grupos de integración y tres comprobaciones de contrato/inventario correctos. Se mantienen las suites de autorización, validación, navegación pura, edición, agrupación, registro, participación, informes y migraciones.
- `npm run test:integration -- --only=workflow-transitions`: PostgreSQL local desechable, datos ficticios, cola real local y red prohibida. Usa `NODE_ENV=production` únicamente dentro del proceso protegido para ejercitar el outbox; no carga variables de producción ni ejecuta el dispatcher. Todos los destinatarios terminan en `.test`.
- Casos nuevos: cancelaciones simultáneas con la misma versión, promoción FIFO única, prioridad de espera al reactivar, recuperación de ambas cancelaciones, reintentos sin registros/enlaces/mensajes duplicados, versiones de borrador obsoletas, finalización simultánea única y finalizado bloqueado.
- Fallos mediante triggers exclusivos de la base desechable: al crear el mensaje de una promoción se revierten también la cancelación anterior, sus avisos, auditorías y enlaces; fallo durante cierre masivo revierte el cierre; fallo de auditoría revierte un borrador o una finalización, sin acreditar asistencia; el reintento posterior finaliza una sola vez. No se añaden triggers a migraciones ni a la aplicación.
- Verificación SQL de categorías: solo revisión/confirmada cuentan cupos, y cerrar una salida cancela los cuatro estados vigentes sin alterar una inscripción histórica `completada`. Operaciones sobre estados desconocidos se rechazan sin reescribirlos.
- TypeScript, compilación y `git diff --check` correctos. El ejecutor elimina las bases temporales, incluidos triggers y fixtures. Sin beta, correos, cargas, cambios de permisos ni publicación.

La verificación no incluye un nuevo recorrido visual o lector de pantalla, sesiones Entra reales ni entrega de mensajes por Graph. No se alteró la interfaz; se conservaron los componentes y los contratos. Las restricciones futuras de estado requieren la revisión y migración separadas indicadas arriba.
