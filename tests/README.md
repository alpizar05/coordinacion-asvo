# Suites de prueba de ASVO

## Comandos

```sh
npm run test:unit
npm run test:unit:coverage
npm run test:contracts
npm run test:integration
# Un grupo aislado:
npm run test:integration -- --only=registry-forms
```

Las unitarias y contratos no necesitan `.env`, PostgreSQL, credenciales ni servicios externos. La integración requiere `.env.local` con `ASVO_DEMO=1` y PostgreSQL local; el usuario local debe poder crear bases. No ejecutar contra beta.

`test:unit` usa `node:test` y los archivos de `tests/unit/` más la suite existente de `tests/navigation/`. El ejecutor inicia un proceso con variables de entorno permitidas explícitamente, sin heredar credenciales. El preload rechaza imports de PostgreSQL, módulos de aplicación/DB/Auth, sockets y procesos externos; `fetch`/WebSocket están bloqueados. El resolver de TypeScript solo resuelve archivos: no sustituye validadores ni reglas.

`test:integration` crea una base `asvo_integration_test_<UUID>` por grupo y aplica el esquema numerado. Verifica el nombre antes de cualquier fixture, entrega a los hijos exclusivamente esa URL y configuración demo ficticia y elimina la base en `finally`, incluso si falla una aserción. Los grupos de comandos/migraciones crean además sus propias bases y las limpian. No se preparan fixtures en la base de uso diario. Los hijos bloquean `fetch`; cuando se simula Graph se inyectan respuestas, no se llama a Microsoft.

Los scripts antiguos de integración rechazan ahora una URL que no tenga el nombre reservado para el ejecutor. Para ejecutarlos, usá `--only` con un grupo del inventario. `npm run test:registration` es un alias protegido del grupo `registration`. `test:db:commands` y `test:db:migrations` siguen siendo entradas independientes con creación/limpieza propias.

Cada grupo tiene un límite de dos minutos. El ejecutor espera el cierre del hijo antes de limpiar y trata SIGINT/SIGTERM como cancelación. Como cualquier proceso local, SIGKILL, caída del equipo o del servidor pueden impedir `finally`: en ese caso revisar los nombres temporales registrados en PostgreSQL antes de limpiar exclusivamente bases de pruebas. No hay un borrado general de bases por prefijo.

## Inventario y clasificación

| Prueba existente | Dependencias | Clasificación / destino actual |
| --- | --- | --- |
| `test-form-feedback.mjs` | FormData, fechas y validadores puros | Alias a `tests/unit/feedback.test.mjs` |
| `test-mail-template.mjs` | Plantilla, URL y HTML | Alias a `tests/unit/mail-template.test.mjs` |
| `test-mail-cron.mjs` | Request/Response y servicio flush inyectado | Alias a `tests/unit/mail-cron.test.mjs` |
| `test-navigation-context.mjs`, `tests/navigation/*.test.mjs` | Reloj/almacén falsos; contrato de navegador con doble | Suite aislada conservada; también incluida en `test:unit` |
| `test-public-registration.mjs` | PostgreSQL y servicios de inscripción pública/privada | Integración `public-registration`; preámbulo puro movido a unitarias |
| `test-staff-form-errors.mjs` | PostgreSQL, gestión y grupos, concurrencia | Integración `staff-forms`; preámbulo puro separado |
| `test-registry-form-errors.mjs` | PostgreSQL, CSV, versiones, pólizas, unidades, permisos/asistencia | Integración `registry-forms`; preámbulo puro separado |
| `test-outing-form-errors.mjs` | PostgreSQL, editores e informe; uploader inyectado | Integración `outing-forms`; validaciones puras movidas |
| `test-form-audit.mjs` | PostgreSQL, decisiones y auditoría | Integración `form-audit`; filtros/decisiones puros separados |
| `test-outing-editor.mjs` | PostgreSQL y carga de fotos simulada | Integración `outing-editor`; expectativas actualizadas al contrato vigente de errores por campo |
| `test-registration-workflow.mjs` | PostgreSQL, acciones privadas, cola y Graph simulado | Integración `registration`; no reemplaza reglas de cupos/concurrencia |
| `test-volunteer-search.mjs` | Consultas, filtros y paginación PostgreSQL | Integración `volunteer-search`; construcción pura de URL va a unitarias |
| `test-volunteer-participation.mjs` | Informes, vista/función SQL y conciliación versionada | Integración `volunteer-participation`; cálculo puro de resumen/etiquetas probado aparte |
| `test-coordination-summary.mjs` | PostgreSQL, reloj del servidor, recordatorios y permisos | Integración `summary` |
| `test-db-commands.mjs` | Procesos CLI y PostgreSQL desechable | Integración `db-commands`; guards puros movidos a unitarias |
| `test-schema-migrations.mjs` | Catálogos PostgreSQL, archivos y concurrencia real | Integración `schema-migrations`; lexer puro probado aparte |
| `test-auth-diagnostics.mjs` | Auth.js real, normalización de provider, fetch/logs falsos | Contrato sin DB; no contado como unitario de dominio |
| `test-mail-test-recipients.mjs` | Adaptador outbox con SQL doble y fetch vigilado | Contrato sin DB; no prueba transacciones ni entrega real |
| `test-historical-import-plan.mjs` | Archivo privado del lote original | Comprobación opcional del lote; excluida de comandos automáticos. No se leyó ni copió el lote en esta etapa |
| `tests/navigation/browser.mjs` | CUA, Next.js local y fixtures | E2E separado; no convertido en unitario ni CI autónomo |
| `test-navigation-fixture.mjs` | PostgreSQL demo y servidor local | Helper de preparación/limpieza de E2E, no prueba unitaria |

