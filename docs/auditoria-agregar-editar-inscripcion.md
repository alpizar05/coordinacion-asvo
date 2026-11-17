# Auditoría de Agregar y Editar inscripción

16 de noviembre de 2026. Revisión del diff local posterior a b7de052; sin publicación. Complementa [la implementación](contratos-agregar-editar-inscripcion.md), cuya evidencia anterior se conserva separada.

## Resultado y alcance

No se encontró un defecto funcional adicional confirmado en esta familia. No se alteraron las acciones, servicios ni componentes durante esta auditoría: se ampliaron las pruebas y la evidencia. Se revisaron AGENTS, documentación de Next instalada, README, TODO, auditorías de utilidades/contratos, diff, acciones canónicas y adaptador, consumidores, validaciones, autorización, transacciones, feedback y restauración de navegación.

| Frontera | Resultado verificado |
| --- | --- |
| Alta | Servicio, acción y adaptador compatibles. FormResult especializado exige status revisión/espera. checkedStaffRegistrationAddedResult conserva el payload tras checkedFormResult; no deduce el estado de un texto ni asume revisión |
| Edición | FormResult sin status obligatorio: no es una nueva recepción. Mantiene estados, permiso por unidad y versión bajo bloqueo/transacción |
| Respuesta inválida | Vacía, null, array, string, saved no booleano, errores vacíos, contradicción, rechazo y alta sin estado válido conservan modal/datos; no emiten navigationSaved ni confirmación |
| Feedback | General y varios errores independientes juntos. Resumen navegable, aria-invalid/describedby enlazados, foco en primer campo. Corregir observación conserva errores de llegada |
| Pendiente | inFlight, pending y finally permanecen. Doble clic en cada modal/viewport produjo una sola invocación por intento demorado y recuperó controles para reintentar |
| Compatibilidad | Adaptador de alta conservado y probado. No se añadieron any, casts amplios, contratos duplicados ni ejecutores genéricos. Las consultas siguen teniendo su propio contrato |

La revisión del diff confirma que no se cambiaron reglas de cupos, promoción FIFO, estados, notificaciones, permisos, herencia ni navegación. Los casts DOM preexistentes ajenos a esta homologación no se presentan como eliminados.

## Persistencia y fallos posteriores al commit

Se amplió scripts/test-staff-registration-results.mjs con fallos sintéticos de invalidación **posteriores al commit**, conservando acciones, servicios, SQL y reglas reales. En alta el rechazo ocurre después de guardar inscripción, auditoría y aviso demo. El reintento es detectado como duplicado y no genera otro aviso. En edición los detalles, auditoría y aviso ya persisten; reusar la versión anterior produce conflicto sin otra actualización ni aviso.

Por tanto, un rechazo de la promesa o respuesta malformada solo demuestra que la UI no confirmó el resultado; **no demuestra ausencia de efectos persistidos**. No hay reenvío automático ni promesa de idempotencia global o entrega exactamente una vez. El fallo de auditoría dentro de la transacción, probado por separado, sí revierte los cambios y permite reintentar.

## Comprobaciones ejecutadas nuevamente

Entorno limpio sin dotenv del proyecto: Node 26.13.1, npm 11.7.0, PostgreSQL 18.7 UTF8 en 127.0.0.1:55508, clúster nuevo y bases reservadas desechables. Graph bloqueado/simulado y destinatarios ficticios .test.

- `npm run ci:typecheck`: typegen y tipos, incluidas incompatibilidades negativas del contrato de alta.
- `npm run test:unit:coverage`: 107 aprobadas; 39 módulos declarados, líneas 100 %, ramas 96,77 %, funciones 99,56 %. No es cobertura global ni React.
- `npm run test:contracts`, `npm run test:ci` (8), `npm run lint` (354 archivos en la comprobación final), `npm run format:check` (alcance configurado) y `git diff --check`.
- `npm run test:integration:ci -- --only=<grupo>`, por separado: staff-registration-results, functional-actions, staff-forms, workflow-transitions y authorization. Cinco aprobados; no se ejecutó todo el manifest. Un primer intento con grupos separados por coma fue rechazado por el runner antes de crear fixtures; se corrigió la invocación.
- `npm run test:security:build`: Webpack aislado, HTTP/cabeceras/Auth.js, cron no autorizado y rechazo del import DB desde cliente, sin base de aplicación ni proveedores.

