# Lineamientos para extender ASVO

Estado de referencia: revisión documental del 13 de noviembre de 2026, checkout `23e8bff`. Complementa [la reevaluación](reevaluacion-refactorizacion.md) y [las plantillas de solicitud](plantillas-solicitudes-codigo.md). Describe patrones existentes; no introduce una arquitectura obligatoria nueva ni modifica AGENTS.md.

## Antes de escribir

1. Leer AGENTS.md, README, TODO y la guía del área. Cuando el cambio usa APIs de Next, consultar la documentación instalada correspondiente a la versión del proyecto.
2. Seguir el recorrido real: pantalla → acción → caso/consulta → SQL/proveedor → respuesta → navegación. Inventariar consumidores y reglas que no pueden cambiar.
3. Definir aceptación con ejemplos positivos, negativos y concurrentes cuando corresponda. Separar una regla aprobada de una hipótesis de producto.
4. Elegir el alcance mínimo. No instalar un framework/ORM, reorganizar carpetas o retirar compatibilidad para resolver una edición pequeña.

## Ubicación y responsabilidad

| Pieza                 | Patrón existente y criterio de extensión                                                                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pantalla/entrada Next | `app/...`: composición y presentación; puede consultar mediante los mecanismos actuales. Para una consulta reutilizada o compleja, extraer un módulo en `lib`; no crear una capa de repositorios vacía para cada tabla        |
| Server Action         | `app/actions/<funcionalidad>.ts`, con `use server`: autenticar, validar entrada, llamar caso de uso y devolver resultado/redirect compatible. Efectos de navegación/cache después de commit                                   |
| Caso de uso           | Módulo concreto en `lib` (ej.: `staff-registration-cases.ts`). Recibe principal/contexto y DB/transacción según la operación; no importa páginas/componentes ni inicia otra transacción arbitraria dentro de una ya existente |
| Consulta              | Función tipada para el resultado necesario (ej.: `volunteer-search.ts`, `staff-registration-queries.ts`). Proyección mínima, alcance y orden estables; no devolver filas sensibles al cliente por conveniencia                |
| Decisión pura         | Validación, autorización o transición sin IO, con entradas explícitas. Reloj/identificadores se inyectan cuando la regla los necesita; no sustituir la propia regla en pruebas                                                |
| Proveedor             | Adaptadores de Graph existentes; detalles de transporte fuera de UI/caso puro. Conservar las semánticas distintas de correo y archivos                                                                                        |
| Compatibilidad        | Delegaciones existentes mientras tengan consumidores aprobados. Todo retiro exige inventario; no copiar su contrato heredado a un módulo nuevo                                                                                |

Los servicios nuevos deben preferir políticas desde `authorization.ts`; sesión y credenciales pertenecen a la frontera de servidor. Esta guía no afirma que todos los módulos viejos ya sigan esa separación. No cachear sesión/permisos entre usuarios ni sustituir la relectura transaccional necesaria por un principal antiguo.

## Datos, reglas y efectos

