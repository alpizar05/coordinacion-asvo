# Resultados de Agregar y Editar inscripción en Coordinación

Revisión posterior: [auditoría de comportamiento, postcommit y navegador](auditoria-agregar-editar-inscripcion.md). La evidencia siguiente corresponde a la primera implementación; la auditoría distingue las comprobaciones ampliadas y sus límites.

16 de noviembre de 2026. Primera etapa de [la auditoría de utilidades](auditoria-utilidades-formularios.md). Implementación y verificación locales, sin publicar. Se conserva la documentación de la auditoría previa como evidencia histórica.

## Alcance y contrato

Se revisaron AGENTS, README, TODO, auditoría de utilidades/E7, AddRegistration/EditRegistration, acciones canónicas y adaptadores, servicios, transiciones y pruebas. Seguían pendientes la validación runtime de ambos consumidores, el status opcional del alta y el mensaje general oculto al coincidir con fieldErrors. No se repitieron las migraciones C01–C10.

- `StaffRegistrationAddedResult` en lib/staff-registration-result.ts reutiliza `FormResult<string,{status:'revisión'|'espera'}>`. El estado es obligatorio únicamente en el éxito del alta. Los fallos mantienen error general y/o varios mensajes por campo.
- `checkedStaffRegistrationAddedResult` delega la validación del feedback a checkedFormResult y comprueba el payload status de la respuesta original sin casts ni any. La proyección compartida no conserva status: el resultado especializado lo reincorpora únicamente cuando es válido. No es un nuevo ejecutor ni una unión global de operaciones.
- `isStaffRegistrationReceivedStatus` expresa ese conjunto para el consumidor y receiveStaffRegistration. No valida ni normaliza estados históricos o de edición. La recepción sigue usando las decisiones y SQL existentes; un estado inesperado aborta dentro de la transacción, por lo que no confirma filas/auditoría/avisos parciales.
- El servicio de recepción declara el éxito con id y status requerido; la acción addRegistration y su adaptador mantienen argumentos/exportaciones con el contrato de alta preciso. El payload id existente no se elimina de la respuesta del servidor; la UI no lo necesita para mostrar el estado.
- EditRegistration usa checkedFormResult. Su éxito sigue sin requerir status: editar no es volver a recibir ni confirmar una solicitud. No se obliga a cambiar su contrato por simetría con Agregar.

## Comportamiento conservado

En Agregar: búsqueda/selección de persona, detalles de participación, reserva y mensaje revisión/espera se mantienen. Se valida la respuesta antes de navigationSaved, limpiar dirty, cerrar, confirmar o refrescar. Ya no se asume revisión cuando falta un status válido. Se conserva el formulario y se muestra un error general que pide revisar la lista antes de reintentar; no hay reenvío automático.

Agregar ahora pasa conjuntamente error y fieldErrors al feedback: no oculta el general al recibir errores por campo. Editar conserva esa presentación conjunta. Una respuesta vacía, string, saved truthy o éxito contradictorio no alcanza las acciones de éxito. Un rechazo de la promesa sigue en el catch existente, con datos conservados.

No se cambiaron refs inFlight, pending/finally, montaje del formulario, controles, selección, búsqueda, validadores, resumen, ARIA ni foco. La confirmación temporal queda después del resultado válido. No se modificaron estilos, navegación compartida ni otros formularios. Ambos formularios carecen de selector de archivos; esta etapa no cambia ni verifica el flujo de fotos.

Autorización, unidad, póliza, bloqueo de salida/inscripción, comprobación de versión y movimiento entre salidas permanecen en el servidor y bajo sus transacciones. Se conservan cupos/espera/FIFO, auditoría y notificaciones. Los efectos postcommit de alta/edición solo comprueban saved literalmente verdadero; no se cambia el despacho ni la cola.

La edición conserva su semántica histórica: revisión y espera permanecen en su estado; confirmada con las mismas fechas permanece confirmada; cambiar fechas de una confirmada la devuelve a revisión. No se agregó una confirmación automática.

## Pruebas ejecutadas

Node 26.13.1, npm 11.7.0 y PostgreSQL 18.7 UTF8 preparados temporalmente desde fuentes/binarios oficiales, con los SHA256 registrados en la validación de runtime. Clúster nuevo en 127.0.0.1:55506, usuario ficticio asvo_ci. Sin dotenv de aplicación ni credenciales beta. El runner verifica destino/versión y crea una base reservada por grupo.