La integración incluye altas revisión/espera, campos múltiples, persona inexistente, sin sesión/otra unidad/rol insuficiente, duplicados y altas concurrentes; edición con estados y versiones, fallo de persistencia, rollback/reintento, decisiones simultáneas, cupos/FIFO y atomicidad de auditoría/avisos. Las reglas no fueron reemplazadas por dobles. El contexto de sesión, transporte externo y la invalidación sí usan los adaptadores de prueba documentados.

## Navegador ejecutado, separado de SQL

[Registro de observaciones](../tests/staff-registration-results/browser-audit-results.json). Harness en copia temporal, acciones sintéticas y layout de autorización sustituido; consumidores/CSS reales. La variante review-page.jsx incorpora el **proveedor, restorer y NavigationResults reales** sobre una lista ficticia larga y una ruta interna permitida. El contador solo registra eventos de guardado UI, no commits SQL.

| Recorrido | Desktop | Celular 390 × 844 |
| --- | --- | --- |
| Agregar | Errores conjuntos, corrección independiente, 10 respuestas inválidas/rechazadas, doble clic demorado y éxito en espera | Errores conjuntos, alta sin status, doble clic, reintento y éxito en revisión |
| Editar | Errores conjuntos, 8 respuestas inválidas/rechazadas, doble clic y éxito | Errores conjuntos, contradicción, doble clic, reintento y éxito |
| Navegación | Ambos éxitos conservaron criterios y desplazamiento 1896px | Edición 1907,5px y alta 1862,5px conservados; mismo estado/pestaña en URL |

Los intentos demorados fueron alta 12/edición 10 en desktop y alta 16/edición 14 en móvil; el reintento válido inmediato fue respectivamente 13/11/17/15. Los logs del doble no registraron invocaciones adicionales por esos dobles clics. Las pruebas posteriores de transporte fueron altas 18/19 y edición 16/17; no se confunden con los intentos anteriores.

Se observaron datos/persona/fechas conservados, transporte/cantidad/interés 70 conservados tras error, modales de 358px sin overflow horizontal en móvil y sin desbordamiento desktop; IDs de errores vinculados y distintos. El resumen enfocó observaciones y el primer error enfocó llegada. Escape sin cambios cerró y devolvió foco al disparador; con cambios pidió confirmación y Seguir editando conservó datos. Escape pendiente en alta fue bloqueado; el intento equivalente de edición llegó después de terminar la respuesta, por lo que **no certifica ese timing** (la rama compartida pending se revisó en código).

Teclado: Tab/Shift+Tab y apertura/cierre ejercitados en ambos modales. IAB puede llevar el foco a chrome/BODY en el límite del diálogo nativo; el siguiente Tab volvió al diálogo y el árbol AX mantuvo el fondo inerte. No se certifica una trampa personalizada de foco ni el anuncio hablado. Esa observación se conserva explícita en el registro, no como aprobación automática.

Capturas: [alta móvil](../tests/staff-registration-results/evidence/audit-add-mobile.png), [edición móvil](../tests/staff-registration-results/evidence/audit-edit-mobile.png), [edición desktop](../tests/staff-registration-results/evidence/audit-edit-desktop.png).

## Límites y pendientes

- CUA es interactivo, no CI autónomo. No se usaron dispositivos físicos, lectores de pantalla hablados ni matriz entre motores.
- Conservación de URL/posición se verificó con lista sintética y proveedor real; no con consultas/filtros de las páginas de negocio completas, cambios de pertenencia del registro ni recorridos multinivel. Esos controles mantienen su pendiente existente.
- El formulario no incluye archivos; no se atribuye aquí cobertura de fotos.
- Las respuestas UI son simuladas; las pruebas SQL demuestran persistencia por separado. No se ejecutó correo/Graph real, beta, infraestructura ni CI remoto.
- Los fixtures se retiraron y el clúster temporal se detuvo; las pruebas reproducibles y evidencia ficticia quedan como archivos del proyecto.
