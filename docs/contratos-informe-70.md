# E1 — Contratos del informe de salida del 70

Fecha: 13 de noviembre de 2026. Implementación y verificación local; sin publicar ni subir a GitHub. Complementa [C01 y el plan](inventario-contratos-heredados.md). Las familias C02–C10 no se migran en esta etapa.

## Cambio y comportamiento conservado

[saveOutingReport](../lib/outing-report.ts) ahora declara `Promise<ReportSaveResult>`, basado en el FormResult compartido. Éxito: `{saved:true,id,status}` con status borrador/finalizado. Fallo esperado: error general y/o fieldErrors. Se retiró el espejo errors legado (incluidas las claves artificiales form/email para conflictos generales). Los errores de campos independientes del validador siguen devolviéndose juntos; el contrato permite varios mensajes por campo.

[report-result](../lib/report-result.ts) contiene los tipos específicos de esta familia y una adaptación pura: requiere saved estrictamente true, id no vacío, estado correspondiente a la intención y ausencia de errores antes de generar el destino. Rechaza respuestas vacías, legadas o contradictorias con error general; nunca deduce éxito de la ausencia de error. No es otro sistema global de resultados ni sustituye la autorización. La acción [submitReport](../app/actions/reports.ts) invalida las rutas únicamente después de sql.begin confirmado y de ese resultado positivo.

Se anotó el tipo de retorno de reportTransition para conservar los literales de estado al reutilizar su decisión. No se cambió su lógica, estados, auditoría ni condiciones. No se amplió FormResult ni se agregó un estado no-op: el flujo vigente guarda y audita cada borrador válido; una repetición con versión anterior falla y un informe finalizado no admite otro guardado. Se preserva esa semántica.

Se conservan nombre/argumentos de Server Action, rutas, query borrador/enviado, método y comportamiento público. El [adaptador antiguo](../app/resumen-salida/[token]/informe/actions.ts) sigue delegando con el tipo preciso porque test-functional-actions lo consume/verifica; no tiene consumidor JSX. Las cuatro suites que consumían el servicio directamente migraron sus expectativas a saved/fieldErrors/error.

## Reglas y efectos

- Token y límites contra abuso antes de la operación; condición SQL de vigencia, revocación, recurso, inscripción confirmada, assigned70 y estado de salida. No requiere una sesión de Coordinación ni convierte esa sesión en permiso del enlace.
- Bloqueos de salida/enlace/informe, versión del borrador y roster permanecen en la misma transacción. No se realizan llamadas Graph dentro o fuera de ella para guardar un informe.
- Borrador: admite campos finales incompletos, conserva los datos, sigue pendiente, no acredita asistencia.
- Finalizar: exige las validaciones actuales, guarda submitted_at y status finalizado; la vista de evidencia deriva asistencia únicamente de informes finalizados. Después no se puede editar ni convertir en borrador. No completa automáticamente el estado de la convocatoria.
- Informe y auditoría atómicos; fallo SQL/auditoría no confirma datos parciales. No se agregan notificaciones ni se altera el seguimiento/cola existente.
- Enlace inválido/vencido/revocado, asignación retirada, falta de correo, roster cambiado, versión obsoleta y conexión/persistencia siguen generales. Los controles editables conservan errores por campo.

## Formularios, confirmación y navegación

ReportForm ya utilizaba feedback compartido, valores/selecciones controlados, secciones montadas y revealField. Se conservan sin cambios de estilos, validación cliente, foco, resumen ni preferencias. Solo se estrecha el chequeo de éxito a saved === true; los errores mantienen datos, sección y formulario. No se agrega almacenamiento de formularios/tokens ni un sistema nuevo de contexto.

Tras éxito se conservan router.replace/refresh y los destinos existentes; no se navega ni se invalida tras un resultado de fallo. La [página del informe](../app/resumen-salida/[token]/informe/page.tsx) usa reportConfirmation: un parámetro de URL solo puede mostrar ribbon si existe un informe guardado en el estado correspondiente. Sin informe, enviado=1/borrador=1 no muestran confirmación; enviado no confirma un borrador. El ribbon sigue siendo temporal y para éxito; los errores permanecen en el feedback del formulario. Esto verifica estado persistido, no agrega un recibo de una sola lectura ni impide repetir el ribbon al recargar una URL de éxito válida.

## Verificación ejecutada

