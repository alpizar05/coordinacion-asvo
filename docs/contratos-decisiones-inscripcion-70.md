# E4/C08 — Contratos de decisiones de inscripción y 70

14 de noviembre de 2026. Alcance: assignRegistration70, changeRegistrationStatus, sus consumidores activos y compatibilidad necesaria. Continúa [destacada de portada](contratos-destacada-portada.md); se conservan los cambios previos sin publicarlos.

## Contrato y consumidores

Los helpers devolvían string de error o undefined de éxito. Ahora declaran Promise<FormResult>, con error general o saved true explícito. Se reutiliza el contrato existente; no se agregó otra unión de resultados ni se cambió la redacción para deducir categorías. Las decisiones puras de workflow-transitions mantienen su semántica y se convierten en resultados explícitos sin interpretar mensajes.

manageStaffEntry devuelve directamente ese contrato; mantiene sus comprobaciones de recurso/unidad, versión y schedule bajo los mismos bloqueos. Sus campos reason, approveDates e identificación de recuperación siguen usando el validador compartido. Cada acción habilita los controles correspondientes; no se inventaron errores simultáneos de campos que no pertenecen a esa acción. Cuando hay varios mensajes o campos independientes, el contrato/feedback existentes los conservan juntos.

manageLegacyEntry también consume saved === true y conserva su objeto back/redirect. No se migraron ni retiraron sus retornos generales de compatibilidad C09, ni se cambiaron filtros/fragmentos de ese camino. recoverRegistration y promoteWaitlist siguen siendo comandos internos sin un resultado de formulario; no se transformaron por asociación. Los consumidores internos que antes esperaban string/undefined deben usar saved/error: se migraron todas las referencias localizadas y las expectativas de sus pruebas. No cambia la firma pública de manageRegistration ni los redirects del adaptador antiguo.

manageRegistration traduce fallos de sesión/conexión/persistencia a un error general seguro en FormResult en lugar de rechazar la promesa con un fallo sin resultado. El cliente ya conservaba datos al capturar excepciones; ahora recibe la misma categoría general por el contrato compartido. No se modificaron Route Handlers ni rutas públicas. Invalida y despacha únicamente después de commit y saved === true. ManageRegistrationForm reutiliza checkedFormResult: una respuesta ausente, mal formada o contradictoria no ejecuta onSaved. No se modificaron RegistrationActions, menú desktop, panel inferior móvil, callbacks de contexto, snapshot del formulario, selección de acción ni componentes de feedback. El foco del error conserva prioridad mediante el hook existente.

## Reglas conservadas

- Asignar/quitar 70 requiere inscripción confirmada y salida abierta/confirmada. Quitar revoca enlaces; asignación, auditoría y mensaje permanecen atómicos. No se limita el número de personas 70 ni se cambia el significado de repetir una asignación válida.
- Confirmación, espera, rechazo y cancelación conservan estados, motivos, fechas externas aprobadas, unidad y cobertura. Los conflictos de versión, schedule, recurso, permisos, cupos o elegibilidad siguen generales; errores de controles se validan en manageStaffEntry.
- Confirmar consume/reserva según las reglas vigentes; espera no consume. Cancelar/rechazar/liberar y mover a espera conservan FIFO y exclusión de la persona trasladada en la promoción inmediata.
- Recuperar inscripciones canceladas conserva prioridad de la espera, póliza y ausencia de otra inscripción activa. No se normalizan estados históricos desconocidos.
- No se mueven decisiones fuera de las transacciones ni se consulta Graph bajo bloqueos. Auditoría, cola, enlaces y cambios correspondientes siguen en PostgreSQL; dispatch posterior al commit conserva los destinatarios, plantillas y protección .test.
- No hay migraciones, nuevos permisos, proveedores, formularios ni reglas de producto. Los reintentos obsoletos del flujo activo se rechazan por versión; no se promete exactamente una vez ante pérdida de respuesta ni se agrega idempotencia global R5. Los helpers internos siguen requiriendo el bloqueo de salida por su llamador.

## Promoción legítima al rechazar una reapertura

La regresión confirmó una regla histórica explícita de test-workflow-transitions: al intentar reabrir una inscripción cancelada, se promueve primero a quien espera. Si esa reserva consume el cupo, la reapertura solicitada devuelve error general, pero la promoción, su auditoría y su mensaje sí se guardan. La inscripción cancelada permanece cancelada y no se confirma su reapertura en el cliente. El mensaje corresponde a la reserva real de la persona promovida.

Se mantuvo esa semántica; no se añadió savepoint ni rollback automático por cualquier resultado esperado de error. La prueba nueva inicialmente asumía ausencia global de efectos en ese caso y se corrigió al contrastarla con la regla existente. No se alteraron las expectativas de FIFO de la suite histórica para hacer pasar una política nueva.

Los fallos de persistencia/cola continúan revirtiendo toda su transacción, incluidas asignación, revocación, auditoría y promociones. La suite diferencia esos fallos técnicos de un rechazo de reapertura con una promoción válida. Tras disponer de capacidad y póliza suficientes, la reapertura correcta sigue respetando la reserva anterior.

## Verificación local y límites

Node.js 26.13.1, npm 11.7.0, PostgreSQL 18.7 local desechable UTF-8 y Next.js 16.4.5. Distribuciones oficiales verificadas por SHA-256; runner con destino loopback y nombres reservados antes de escribir, sin dotenv privados ni beta. Graph/correo real prohibidos mediante dobles y guardias.

- TypeScript en copia fresca, incluyendo tests/types/registration-decision-contract.ts: helpers compatibles con FormResult y rechazo de void/string legados.
- 101 unitarias existentes y cobertura de 37 módulos puros explícitos: líneas 100 %, ramas 96,74 %, funciones 99,55 %. El servicio SQL no se incorpora artificialmente a esa cobertura.
- Ocho controles CI, contratos estáticos, lint y formato; compilación Webpack/HTTP/server-only aislada.
- 21 grupos SQL completos, incluido el nuevo registration-decision-contracts. Los grupos registration y workflow-transitions migraron sus expectativas de string/undefined a saved/error; conservan aserciones independientes de estado, prioridad, cupos, auditoría, cola y concurrencia.

El nuevo grupo usa SQL, acciones, políticas y helpers reales con petición/Next/Auth.js simulados. Cubre sin sesión/rol insuficiente, ID inválido, asignación de 70 en espera, razón requerida, aprobación de fechas, comando obsoleto, dos confirmaciones con un ganador/un mensaje, retirada de 70 y enlace revocado, rollback por fallo sintético de cola, reintento, compatibilidad, promoción legítima durante rechazo de reapertura, póliza, cancelación y promoción única y conexión cerrada. No interpreta mensajes como éxito y verifica ausencia de confirmación/destino/revalidación en fallos. Las promociones legítimas se comprueban contra el estado persistido y sus mensajes, en lugar de exigir erróneamente que toda decisión rechazada sea un no-op.

No se ejecutó una matriz CUA nueva de ManageRegistrationForm/RegistrationActions. Pendiente desktop/celular: conservar acción/motivo/panel, foco y resumen, errores sin cierre, confirmación tras commit y filtros/pestaña/posición al guardar. La revisión de ramas y las pruebas SQL no se presentan como pruebas DOM ni de lectores de pantalla/dispositivos físicos. No se repitió Turbopack; Webpack sigue como referencia. CI remota e infraestructura permanecen pendientes por separado.

Sin publicar, desplegar, subir a GitHub ni modificar beta/proveedores. La auditoría E7 y compatibilidad restante E6/C09/C10 no se dan por completadas con esta familia.