- **Validación:** usar `form-input`, validadores de dominio, fechas y límites compartidos. Servidor es autoridad. La validación del cliente orienta y reevalúa campos después del primer intento, sin borrar errores independientes. Validar también JSON, archivos/CSV y respuestas externas que se utilicen.
- **Resultados:** preferir `FormResult<Field, Success>` con `saved: true` solo tras guardar. Varios errores por campo cuando sean independientes; permisos, conexión, versiones obsoletas y conflictos generales no se asignan a campos artificiales. Mantener `issue`/modal importante cuando el flujo ya lo requiera. Adaptar contratos anteriores en su borde en vez de ensanchar el contrato compartido a `any`.
- **Autorización:** operación + actor + unidad + recurso, con denegación por defecto. Agregar nuevas claves a la matriz únicamente con reglas de producto aprobadas y pruebas directas. Layout/botón oculto no concede seguridad. Admin no se convierte implícitamente en Coordinación y Voluntariado General no se puede retirar.
- **Transacciones:** preservar los bloqueos/precondiciones actuales y la secuencia de locks del caso (salida antes de sus inscripciones, relectura tras esperas cuando corresponde). Estado, auditoría y mensajes asociados deben confirmar o revertir juntos. Para un recurso nuevo, documentar el orden de locks y probar concurrencia; no imponer un orden global imaginado a todos los módulos.
- **Cupos y estados:** reutilizar `workflow-transitions`/`registration-workflow`. Revisión y confirmación reservan; espera/cancelación/rechazo no. Preservar promoción FIFO, motivos, recuperación y límites actuales. Borrador del 70 no acredita asistencia; finalizado permanece bloqueado. No normalizar históricos desconocidos.
- **Idempotencia:** comprobar antes lo que ya ofrece el caso. `photoOperation` y su ledger protegen el pipeline actual, no toda acción nueva ni una sesión recargada. Distinguir intento repetido, payload cambiado y creación intencional nueva; probar respuesta perdida y simultaneidad donde haya efectos persistentes.
- **Correo:** encolar en la transacción y despachar después del commit usando outbox. Mantener `.test`, orden por inscripción, reservas, límites y revisión de resultados inciertos. No crear un segundo emisor ni un retry genérico sobre `sendMail`. Aceptación no es entrega.
- **Fotos:** autorizar antes de bytes/carga; preparación y Graph fuera de locks largos; revalidar principal, recurso, versión y límites al confirmar. Reutilizar galería/metadatos/portada/herencia y compensación que protege referencias compartidas. No convertir limpieza de cargas propias en una política general de borrado.
- **Esquema:** nueva migración numerada para cambios nuevos; no editar 0001–0004 aplicadas ni ejecutar DDL al importar, arrancar o compilar. Revisar plan, compatibilidad y datos históricos. Demostración, migración histórica y correo son operaciones separadas y explícitas.
- **Auditoría y privacidad:** actor/recurso/motivo correctos, atomicidad y datos mínimos. No copiar restricciones médicas/contactos de emergencia a logs o eventos por comodidad. Si el nuevo historial necesita un payload estructurado, definirlo sin inventar originales históricos.

## Presentación y navegación

Reutilizar, según el caso: `ActionModal`/`CoordinationModal`, `SectionWorkspace`, `FormFeedbackProvider`, `FormErrorSummary`, controles de campo, `StatusRibbon`, `TableFilters`, filtros activos, `PhotoDialog`, tablas/listas y componentes compartidos de contexto de navegación. Revisar sus props/consumidores reales antes de elegirlos; no asumir por el nombre que cubren cualquier caso.

- Tablas de desktop y listas compactas de celular; filtros móviles en modal y acciones compactas/panel inferior según el patrón vigente. No introducir otro menú de acciones para un módulo sin motivo explícito.
- Errores con identificadores únicos, `aria-invalid`/`aria-describedby`, resumen navegable y foco al primer error. Abrir primero sección/tab/disclosure oculta. No mostrar errores prematuros antes del primer envío.
- Conservar datos, selecciones y archivos preparados cuando falle; no remonte que descarte archivos ni redirección destructiva para un error esperado. Evitar cerrar modal o anunciar éxito por un resultado desconocido.
- Éxito con franja temporal solo tras commit confirmado; errores permanecen disponibles. Usar anuncios y foco sin animaciones innecesarias y respetar movimiento reducido.
- Mantener criterios existentes en URL y usar el contexto compartido para origen/retorno/fila. No inventar procedencia en enlaces directos, no anidar URLs sin límite y no competir con Atrás/Adelante nativos.
- Validar retornos internos autorizados. El contexto nunca sustituye autorización. Búsquedas libres permanecen en memoria por privacidad; no añadir fichas, tokens, formularios, salud o respuestas del servidor a storage para resolver una recarga.
- Un módulo nuevo que necesite otra familia de retorno debe extender el contrato/allowlist/etiquetas/pruebas existentes, no crear su propio `returnTo` sin validación.

## Configuración, pruebas y publicación

