# Consumidores compartidos de resultados

Revisión local del 16/11/2026. Complementa el inventario de contratos heredados; no cierra la auditoría transversal E7 ni las matrices visuales de cada familia.

## Resultado y cambios

No quedan consumidores del contrato antiguo de ActionModal (`Promise<unknown>`, strings o void) en la aplicación. Su acción ya exige `Promise<FormResult>` y valida la respuesta con `checkedFormResult`. La respuesta vacía es válida como estado inicial, pero nunca como confirmación de una operación. No se agregaron casts, any ni interpretación de mensajes.

RegistryModal ya reutilizaba ActionModalProps. RegistryForm ahora toma también `ActionModalProps['action']`, evitando mantener otra firma equivalente. ReportReminder enlaza directamente el productor, sin wrapper redundante. SplitGroupForm valida la respuesta antes de transformar el destino; una respuesta contradictoria o desconocida no alcanza esa transformación. ActionModal vuelve a validar al recibirla.

Se conservaron inFlight/busy antes del await, finally, fieldset pendiente, captura de rechazos, apertura controlada/local, feedback, archivos y navegación. La franja y el cierre siguen detrás de un éxito literal validado. No se cambiaron servicios, transacciones, permisos, cola ni reglas de negocio.

## Consumidores activos

| Consumidor | Productor | Contrato/frontera |
| --- | --- | --- |
| ProfileEditor | editProfile | FormResult con campos ProfileField; ActionModal |
| VolunteerUnits | updateVolunteerUnits | FormResult; ActionModal |
| Ficha de persona / RegistryModal policy | verifyPolicy | FormResult; RegistryModal → ActionModal |
| AttendanceReconciliation / RegistryModal attendance | reconcileAttendance | Resultado compatible inferido; RegistryModal → ActionModal |
| ReportReminder | sendReportReminder | Resultado compatible inferido; bind → ActionModal |
| SplitGroupForm | splitOutingGroup | FormResult; validación antes de adaptar destino → ActionModal |
| RegistryForm incident | recordVolunteerIncident | FormResult; checkedFormResult |
| RegistryForm grant | grant | Resultado compatible; checkedFormResult |

`tests/types/action-modal-contract.ts` comprueba los ocho productores reales y sus firmas enlazadas, además de ambos wrappers. Rechaza strings, void, unknown, saved no literal y callbacks síncronos. Son imports de tipos; el fixture no ejecuta servicios.

## Compatibilidad conservada y condición de retiro

Estos archivos solo delegan; el auditor de fronteras comprueba que ningún consumidor JSX importa sus rutas. Son compatibilidad de rutas publicadas, no una conversión ambigua de resultados.

| Adaptador | Consumidores locales identificados |
| --- | --- |
| app/staff-actions.ts | test-functional-actions, test-authorization, test-legacy-operation-contracts, test-homepage-feature-contracts, test-manual-series-contracts y tipos de serie manual |
| add-registration-actions.ts | test-functional-actions, test-authorization |
| registration-detail-actions.ts | test-authorization |
| attendance-actions.ts | test-authorization |
| salidas/[id]/resumen/actions.ts | test-authorization, test-brief-contracts |
| resumen-salida/[token]/informe/actions.ts | test-functional-actions |
| edit-registration-actions.ts | Inventarios de autorización y fronteras; sin consumidor dinámico localizado |
| manage-registration-actions.ts | Inventarios de autorización y fronteras; sin consumidor dinámico localizado |
| report-reminder-actions.ts | Inventarios de autorización y fronteras; sin consumidor dinámico localizado |

Todos figuran en tests/authorization/entrypoints.mjs y scripts/audit-functional-boundaries.mjs. Para retirarlos: decidir explícitamente el fin de compatibilidad de las rutas publicadas, comprobar consumidores externos, migrar pruebas a módulos canónicos y actualizar inventarios. La ausencia de JSX por sí sola no autoriza su eliminación. Esta limpieza sigue en R2.

## Contratos legítimamente diferentes

- `checkedFormResult(unknown)` valida una frontera runtime; su parámetro unknown es intencional. Proyecta feedback/destino, no payloads privados.
- `photo-upload-workflow.ts` conserva `validate: (...) => Promise<unknown>`: snapshot opaco de preflight interno de una transacción, no resultado de una acción/modal. Tiparlo requeriría revisar ese contrato específico, no castear un resultado UI.
- PhotoDialog mantiene preparación explícita (`prepared: true`) separada de persistencia (`saved: true`) y checkedPhotoResult.
- Enlaces privados e informe conservan payloads de éxito necesarios y sus validadores/adaptadores especializados (link, id, status y destination). No sustituirlos por una proyección que pierda esos datos.
- Consultas, selección de galería, redirects/Promise<never>, respuestas HTTP y excepciones tipadas para rollback conservan sus contratos. No convertirlos automáticamente a FormResult.

## Evidencia y límites

Con Node.js 26.13.1: TypeScript con Next typegen en copia fresca sin dotenv; 104 pruebas unitarias aprobadas; contratos/auditores con dobles de red y lint de 342 archivos aprobados. La suite de tipos incluye pruebas negativas de compatibilidad. No se ejecutó SQL: no se modificaron productores ni persistencia. No se consultó beta, Graph ni proveedores.

CUA del 16/11 sobre copia UI ficticia: errores independientes junto a campos y resumen, foco en primer campo, texto conservado, modal abierto ante excepción y respuesta indefinida, sin confirmación falsa. Tras reiniciar el servidor, la reconexión del navegador falló (ERR_CONNECTION_REFUSED); no se considera verificada la nueva opción delayed del harness. Quedan pendientes doble envío demorado, reintento exitoso en esa ejecución, archivos, móvil y matriz completa de consumidores. La evidencia CUA del 14/11 sigue histórica y separada en contratos-action-modal.md.

El harness conserva el contador de llamadas y agrega delayed (tres segundos) para reproducir el pendiente: enviar dos veces mientras está ocupado, comprobar una llamada y ausencia de cierre/franja; reintentar después del fallo. Se retiran las copias temporales al cerrar. No es CI autónomo ni garantía de idempotencia de servidor.

## Seguimiento E7 en la misma fecha

La [auditoría final](auditoria-final-contratos-heredados.md) reanudó el harness y comprobó doble envío demorado, reintento exitoso, valor del selector de archivo conservado y modal móvil. Esto resuelve ese bloqueo anterior; no certifica FileList/bytes ni toda la matriz de pantallas. Se conservan los límites restantes y la compatibilidad publicada.
