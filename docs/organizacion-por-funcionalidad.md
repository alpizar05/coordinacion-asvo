# Reorganización gradual de acciones de Coordinación

## Alcance y módulos

`app/staff-actions.ts` pasa de concentrar lógica a ser un adaptador de compatibilidad de 91 líneas. No contiene SQL, reglas de negocio, manejo de sesión propio ni una segunda implementación de validaciones. Las pantallas activas importan acciones por funcionalidad.

| Funcionalidad | Acciones canónicas | Servicios y consultas reutilizados o extraídos |
| --- | --- | --- |
| Voluntariado, pólizas e importaciones | `app/actions/volunteers.ts` | `volunteer-profile`, `registry-mutations`, `registry-import` |
| Convocatorias y agrupaciones | `app/actions/outings.ts` | `create-staff-outing`, `staff-outing-management`, `staff-group`, pipeline de fotos y transiciones existentes |
| Series y destacada | `app/actions/series.ts` | `outing-series`, `outing-unit-conflict`, herencia de fotos y versionado existentes |
| Inscripciones de Coordinación | `app/actions/registrations.ts` | `staff-registration-cases`, `staff-registration-queries`, `legacy-entry-management`, alta/edición/decisiones existentes |
| Informes y conciliación | `app/actions/reports.ts` | `staff-report-cases`, `outing-report`, `attendance-reconciliation` |
| Invitaciones, enlaces del 70 y recordatorios | `app/actions/communications.ts` | `staff-communications`, `report-reminders`, autorización/capacidades existentes |
| Sesión y acceso administrativo | `app/actions/session.ts`, `app/actions/administration.ts` | Auth.js, cookies demo, políticas y mutaciones de permisos existentes |

Los módulos de fotos, editor de convocatoria, decisiones versionadas, acciones públicas y rutas de proveedor/cron ya tenían responsabilidades específicas y se conservan en sus ubicaciones. No se creó una capa genérica de repositorios, un contenedor de dependencias ni un bus de eventos. Los casos de uso no importan módulos de `app`; los adaptadores apuntan a las acciones canónicas, nunca al revés.

## Secuencia de extracción y comprobación

1. Voluntariado: separar acciones, extraer corrección de ficha, migrar consumidores de perfil/unidades/importador. TypeScript e integración de autorización correctos antes de continuar; incluye corrección permitida, rechazo sin rol y conservación de la unidad general.
2. Convocatorias y series: extraer los cuerpos de transacciones de gestión legada, datos comunes y destacada, reutilizar la consulta de conflictos de unidad también desde el editor. Conservar la orquestación externa de fotos y su intención idempotente. TypeScript e integración de autorización correctos antes del siguiente grupo.
3. Inscripciones: reunir alta, edición, consulta y gestión; extraer consultas y cuerpos transaccionales. Mantener los contratos de los modales y la gestión legada por redirección. TypeScript e integración de autorización correctos antes de seguir.
4. Informes: reunir informe privado y conciliación, conservando autorización por capacidad del enlace y por unidad. TypeScript e integración de autorización correctos.
5. Comunicaciones: separar invitaciones, enlaces y recordatorios; después completar sesión y administración. Verificar enlaces vencidos/revocados y permisos mediante acciones reales con dobles de petición.
6. Regresión integral y navegador aislado. Retirar únicamente código confirmado sin consumidores.

## Contratos que se conservan

- Una acción autentica, valida sus parámetros, ejecuta el caso de uso y devuelve el mismo resultado o redirección. La autorización de recurso que necesita SQL sigue dentro del caso y la transacción; no se sustituye por ocultar botones.
- El caller conserva `sql.begin`; se mantienen orden y ámbito de `FOR UPDATE`/`FOR SHARE`, versiones, auditoría y avisos dentro de la misma transacción. La creación con fotos conserva sus transacciones cortas y Graph fuera de bloqueos.
- Las operaciones puras previas a escritura siguen utilizando las validaciones existentes. La corrección de ficha conserva la validación antes de iniciar su transacción.
- Las invalidaciones y el despacho habitual siguen después del commit. Se conserva incluso la llamada histórica de despacho de los adaptadores legados de gestión cuando su resultado es un error, sin introducir una segunda cola ni cambiar sus reglas.
- El correo inmediato, intentos, incertidumbre, `.test`, cron, plantillas y destinatarios no se reorganizan ni modifican en esta etapa.
- Los formularios conservan FormResult, campos, Files en memoria, asociaciones accesibles, modales, filtros, pestañas y contexto. No cambian los enlaces públicos/privados, vencimientos ni alcances.
- No se cambian roles, unidades, cupos, promoción FIFO, recuperación de inscripciones, asistencia ni bloqueo de informes finalizados.

## Compatibilidad y limpieza

