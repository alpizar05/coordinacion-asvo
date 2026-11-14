# E6/C09 — Gestión antigua de salida, inscripción, serie y foto

14 de noviembre de 2026. Alcance limitado a contratos antiguos y adaptadores necesarios. Se preservan las implementaciones/documentación previas de E4/E5 y reauditorías, sin publicar nada.

## Consumidores revisados y decisión

| Camino | Consumidores y decisión |
| --- | --- |
| manageOuting/manageOutingRecord | Se conserva la acción, adaptador staff-actions y pruebas. En la página de salida, Solicitud de apoyo puede seguir mostrando el formulario manageOuting cuando canEditRequest es verdadero, incluso fuera de edición. No se considera todo el código JSX muerto. |
| manageEntry/manageLegacyEntry | Se conserva acción, adaptador y payload de navegación por compatibilidad. El flujo de gestión moderno sigue usando manageRegistration y sus paneles. |
| updateAutomaticCollection | Se mantiene retorno de error FormResult o redirect de éxito, con tipos/catch explícitos. El editor actual sigue usando saveAutomaticCollection. |
| managePhoto | Se conserva el redirect antiguo; la referencia JSX está bajo editing en un panel que el return final no muestra al editar. El editor/diálogo modernos permanecen separados. No se borró el export ni esa rama. |
| privateAction | Conserva el redirect de compatibilidad, mientras submitPrivateRegistration permanece como flujo privado estructurado. Tiene consumidores reales en registration. |

No se retiraron adaptadores ni JSX. La limpieza R2 y el contrato de creación manual C10 siguen separados. Las referencias y contratos de tests no demuestran ausencia de consumidores externos, por lo que se mantiene la compatibilidad.

## Contratos y clasificación

`LegacyOutingResult` reutiliza FormResult con payload de éxito obligatorio outcome updated/completed/deleted. El conflicto de unidad tiene metadato issue explícito; no se interpreta la redacción de error ni strings completada/eliminada/unidad-incompatible para decidir el resultado. `manageOutingRecord` ya no retorna strings/void. La autorización permanece sobre la misma salida y unidad bajo bloqueo.

Los errores independientes se reúnen por campo en datos/logística, fechas/modalidad, visibilidad/cierre y cupo/motivo. Confirmaciones y motivos requeridos tienen su campo; permisos, conflictos de inscripciones/unidades/fechas compartidas, conexión y estado cerrado siguen generales. No se agregaron restricciones nuevas de producto a los textos que antes no tenían límites.

`LegacyEntryResult` reutiliza FormResult con back obligatorio. Recursos inválidos/inexistentes y denegaciones ya no terminan silenciosamente. El resultado del helper de decisiones se consume mediante saved === true; los errores de controles se adjuntan con el validador compartido, sin interpretar mensajes ni restringir los identificadores históricos aceptados. La navegación mantiene filtros permitidos, ancla por inscripción y el cambio histórico a estado=todos tras éxito.

`legacyResultMessage` es una adaptación pura de presentación HTTP: conserva error general y todos los mensajes de campos, sin mutarlos ni usar su texto como códigos. Los mensajes idénticos pueden compactarse en el resumen; el resultado interno mantiene los campos separados. No es un sistema paralelo de resultados.

## Wrappers HTTP y errores

- manageOuting conserva rutas/query/fragmentos y terminales. Solo outcome de éxito clasificado habilita confirmaciones o dispatch normal; excepciones son error general seguro. UUID inválido usa la lista de convocatorias con alerta persistente.
- manageEntry conserva su redirect. Solo guarda confirmado o una indicación explícita flushUpdates habilitan despacho posterior al commit. No se usa la ausencia de error para anunciar éxito.
- updateAutomaticCollection conserva los campos del resultado fallido y captura errores técnicos generales; su redirect queda fuera del catch para no tratarlo como fallo.
- managePhoto comprueba la respuesta con checkedFormResult, resume todos los errores y solo usa confirmacion=foto con saved === true. UUID inválido vuelve a un destino interno seguro. No se modifica attachOutingPhoto ni su diálogo.
- privateAction exige éxito literal para actualizada=1. Un token inválido vuelve a /privado/invalido?error=1, sin interpolar caracteres de ruta/query no autorizados; tokens válidos conservan su URL y sus reglas.

Las firmas y nombres de acciones se mantienen. Acciones con redirect declaran Promise<never>; updateAutomaticCollection mantiene la diferencia legítima de FormResult en fallo y redirect al guardar. Los servicios internos que consumían strings/void deben usar el resultado explícito y se migraron juntos. No se cambiaron Route Handlers ni contratos de datos de consulta.