| Comprobación | Evidencia |
| --- | --- |
| TypeScript / Next typegen | Copia fresca sin dotenv ni archivos generados previos. tests/types/staff-registration-result.ts admite revisión/espera, exige status y rechaza éxito sin payload, confirmada, saved string y contradicción. Acción y adaptador compatibles; edición conserva FormResult |
| Unitarias y cobertura | 107 aprobadas. Tres nuevas pruebas en staff-registration-result.test.mjs: estados, respuestas inválidas y errores conjuntos sin mutación. 39 módulos puros declarados: líneas 1248/1248 (100 %), ramas 1320/1364 (96,77 %), funciones 227/228 (99,56 %). No es cobertura global ni de React |
| Integración nueva | staff-registration-results: acciones/servicios/SQL reales y adaptadores; sin sesión, otra unidad, errores independientes, persona inexistente con error general/campo, revisión/espera, duplicado, dos altas simultáneas, edición/estados, versión obsoleta, fallos de auditoría y reintentos |
| Regresión afectada | functional-actions, staff-forms, workflow-transitions y authorization aprobados. Cinco grupos en total contando el nuevo; no se afirma haber ejecutado los 24 del manifest |
| Contratos | Auditores de fronteras/autorización y Auth.js/correo con dobles aprobados; no se retiraron adaptadores ni se amplió acceso |
| CI local / calidad | Ocho controles CI locales, lint (352 archivos), formato del alcance configurado y diff aprobados. No se ejecutó ni activó CI remoto |
| Compilación | Build Webpack aislado, HTTP local/cabeceras/Auth.js/cron no autorizado y rechazo real de importar DB desde cliente; sin DB de aplicación ni proveedores |

La integración compara registros, auditoría, links, outbox y demo_mail antes/después, no solo dos delegaciones. Alta repetida no crea otra inscripción. Dos altas de una misma persona producen un éxito y un duplicado, con una recepción/alta auditada y un aviso demo; dos ediciones con la misma versión producen un éxito y un conflicto, con una auditoría/aviso. El trigger sintético que falla al auditar revierte cambios y notificaciones; después de retirarlo se puede reintentar. Cero llamadas de proveedor y cero outbox real.

No se promete que todo rechazo de transporte implique ausencia de commit: una respuesta puede perderse después del guardado. Se conserva la protección existente contra duplicados y se evita reenviar automáticamente. La prueba de inFlight tampoco equivale a idempotencia de servidor para todos los escenarios.

## Navegador: evidencia acotada y límites

Se ejecutó `tests/staff-registration-results/fixture.mjs` mediante CUA IAB. Copia temporal de los dos consumidores reales y CSS, con imports de sus acciones sustituidos únicamente en esa copia por acciones sintéticas JS. No hay base ni proveedores en el harness, y una guardia bloquea llamadas externas. Restricciones alimentarias selecciona la respuesta del doble; no modifica el producto. Es una prueba de frontera/UI, complementada por la integración de reglas reales.

[Registro de navegador](../tests/staff-registration-results/browser-results.json) y capturas de [edición móvil](../tests/staff-registration-results/evidence/edit-mobile-errors.png) y [alta sin estado](../tests/staff-registration-results/evidence/add-mobile-no-status.png).

Verificado:

- Alta desktop: búsqueda y selección, error general con dos campos y varios mensajes, foco en llegada; observación/persona/fechas conservadas.
- Alta ante missing/truthy/contradictory/no-status/invalid-status/throw: modal abierto y observación conservada. Lista de espera y revisión muestran sus mensajes específicos únicamente tras éxito.
- Doble clic demorado de alta: siete llamadas previas, una nueva (8), después reintento exitoso (9). La prueba posterior de revisión es la llamada 10 y el alta móvil sin estado la 11; no hay otra llamada automática.
- Edición: error general y campos juntos; missing/truthy/contradictory/throw no cierran ni limpian. Doble clic demorado es una sola llamada (6) y reintento exitoso (7), con cierre/franja.
- Viewport móvil 390 × 844: edición con errores y alta sin estado, modal de 358px, sin overflow horizontal; aria-invalid/describedby con IDs distintos y foco en primer campo. Los criterios estado/pestana permanecieron en la URL al fallar y refrescar.

No se ejecutó una matriz completa de filtros/posición en listados reales ni recorridos multinivel: el harness no contiene esos listados. Los hooks de navegación no se modificaron y sus unitarias existentes pasan dentro de la suite. Quedan por separado esa matriz completa, voz de lectores reales, móviles físicos y comparación entre navegadores. CUA sigue requiriendo sesión interactiva y no constituye CI autónomo.

## Seguimiento y limpieza

Etapa 1 queda implementada y verificada en su alcance funcional, automatizado y CUA acotado. No completa otras fronteras detectadas en la auditoría: público/privado, importaciones y OutingDecisionForm permanecen fuera. Tampoco implementa privatización de exports ni simplificación de ActionModal. No se modificaron migraciones, configuración de proveedores ni workflows.

Los fixtures de integración se retiran con sus bases reservadas; el harness retira la copia UI al cerrar. La limpieza final comprueba cero bases reservadas, detiene el clúster y retira fuentes/binarios temporales. Las pruebas reproducibles y la evidencia ficticia permanecen en el repositorio, sin publicación ni subida a GitHub.