Validar variables por función con los lectores existentes; marcar DB/credenciales/adaptadores como servidor. Mantener demo limitado al entorno autorizado. No compartir secretos en props, logs, URLs de diagnóstico o `NEXT_PUBLIC_`. Para una nueva capacidad privada, definir recurso/actor permitido, vigencia, revocación y exposición de su URL antes de implementarla.

Los límites de abuso deben ser proporcionales al actor/operación; no agrupar toda red desconocida bajo una cuota global ni castigar innecesariamente conexiones compartidas. No extrapolar el header de IP de Vercel a otro proveedor sin comprobación. Retención, backups y permisos externos se verifican en tareas autorizadas aparte; no automatizar borrado desde un prompt de módulo.

| Cambio                                    | Evidencia mínima proporcionada al riesgo                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Regla pura nueva/cambiada                 | Casos independientes, límites, entradas inválidas e históricos relevantes; sin DB/red/credenciales. Añadir al denominador de cobertura solo si corresponde y explicar exclusiones                      |
| Escritura/consulta protegida              | Integración en DB local desechable: acceso denegado/directo, unidad/rol, validación, datos guardados, transacción y rollback; versiones/concurrencia si pueden cambiar resultados                      |
| Efecto externo                            | Dobles de proveedor y fallos antes/después de aceptación, timeouts y compensación/revisión según el protocolo. No correo ni carga reales                                                               |
| Cambio de esquema                         | Vacío y actualización/adopción compatible, incompatibilidad, segunda ejecución, fallo/reintento y checksum/concurrencia según el cambio                                                                |
| UI, modal o navegación                    | Teclado/foco, errores/reintento, archivos, criterios/posición y viewport móvil/desktop con fixtures. Si no se ejecuta CUA/navegador, dejar ese límite pendiente; no declararlo cubierto por TypeScript |
| Cambio pequeño reversible de presentación | Comprobación visual y estática pertinente; no escribir tests que copien el JSX solo para aumentar el conteo                                                                                            |

Reutilizar unitarias, contratos, integración y suites CUA existentes. Los seis checks de CI no se suman al denominador de dominio. El workflow actual es manual; no anunciar CI remoto verde, E2E autónomo o cobertura global basándose en resultados locales. Ampliar lint/formato gradualmente, sin mezclar reformateo masivo con cambios de reglas.

La autorización de una tarea debe indicar entorno y publicación. Por defecto, implementar/verificar localmente; no inferir autorización para beta, proveedores, permisos reales, GitHub, ejecución de workflows o despliegue. Si se pide publicar expresamente, revisar migraciones/configuración y verificar el resultado según la guía vigente; no prometer que revertir código revierte datos.

## Reutilizar, extender o crear

1. **Reutilizar sin cambios** si el comportamiento, contrato y accesibilidad ya cubren el caso. Ejemplo: modal de una edición sencilla con `FormResult`.
2. **Extender de forma compatible** si falta una capacidad concreta usada por más de un consumidor o necesaria en el mismo patrón. Agregar una prop/variante pequeña y probar también consumidores anteriores.
3. **Crear una pieza concreta** si el dominio o interacción tiene invariantes distintas y usar la existente requiere parámetros/condicionales artificiales. Ubicarla junto a la funcionalidad, reutilizando contratos transversales. No crear una abstracción global esperando consumidores futuros.
4. **Proponer una excepción** con evidencia: patrón actual que no encaja, alternativa mínima, alcance, riesgo y prueba de compatibilidad. No heredar un defecto conocido solo por consistencia ni cambiar una regla de negocio sin aprobación.

## Propuesta separada para AGENTS.md — no aplicada

Si se decide convertir parte de esta guía en instrucciones permanentes, bastaría un enlace corto a este documento, exigencia de revisar consumidores/contratos antes de duplicar y de declarar evidencia local/remota y autorización de publicación. No copiar todo el manual, cifras de pruebas o pines que se desactualizan. La incorporación requiere una solicitud aparte; esta revisión no modificó AGENTS.md ni `.codex`.