## Reglas y efectos conservados

Se mantienen transacciones y orden de bloqueos, auditoría, cupos, FIFO, cancelaciones, eliminación condicionada a inscripciones, publicación con portada, herencia de fotos y permisos compartidos. No se agregó versión al protocolo antiguo: las decisiones usan el estado actual bajo bloqueo; la serie/foto conservan sus controles de versión existentes. Los editores actuales mantienen sus versiones y formularios propios.

Los no-op válidos de fechas/publicación/agrupación conservan su éxito explícito sin inventar un estado global de no-op. La visibilidad inválida era un retorno silencioso tratado como éxito sin guardar: ahora devuelve error de campo y no confirmación.

Se preserva el caso histórico de reapertura rechazada que reserva primero un cupo a alguien en espera. El error de la reapertura no se presenta como éxito. El resultado antiguo puede solicitar flushUpdates en ese camino, después de commit, para conservar el despacho de las promociones legítimas; no significa que la reapertura se guardó. Los errores puros de controles no habilitan ese despacho. No se altera la regla FIFO validada en E4 ni se agrega rollback global a los rechazos de negocio.

Excepciones SQL/auditoría/cola siguen abortando su transacción. No hay nuevas notificaciones, plantillas, destinatarios, enlaces o reglas de idempotencia. Las fotos mantienen su bitácora, compensación y referencias compartidas; galería y reintentos se prueban sin Graph real.

## Formularios, navegación y límites

Los caminos antiguos con redirect no mantienen un formulario montado ni pueden conservar archivos seleccionados tras navegar. Se conserva su comportamiento HTTP y no se les atribuyen las garantías del editor moderno. Los errores de esos wrappers se resumen en la alerta existente; no se afirma que ya tengan errores junto al campo o foco del primer control en el DOM. Migrarlos a UX moderna sería otra tarea autorizada, con compatibilidad explícita.

No se modificaron menús, paneles inferiores, modales, estilos de editores, filtros/pestañas o restauración de contexto actuales. Se agregó únicamente la alerta general de fallback en la lista para que una entrada inválida no termine sin mensaje. No hay persistencia nueva de formularios, tokens ni datos personales en navegador.

## Pruebas y evidencia

Node 26.13.1, npm 11.7.0, PostgreSQL 18.7 UTF-8 desechable y Next 16.4.5 Webpack. Binarios/fuentes oficiales verificados por SHA-256; destino local/reservado comprobado antes de escribir. Sin dotenv privados ni beta. Las pruebas simulan Next/Auth.js y bloquean proveedores; las acciones, SQL, permisos y workflows son reales.

- 103 unitarias; 38 módulos explícitos: líneas 1230/1230 (100 %), ramas 1311/1355 (96,75 %), funciones 225/226 (99,56 %). No es cobertura de plataforma/React/SQL.
- TypeScript en copia fresca con tests/types/legacy-operation-contract.ts: sin string/void del servicio, outcome requerido y contratos compartidos compatibles.
- Ocho controles CI, contratos, lint/formato y compilación/HTTP/server-only aislados. Sin Turbopack adicional.
- Integración completa de 22 grupos y repetición dirigida final de legacy-operation-contracts después de explicitar flushUpdates; ambas pasaron. Bases y triggers ficticios retirados por el runner.

La suite legacy-operation-contracts cubre UUID/token inválidos, recurso inexistente, roles, múltiples campos, no-op de fechas, fallo de auditoría y reintento, conflicto de unidad, filtros históricos de inscripción, confirmación/repetición, metadatos de campo, promoción FIFO legítima con flushUpdates, serie con versión obsoleta, foto de galería repetida sin duplicado, eliminar/completar/cancelar, y conexión cerrada en los cuatro wrappers. Los rechazos sin efectos legítimos comparan snapshots completos y exigen ausencia de confirmación/revalidación; la promoción legítima se verifica separadamente con estado y un mensaje reales en la base ficticia. registration conserva pruebas de privateAction para tokens válidos.

## Pendientes

No se ejecutó una nueva matriz CUA desktop/celular. Pendiente verificar alertas/fragmentos y redirects en los caminos alcanzables, Solicitud de apoyo, los límites de la UX antigua y ausencia de regresión en editores modernos. Las pruebas SQL/compilación no acreditan foco, lector de pantalla, teclado, archivos ni restauración visual.

Sin migraciones, dependencias nuevas, cambios de proveedores, publicación o workflows activados. E6/C09 se considera cerrada funcionalmente solo con las comprobaciones registradas; R2, C10, matriz visual/E7, CI remota e infraestructura siguen pendientes.