Node **26.13.1**, npm **11.7.0**, PostgreSQL **18.7** consultado por el runner antes de crear fixtures. Node y PostgreSQL oficiales se prepararon en /private/tmp; SHA256 iguales a los registrados en [la validación de runtime](validacion-node26-postgres18.md). PostgreSQL compilado sin instalar globalmente; clúster nuevo, usuario ficticio asvo_ci, bind 127.0.0.1:55489 y PGDATA/socket temporales. No se usaron dotenv privados ni la base de desarrollo como destino.

| Comando / evidencia | Resultado |
| --- | --- |
| npm run ci:typecheck | Next typegen y TypeScript en copia sin .env/.next previos. |
| npm run test:unit:coverage | 96 pruebas; 36 módulos explícitos: líneas 1177/1177 (100 %), ramas 1249/1293 (96,60 %), funciones 215/216 (99,54 %). No es cobertura global. |
| tests/unit/report-result.test.mjs | Cuatro pruebas: éxito borrador/final, respuestas ambiguas/contradictorias, generales + múltiples mensajes por campo sin mutación, flags sin persistencia o estado coincidente. El módulo report-result mide 100 % líneas/ramas/funciones dentro de este alcance. |
| npm run test:contracts | Cinco inventarios/contratos, incluidos adaptadores delegados, dependencias, autorización, Auth.js y correo con dobles. |
| npm run test:ci | Siete checks; workflow manual y pines conservados. |
| npm run test:integration:ci | 18 grupos completos contra bases locales desechables; Graph simulado. |
| npm run test:integration:ci -- --only=functional-actions | Repetido después de tipar el adaptador y añadir aserciones explícitas de ausencia de correo nuevo en informes. |
| npm run test:security:build | Webpack en copia aislada, HTTP local/cabeceras/Auth.js/cron no autorizado y rechazo de importación DB desde cliente; sin conexiones externas/de aplicación. |
| lint / format:check / diff | Comprobaciones del alcance configurado, sin cambios de estilo; enlaces locales comprobados. |
| npm run security:secrets | Sin hallazgos ni fallos sobre 378 archivos publicables e historial local disponible; informe saneado. |

Integración ampliada en test-functional-actions usa acciones y SQL reales, petición/sesión simulada y cero llamadas de proveedores. Comprueba formato de enlace y token inexistente, vencimiento, asignación retirada, falta de correo, errores finales simultáneos, guardado de borrador incompleto y evidencia cero, versión obsoleta, roster cambiado, fallo de persistencia mediante trigger sintético, reintento correcto, finalización, bloqueo de repetición y enlace revocado. En cada fallo compara informe/auditoría/colas y exige ausencia de destination, saved verdadero y revalidaciones. Tras guardar exige las rutas de invalidación previstas; al terminar hay un informe, dos auditorías (borrador/final), evidencia únicamente finalizada y ningún correo adicional por el informe/reintentos.

registration, outing-forms, workflow-transitions y authorization conservan también pruebas directas: estados/labores, concurrencia con un ganador, rollback por fallo de auditoría, revocación y permisos. No se sustituyen reglas de negocio para hacer pasar las pruebas. La vista de evidencia, auditoría y cola se comprueban en SQL, no solo comparando dos delegaciones.

Para repetir integración: seleccionar el runtime fijado y ejecutar con entorno limpio, CI_DATABASE_URL loopback administrativa de un servidor **nuevo/descartable**, sin DATABASE_URL ni credenciales Graph/Auth heredadas. El runner verifica destino, versión y nombres reservados; crea/retira una DB por grupo. No ejecutar scripts sueltos contra una base de aplicación.

## Límites y seguimiento

No se ejecutó una nueva sesión CUA ni una matriz visual desktop/celular. El foco, aria-describedby, apertura de sección, archivos y navegación siguen en componentes existentes y no se presentan como certificados por estas pruebas SQL/unitarias/HTTP. Pendiente comprobar en navegador: error general conservando sección, errores múltiples abriendo la correcta, navegación desde resumen, corrección/reintento, borrador precargado, finalización bloqueada y header móvil. Las evidencias visuales anteriores siguen siendo históricas.

No se repitió Turbopack en esta etapa: el cambio de frontera se comprobó con Webpack, el compilador de referencia del despliegue; la comprobación adicional y el CI manual existentes se conservan. Primera CI remota, contenedor Linux, infraestructura, permisos reales y proveedores siguen pendientes por separado.