Los tests de integración siguen comprobando los errores que devuelve el servicio después de consultar el estado real. Solo se retiraron las aserciones independientes que llamaban directamente a validadores puros. No se sustituyen pólizas, permisos, cupos o promociones por dobles del algoritmo que se pretende probar.

## Extracciones mínimas

- `registration-rules.ts`: agrupación inclusiva, estados editables y advertencia con reloj/ventana explícitos. `registration.ts` mantiene el adaptador y su API anterior.
- `participation-rules.ts`: tipos y funciones de resultado/resumen, sin importar DB. `volunteer-participation.ts` reexporta la API anterior y conserva la consulta.
- `volunteer-search-criteria.ts`: términos y URL sin SQL. `volunteer-search.ts` conserva consulta y reexportaciones.

No hubo reorganización general de acciones, cambios de estado ni modificación de consultas. Los UUID de las unitarias son constantes sintéticas; el reloj de advertencias y el día del plan histórico se pasan explícitamente. Navegación conserva su reloj/almacén inyectables. Graph y carga de fotos se sustituyen por servicios externos falsos; no se reemplazan las decisiones de negocio.

## Cobertura y límites

```sh
npm run test:unit:coverage
```

Produce `coverage/unit.lcov`, `coverage/unit-summary.json` y la tabla por módulo. Los archivos de ejecución están ignorados por Git. El informe falla si los módulos medidos no coinciden exactamente con `tests/unit/modules.mjs`: no se ocultan módulos declarados que no fueron importados. La medición inicial revisada se conserva en [docs/cobertura-unitaria-inicial.json](../docs/cobertura-unitaria-inicial.json).

Ver [análisis, exclusiones y propuesta de umbrales](../docs/pruebas-y-cobertura.md). Esta cobertura corresponde exclusivamente a los módulos declarados (29 tras la etapa de validación de entradas), no a la plataforma, React ni a integración. La compilación y TypeScript siguen siendo verificaciones separadas.

La etapa de [validación de entradas](../docs/validacion-de-entradas.md) amplía la suite a 68 unitarias y 29 módulos declarados. `runtime-inputs.test.mjs` cubre archivos como texto, controles repetidos, límites de servicios, JSON de fotos, CSV y respuestas Graph malformadas. Integración añade esos casos a recepción pública, edición privada y alta/edición desde Coordinación; el contrato de correo verifica que un token malformado no dispare `sendMail`.

La [etapa de autorización](../docs/autorizacion.md) amplía la suite a **72 unitarias**, **30 módulos puros**, **13 grupos de integración** y tres comprobaciones de inventario/contrato. `authorization` ejecuta acciones y el handler de fotos reales con dobles de petición/autenticación, sin sustituir las reglas. El inventario clasifica 42 exportaciones en 16 archivos y falla ante omisiones; no sustituye las pruebas de acceso. El loader del grupo usa la transformación TypeScript de Node 25 (experimental); no requiere paquetes ni proveedores adicionales.

La [etapa de transiciones](../docs/transiciones-de-estado.md) amplía el inventario a **80 unitarias**, **31 módulos puros** y **14 grupos de integración**. `workflow-transitions` prueba cupos/FIFO, reactivaciones, cancelación y finalización simultáneas, versiones obsoletas, borrador sin asistencia y rollback de estado/auditoría/cola ante fallos inducidos. El proceso protegido usa el outbox local con destinatarios `.test`, sin despachar ni acceder a proveedores; el runner elimina DB, triggers y datos al terminar.

La etapa de [resultados de correo](../docs/resultados-de-correo.md) amplía la suite a **83 unitarias**, **32 módulos puros** y **16 grupos de integración**. `mail-outcomes` usa SQL real en base local desechable y el adaptador Graph con transporte falso: aceptación con proyección fallida, acuse perdido, incertidumbre, rechazo, dos workers, orden, revisión, protección `.test` y límites. La migración 0003 también se verifica sobre una baseline con datos e intentos históricos. No se mide integración como cobertura unitaria; `mail-attempt-rules.mjs` tiene 100 % en líneas/ramas/funciones en esta ejecución. El CLI se comprueba en modo consulta sin escrituras.