Se mantienen las firmas de `app/staff-actions.ts` y de los antiguos archivos específicos de alta/edición/consulta/gestión, conciliación, recordatorios, enlaces del 70 e informe privado. Solo delegan; las pruebas existentes siguen siendo consumidores y verifican estos contratos. Los componentes JSX activos ya no los importan.

El inventario ahora clasifica **73 exportaciones en 24 archivos**: incluye las acciones canónicas y sus adaptadores. Ese incremento no representa permisos ni reglas nuevas. Las llamadas directas a ambos caminos siguen necesitando la misma sesión, rol, unidad o capacidad.

Se retiraron el panel JSX `editData`, que no se incluía en ningún retorno ni prop del editor, su consulta de conflictos sin consumidores y dos imports sin uso. Se conservó `editEnd`: aunque su nombre era parecido, se utiliza como acciones del editor actual. No se retiró el resto de JSX ni adaptadores basándose únicamente en su antigüedad.

La retirada completa de adaptadores queda para una etapa posterior: requiere migrar los consumidores de compatibilidad de las pruebas y revisar el contrato publicado. Las exportaciones de ruta ya acotadas no se movieron solo para cambiar su nombre.

## Corrección detectada por las pruebas

El formulario real de datos comunes envía una lista de `block` y `editableBlock`. `validateCommonSeries` los trataba como escalares y rechazaba series de varios bloques antes de comprobar su alcance. Se corrigió únicamente esa entrada repetida; se siguen rechazando Files como identificadores y valores repetidos en campos escalares. No se elimina la comparación de versión, IDs esperados/editables, confirmación explícita, permisos de todos los bloques ni conflictos de unidad. Regresión unitaria e integración de guardado común de dos bloques con versión obsoleta comprobadas.

## Verificación reproducible

```sh
npm run check
npm run build
npm run test:unit:coverage
npm run test:integration
# Grupo nuevo, también incluido en integración:
npm run test:integration -- --only=functional-actions
# Auditoría estática, incluida entre los contratos:
node scripts/audit-functional-boundaries.mjs
```

El build se ejecutó con variables locales demo ya cargadas en el proceso; no ejecuta migraciones ni necesita credenciales beta para estas comprobaciones.

La suite completa pasa: **84 unitarias**, **17 grupos de integración** y **cuatro contratos/inventarios**. El grupo nuevo usa acciones reales, sesión/políticas reales con petición falsa, SQL local real y fotos sintéticas. Verifica caminos canónicos/adaptadores, errores múltiples, autorización, rollback de ficha y auditoría, invalidación solo cuando corresponde, creación de dos bloques idempotente, portada/herencia, serie manual/común, cambios obsoletos, alta/edición/confirmación/70, invitación, informe privado borrador/finalización/revocación, recordatorio demo y sesión. Los grupos existentes siguen verificando inscripción pública, edición/cancelación privada, cupos/concurrencia, notificaciones y errores.

`audit-functional-boundaries` verifica que los ocho módulos de acciones no tengan SQL inline, que los diez módulos extraídos no importen `app`, que no haya ciclos nuevos en sus dependencias, que los adaptadores solo deleguen y que ningún JSX activo importe los puntos de entrada antiguos. No sustituye autorización ni pruebas de ejecución.

Cobertura del subconjunto explícito de 32 módulos puros: líneas 100 %, ramas 96,59 %, funciones 99,48 %. No es cobertura global ni del SQL/React. Los casos extraídos se comprueban por integración, no se cuentan como reglas puras cubiertas por sustituciones.

## Navegador y límites

Se inició una copia temporal sin archivos `.env`, con base PostgreSQL desechable, seis personas y sus inscripciones ficticias, destinatarios `.test`, modo demo y fetch externo bloqueado, en `localhost:3032`. El servidor habitual de 3031 no se detuvo ni se usó para los fixtures.

Con CUA se comprobó en desktop Solicitudes filtradas → persona → regreso, y en viewport 390×844 la misma ruta desde el último registro, recuperando foco y desplazamiento sin desborde. También Solicitudes → salida → persona → salida → Solicitudes, conservando filtros y pestaña de inscripciones. Ver [evidencia resumida](../tests/functional/browser-results.json). Se cerró la pestaña, se restableció el viewport y se retiraron servidor, copia temporal, base y fixtures.

Esta comprobación fue un recorrido enfocado, no una nueva ejecución exhaustiva de toda la suite de navegador de navegación ni una certificación de lectores de pantalla físicos. No se probaron proveedores reales, ni se cambiaron permisos reales o la beta. No hay migración nueva requerida por esta reorganización. No se publicó ni subió a GitHub.

Nota posterior de seguridad: el modo demo ahora se rechaza durante un build de producción. Para compilaciones de verificación se usa una copia sin .env y configuración ficticia con ASVO_DEMO=0; ver [controles y pruebas actuales](configuracion-y-seguridad.md). Los resultados anteriores describen la etapa de reorganización.