Sin migraciones, cambios de configuración de proveedor, correos/cargas reales o publicación. Limpieza final comprobada: PostgreSQL 18.7 sin bases asvo de fixtures, servidor detenido y clúster/binarios/fuentes/logs temporales retirados; las copias de tipos/build fueron retiradas por sus ejecutores. Los triggers sintéticos desaparecieron con las bases desechables. E1 queda completada a nivel funcional/automatizado local; el pendiente visual permanece explícito en TODO y no cierra la auditoría transversal E7.

## Reauditoría específica C01 — Informe del 70

14/11/2026, código funcional de `473369105b3257d03ce0b4df9788f850e150c812`. E1 ya se implementó y fue publicada posteriormente con autorización expresa. Esta revisión no publica ni cambia código funcional. Se contrastaron AGENTS, inventario, la familia anterior, servicio, acción, adaptador, formulario/página, resultados puros y consumidores de pruebas.

No se encontró un contrato heredado activo adicional que requiera otra migración. Los párrafos del inventario sobre id/status sin saved y espejo errors son hallazgos históricos, no la implementación vigente. Se actualizó su estado para evitar repetir E1.

| Borde o caso | Estado vigente y comportamiento que se conserva |
| --- | --- |
| saveOutingReport | Promise<ReportSaveResult>; éxito exige saved true, id y status; errores independientes del validador en fieldErrors |
| submitReport y adaptador | ReportSubmissionResult; destino solo después de commit y validación del resultado; adaptador activo en pruebas, sin retiro |
| Borrador | Admite incompletitud final, conserva versión y contenido; no submitted_at ni evidencia de asistencia |
| Finalización | Validación completa, estado finalizado y auditoría atómicos; edición posterior rechazada |
| Permisos/enlace/roster/versión/conexión | Generales, sin controles artificiales; vigencia y asignación se revalidan en servidor y bajo los bloqueos vigentes |
| Respuesta inválida o contradictoria | reportSubmissionResult no autoriza navegación ni invalidación; no interpreta texto para decidir éxito |
| Formulario ante error | Conserva estado y secciones montadas; revealField abre la sección del error, feedback conserva prioridad del foco; sin replace/refresh de éxito |
| Confirmación | reportConfirmation exige un informe persistido en el estado correspondiente; un flag de URL aislado no confirma |

Se conservaron los contratos HTTP, rutas y argumentos, guardias contra abuso, auditoría y límites transaccionales. El informe no envía correo ni altera cupos/espera, y no completa por sí solo la convocatoria. `_previous` es estado inicial compatible del formulario, no un resultado ambiguo de persistencia. Las consultas de lectura pueden tener resultados distintos de FormResult y no se migraron artificialmente.

### Evidencia vigente y alcance de esta revisión

`tests/unit/report-result.test.mjs` comprueba borrador/final, respuestas legadas/contradictorias, errores generales y múltiples mensajes sin mutación, y confirmaciones condicionadas al estado persistido. `test-functional-actions` cubre acción y adaptador con SQL real, entradas inválidas, errores múltiples, borrador incompleto, selección/versión obsoleta, fallo de persistencia, reintento, finalización y repetición bloqueada; exige ausencia de destino, invalidaciones y correo en fallos. Las suites de transiciones y autorización conservan concurrencia y rollback de auditoría.

La última integración completa sobre este mismo código funcional pasó 19 grupos con PostgreSQL 18.7 local desechable UTF-8 durante E3. La revalidación posterior C04 pasó 101 unitarias, ocho controles CI, contratos, TypeScript, lint y formato con Node 26.13.1/npm 11.7.0. No se repitieron suites, compilación ni escrituras SQL en esta revisión documental: no hubo cambios funcionales ni fallos nuevos que lo justifiquen. Las cifras de la tabla original corresponden a la ejecución histórica de E1 y no se sustituyen como si hubiera sido una corrida nueva.

Aquí se verificaron referencias activas, coherencia de documentación, enlaces locales y diff. No se leyeron dotenv privados ni se accedió a beta/proveedores. No se generaron fixtures, tokens, mensajes, cambios de permisos o migraciones. Se conservaron los cambios documentales previos de C04/C05.

Sigue pendiente CUA específica desktop/celular para foco/secciones, conservación de datos, borrador precargado, finalización bloqueada y navegación. Las pruebas SQL/unitarias y la CUA anterior de ActionModal no acreditan esos recorridos. C01 está resuelta funcionalmente; la matriz visual continúa en E7.
