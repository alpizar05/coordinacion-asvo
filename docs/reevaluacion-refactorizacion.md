# Reevaluación de la refactorización de ASVO

Fecha: 13 de noviembre de 2026. Fuente revisada: `main` local en `23e8bff`, más el historial de las etapas previas. Trabajo exclusivamente de análisis/documentación: no cambió código funcional, dependencias, esquemas, permisos, reglas de Codex ni workflows; no se consultó beta/proveedores ni se publicó.

## Conclusión

La plataforma ya tiene una base compartida suficiente para desarrollar módulos nuevos. No corresponde repetir la separación de migraciones/correo, rehacer la autorización o introducir un framework de repositorios, una máquina de estados genérica, un bus de eventos o una arquitectura de microservicios.

Conviene cerrar las verificaciones pendientes, adoptar los contratos existentes al extender funciones y refactorizar los bordes concretos que todavía muestran acoplamiento o contratos mixtos. El siguiente módulo debe aprovechar lo implementado; no convertirse en otra reorganización transversal.

## Cómo se distingue la evidencia

- **Implementación inspeccionada:** código y consumidores presentes en el checkout; existencia de una prueba no equivale a haberla ejecutado ahora.
- **Verificación anterior registrada:** informes y fixtures de etapas anteriores. Se mantiene su fecha/alcance, sin atribuirles una ejecución nueva.
- **Verificación de esta revisión:** se ejecutaron únicamente `audit-functional-boundaries`, `audit-authorization` y `audit-security-boundaries`. Pasaron: ocho módulos de acciones/diez servicios extraídos sin ciclos nuevos ni consumidores JSX de adaptadores; inventario de 73 exportaciones en 24 archivos; ocho fronteras server-only y ausencia de dependencias cliente indebidas según el auditor. Son comprobaciones estáticas, no pruebas de acceso en ejecución.
- **Pendiente:** CI remoto/Linux/contenedor/LTS, nueva matriz visual completa con CUA, dispositivos/lectores reales e infraestructura efectiva. No se usaron herramientas remotas para establecer su estado.

El registro anterior de CI informa 92 unitarias, 35 módulos puros (100 % líneas, 96,53 % ramas, 99,53 % funciones), cinco contratos, seis pruebas de configuración CI y 18 grupos de integración. Es cobertura de un subconjunto, no del producto completo. No se repitieron estas suites con base, build o navegador durante esta tarea documental.

## Balance de las etapas realizadas

| Problema original                                                            | Implementación existente                                                                                                                               | Archivos/módulos de referencia                                                                                                                  | Evidencia disponible                                                                                                                                   | Límite o trabajo restante                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preparar DB mezclaba estructura, transformaciones, ejemplos y correo         | Comandos explícitos; preparación sin demo, enlaces ni comunicaciones implícitas; marcas históricas conservadas                                         | `scripts/db.mjs`, `db-history.mjs`, `demo-*.mjs`; `lib/database-setup.mjs`, `registration-workflow-migration.mjs`                               | Grupos `db-commands`, `schema-migrations`; revisión del código de preparación y transformación histórica                                               | Compatibilidad de cada destino se vuelve a revisar antes de migrar; no inferir que un seed esté autorizado en remoto                                                                            |
| SQL repetible sin historial numerado ni adopción suficientemente verificable | Fuente `migrations/*.sql`, checksums, registro, bloqueo y transacción por archivo; baseline por catálogo; plan/estado sin escrituras                   | `lib/schema-migrations.mjs`, `schema-inspection.mjs`, `migration-sql.mjs`; 0001–0004                                                            | Vacío, adopción compatible/incompatible, alteración de checksum, fallo/reintento, concurrencia y preservación de datos en `test-schema-migrations.mjs` | No modificar migraciones aplicadas. Restricciones cerradas de estados requieren revisar históricos; no se agregaron automáticamente                                                             |
| Correo asociado al proceso y reenvío ambiguo después de aceptación           | Outbox transaccional, reserva/orden, intentos durables, aceptación separada de proyección, cuarentena y revisión explícita                             | `lib/registration-mail.mjs`, `mail-outbox.mjs`, `mail-attempts.mjs`, `mail-attempt-rules.mjs`; cron/CLI                                         | `mail-outcomes`, `registration`, contratos de `.test` y plantilla; dobles de Graph                                                                     | Aceptación no es entrega ni exactamente una vez. UI operativa de revisión todavía no sustituye al CLI. Retención/operación externa siguen pendientes                                            |
| Validaciones divergentes entre entradas                                      | Reglas puras reutilizadas para fechas/transporte, FormData, CSV, fotos y respuestas externas; diferencias públicas/privadas/staff explícitas           | `registration-validation.ts`, `staff-registration-validation.ts`, `form-input.ts`, `registry-csv.ts`, `photo-metadata.ts`, `graph-response.mjs` | Unitarias de límites y entradas malformadas; integración pública/privada/Coordinación                                                                  | No duplicar validadores en el próximo módulo; faltan homogeneizar algunos resultados de servicios, no reconstruir la validación                                                                 |
| Permisos dispersos o dependientes del layout                                 | Matriz por operación/rol/unidad/recurso y condiciones SQL/capacidades privadas; servidor sigue autorizando                                             | `authorization.ts`, `authorization-sql.ts`, `auth.ts`; `tests/authorization/entrypoints.mjs`                                                    | `authorization`, `security`, inventario estático repetido en esta revisión                                                                             | Grants efectivos de PostgreSQL/Graph no se verifican por esta matriz. Servicios aún importan políticas desde el adaptador de sesión en algunos sitios                                           |
| Transiciones repetidas con riesgo de romper cupos/auditoría                  | Decisiones puras compartidas; verificaciones de estado/versiones y efectos dentro de transacción                                                       | `workflow-transitions.ts`, `registration-workflow.ts`, `outing-state-transition.ts`, `outing-report.ts`                                         | `workflow-transitions`, recepción concurrente, FIFO, versiones, rollback de cola/auditoría y borrador/finalización                                     | Conservar valores históricos desconocidos; no imponer un catálogo cerrado sin análisis de datos                                                                                                 |
| Graph durante bloqueos largos de DB                                          | Autorizar/preparar, cargar fuera de locks y confirmar con revalidación; bitácora y compensación protegida                                              | `photo-upload-workflow.ts`, `photo-mutation.ts`, `outing-photos.ts`, `outing-inheritance.ts`; 0002                                              | `photo-uploads`: retrasos/timeouts, referencias compartidas, fencing, reintentos e idempotencia                                                        | Originales pueden compartirse, pero los derivados binarios aún se copian entre tablas/bloques. Limpieza compensatoria no equivale a retención automática                                        |
| `staff-actions.ts` acumulaba funcionalidades                                 | Ocho módulos `app/actions/*`, diez servicios/consultas extraídos y adaptadores compatibles                                                             | `app/staff-actions.ts`, `app/actions/`, `lib/staff-*.ts`, `create-staff-outing.ts`, `outing-series.ts`                                          | `functional-actions`, comparación de adaptadores/canónicos; auditor de fronteras repetido                                                              | Persisten contratos heredados y ramas JSX de edición no alcanzadas por la presentación actual. No borrar `editEnd`: tiene consumidor explícito                                                  |
| Errores generales, formularios perdidos y confirmaciones engañosas           | `FormResult`, feedback por campo/resumen/foco, apertura de secciones y conservación de archivos; éxito global separado                                 | `lib/form-result.ts`, `app/form-feedback/form-feedback.tsx`, `app/coordinacion/action-modal.tsx`, `status-ribbon.tsx`                           | Auditoría de formularios, unitarias y grupos `*-forms`; evidencia de teclado/DOM/CUA previa                                                            | ActionModal admite `Promise<unknown>` por compatibilidad; informe y acciones antiguas conservan adaptaciones. La UX de los formularios activos no está pendiente de migración completa otra vez |
| Regresar a listas perdía criterios/posición                                  | Contexto compartido acotado, URL para criterios, memoria/almacén mínimo, vecinos/fallback, prioridad a errores y navegación nativa                     | `navigation-context.ts`, `navigation-store.ts`; componentes de Coordinación                                                                     | 20 unitarias aisladas, 26 grupos CUA registrados y regresión enfocada posterior                                                                        | Búsquedas libres en memoria se pierden en recarga por privacidad. CUA no es un runner autónomo de GitHub; no repetir almacenamientos independientes por módulo                                  |
| Configuración insegura o acoplamiento cliente/credenciales                   | Validadores por función, server-only, demo local, enlaces revocables, HMAC y cabeceras                                                                 | `runtime-config.mjs`, `server-config.mjs`, `private-links.ts`, `abuse-limits.ts`, `security-headers.mjs`; 0004                                  | `security`, unitarias, build/HTTP y rechazo real del compilador; fronteras estáticas repetidas                                                         | CSP parcial; logs del alojamiento, permisos efectivos, backup, retención y runtime LTS siguen abiertos. No certificar infraestructura desde el código                                           |
| Pruebas mezcladas y ausencia de pipeline reproducible                        | Unitarias/contratos/integración separados, npm ci limpio, builds aislados, lint/formato acotados y auditoría de secretos/dependencias; workflow manual | `.github/workflows/ci.yml`, `scripts/ci/`, `tests/unit/modules.mjs`, `tests/ci/`                                                                | Registro local en [CI y equivalencia](ci-y-equivalencia.md), guards de efectos, instalación y builds Turbopack/Webpack                                 | Archivo publicado no equivale a primera ejecución CI aprobada. Node CI 25.2.1 no es LTS; contenedor Linux y matriz visual permanecen pendientes                                                 |

Historial principal: `c65e5ba` errores; `5a7e615` navegación; `c4fe995` DB/reglas/permisos/transiciones; `6963f26` fotos; `bbe06c3` correo incierto; `ad2459f` funcionalidades/seguridad; `23e8bff` CI/auditoría. Las diferencias intencionales y los límites de equivalencia están en [el informe anterior](ci-y-equivalencia.md): no se ejecutaron todos los binarios históricos en un ensayo diferencial.

## Hallazgos que cambian la lista de pendientes

1. **Errores/resultados:** `FormResult` y la UX por campo existen. La tarea genérica «Estandarizar resultados y errores» era demasiado amplia: el remanente son contratos heredados y mapeos, no toda la plataforma.
2. **Reintentos de creación:** `NewOutingForm` mantiene `photoOperation` en `useRef`; `withPhotoUploads` almacena fingerprint/resultado y devuelve el resultado confirmado al repetir la misma operación. `functional-actions` y `photo-uploads` contienen pruebas de repetición. La bitácora también se usa cuando files está vacío según la implementación; no es solo deshabilitar el botón. Las pruebas citadas usan imágenes ficticias: el caso explícito sin adjuntos debe comprobarse al ampliar esa matriz. La referencia de operación no promete sobrevivir a desmontaje/recarga. `saveManualSeries` inserta una colección nueva sin el mismo recibo durable: hay que delimitar la cobertura pendiente por comando.
3. **Fotos:** las pruebas ya comparten el identificador del original al crear varios bloques. La tarea de «evitar duplicar archivos» debe concentrarse en derivados/relaciones y acceso, no asumir que cada bloque vuelve a subir el mismo original.
4. **Código legado:** el auditor confirma que ningún JSX importa los adaptadores antiguos. Estos continúan como contratos de compatibilidad/pruebas. En el detalle de salida, el ternario final elige `OutingEditor` cuando `editing`; por eso hay ramas `editing ? <form...>` dentro de paneles que solo se muestran en la otra rama. Son candidatas a limpieza, sin eliminar los paneles de lectura ni `actions={editEnd}`.
5. **README/TODO:** había cifras iniciales (62/25/12) presentadas como actuales, búsqueda pública y retiro de adaptadores repetidos, y texto de etapas pasadas que aún decía que autorización/fotos estaban pendientes. Se consolidan sin alterar los documentos históricos de cada etapa.

## Mejoras técnicas justificadas

Las prioridades siguientes no convierten una mejora en defecto confirmado de producción. Se basan en código local; no hay mediciones de tráfico/latencia o inspección de datos beta en esta revisión.

### R1 — Terminar contratos de resultados en los bordes heredados

- **Evidencia:** `FormResult` es una unión discriminada; `ActionModal` admite acción `Promise<unknown>` y normaliza resultados. `saveOutingReport` devuelve `error` junto a `errors` legados. `manageOuting` consume `string | undefined` y `manageEntry` tiene retornos silenciosos ante UUID inválido.
- **Prioridad/beneficio:** media-alta al modificar esas acciones; evita mapeos ambiguos, éxitos inferidos y duplicación en módulos nuevos. No se diagnosticó una confirmación falsa actual.
- **Riesgo/dependencia:** compatibilidad de redirecciones, foco, navegación y llamadores anteriores; inventariar consumidores antes de estrechar tipos.
- **Etapa mínima/cuándo:** una familia de comandos; primero contrato de servicio explícito, después adaptador que mantenga el contrato anterior. Hacer al tocar el módulo, no reescribir todos ahora.
- **Equivalencia:** mismos resultados esperados, errores independientes, conflictos generales, redirects/fragmentos, efectos tras commit, formulario abierto y ausencia de correo/auditoría duplicados. Probar adaptador y caso real, no solo igualdad entre dos delegaciones.

### R2 — Retirar legado probado y reducir ramas de presentación inaccesibles

- **Evidencia:** `audit-functional-boundaries` enumera adaptadores sin importadores JSX. El detalle de salida conserva formularios condicionales dentro de los paneles de lectura; `editEnd` sí se pasa al editor.
- **Prioridad/beneficio:** media; reduce caminos aparentes que confunden mantenimiento y futuras correcciones.
- **Riesgo/dependencia:** contrato publicado/importadores fuera del JSX, pruebas y consumidores indirectos. La ausencia de importadores en UI no autoriza retirar una API compatible.
- **Etapa mínima/cuándo:** ahora puede prepararse un inventario de consumidores; retirar primero una rama JSX demostrablemente inaccesible. Adaptadores solo después de aprobar el fin de compatibilidad.
- **Equivalencia:** auditor estático antes/después, inventario de exportaciones actualizado, acciones e informe del 70, editor/lectura/acciones finales, desktop/móvil y contexto. No usar cantidad de líneas como criterio de éxito.

### R3 — Separar políticas puras del adaptador de sesión dentro de servicios

- **Evidencia:** `staff-registration-cases.ts`, `staff-report-cases.ts` y `outing-series.ts` importan `allows`/`canOperate` desde `auth.ts`; este inicializa Auth.js y referencia DB. `create-staff-outing.ts` además importa `sql` aunque recibe un parámetro homónimo.
- **Prioridad/beneficio:** media, esfuerzo acotado; dependencias más claras y pruebas de servicios menos vinculadas a loaders de sesión.
- **Riesgo/dependencia:** conservar `requireStaff`/sesión en la frontera y las relecturas de grants bajo transacción. No convertir la sesión recibida en autorización permanente.
- **Etapa mínima/cuándo:** al editar uno de esos servicios, importar decisiones puras de `authorization.ts`, retirar únicamente imports sin consumidores y mantener el contrato. No introducir un contenedor de inyección general.
- **Equivalencia:** matriz de permisos, acceso directo, unidades distintas, cambios concurrentes de grants, rechazo antes de bytes y rollback. Un cambio de import no justifica cambiar permisos.

### R4 — Extraer consultas por necesidad y acotar listados extensos

- **Evidencia:** Solicitudes e Informes tienen SELECT/joins/filtros/orden en la página y sin LIMIT; Voluntariado ya tiene consulta paginada con límite 25 y desempate por id. Layout y páginas llaman `staff()` sin memoización explícita por petición en esa función.
- **Prioridad/beneficio:** media antes de aumentar volumen; alta solo si mediciones muestran un problema. Reduce transferencia/acoplamiento y facilita repetir permisos/filtros en módulos nuevos.
- **Riesgo/dependencia:** conteos, agrupaciones, filtros inclusivos, orden estable, última página válida y restauración de contexto. Cachear permisos entre peticiones sería una regresión.
- **Etapa mínima/cuándo:** extraer primero una consulta tipada conservando exactamente resultados; medir. Paginar esa lista en una segunda etapa. Evaluar reutilización de sesión solo dentro de la petición, sin retirar autorización transaccional.
- **Equivalencia:** mismos IDs/orden/alcance, rangos que intersectan, vacíos, páginas agotadas y regreso desde detalle; mediciones locales con datos sintéticos. No añadir paginación de forma incidental al crear otro módulo.

### R5 — Completar idempotencia de los comandos no cubiertos

- **Evidencia:** creación de convocatorias y fotos ya dispone de operación/fingerprint/resultado durable. Serie manual usa INSERT nuevo; separación de grupos valida miembros y traslado, pero no devuelve por contrato un resultado guardado de una operación repetida.
- **Prioridad/beneficio:** media-alta antes de exponer más comandos de creación; recuperación clara cuando se pierde la respuesta, sin colecciones ni notificaciones duplicadas.
- **Riesgo/dependencia:** distinguir repetición del mismo intento de una segunda creación intencional; definir identidad, alcance, vigencia y conflicto del payload. No reutilizar a ciegas una bitácora de fotos para todas las operaciones.
- **Etapa mínima/cuándo:** inventariar por comando y cubrir primero serie manual; añadir el caso explícito de creación sin adjuntos a la matriz. Para grupos, comprobar si las invariantes ya impiden duplicación y qué respuesta recibe el reintento. Analizar recarga/desmontaje por separado.
- **Equivalencia:** respuesta perdida tras commit, dos ejecuciones simultáneas, mismo identificador/datos distintos, intento nuevo intencional y efectos únicos en DB/auditoría/cola. No prometer exactamente una vez en Graph.

### R6 — Normalizar fotos y caché solo con medición y alcance definidos

- **Evidencia:** `outing-inheritance.ts` copia `thumbnail`/`display_image` mediante INSERT SELECT entre fotos generales y bloques. Los originales ya pueden compartir referencia; el handler protege acceso por recurso.
- **Prioridad/beneficio:** media, sujeta a volumen/transferencia; potencial reducción de almacenamiento y lecturas repetidas.
- **Riesgo/dependencia:** permisos y asociación por salida, portada/orden, crédito/descripción propios, herencia y compensación que no borre un original compartido. Requiere diseño de datos y migración compatible.
- **Etapa mínima/cuándo:** medir primero; probar normalización de un derivado manteniendo relaciones/metadatos por contexto. Caché pública/privada es otra decisión, no un paso obligatorio del módulo Lugares.
- **Equivalencia:** fotos públicas/restringidas, invitación/recibo, cambio de visibilidad, reordenamiento, bloque personalizado/heredado, referencias múltiples y rollback. Sin un servicio genérico de archivos ni cambio de proveedor por anticipado.

### R7 — Ampliar auditoría estructurada cuando un historial la necesite

- **Evidencia:** `audit()` registra actor/acción/target/reason y los historiales interpretan evidencia existente; varios cambios guardan detalles en texto. Nuevos historiales de convocatoria/ficha siguen pendientes como funcionalidades.
- **Prioridad/beneficio:** media al implementar esos historiales; evitar que cada pantalla analice cadenas distintas o copie datos sensibles innecesarios.
- **Riesgo/dependencia:** compatibilidad del historial, privacidad/retención y significado de valores previos. No transformar texto histórico en hechos estructurados supuestos.
- **Etapa mínima/cuándo:** catálogo mínimo de eventos para un caso de uso y payload nuevo tipado/minimizado mediante migración si hace falta; conservar lectura del legado. No introducir event sourcing ni reconstruir el estado desde auditoría.
- **Equivalencia:** atomicidad con el comando, actor/motivo correctos, visibilidad por rol/unidad y originales históricos intactos. Definir antes qué datos personales debe conservar el evento.

### R8 — No crear otra abstracción Graph sin un consumidor concreto

- **Evidencia:** correo y fotos comparten validación de configuración, pero sus protocolos de aceptación, timeout, limpieza y reintento son distintos.
- **Prioridad/beneficio:** baja/condicional; solo compartir autenticación/transporte si un nuevo módulo demuestra duplicación real.
- **Riesgo/dependencia:** un wrapper de retry genérico podría reenviar correo incierto o eliminar archivos compartidos.
- **Etapa mínima/cuándo:** ante un tercer consumidor, extraer un helper pequeño de la parte común medida, manteniendo decisiones de correo/fotos en sus módulos. No cambiar a un SDK ni cachear tokens globalmente por esta revisión.
- **Equivalencia:** dobles de rechazo/timeout/aceptación y contenido malformado; cero llamadas reales. No ampliar permisos Graph para simplificar el diseño.

## Lo que no es refactorización

| Clase                | Pendientes que pertenecen aquí                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Funcionalidades      | Historiales nuevos, Lugares, funcionarios, reportes, filtros públicos, PWA/push y UI de gestión de correo/revocación                                          |
| Producto/institución | Propietario del catálogo de lugares, alcance de contactos, datos públicos/privados, reglas de herencia, cierre de salidas, métricas de días/horas y retención |
| Pruebas/operación    | Primera CI remota, runtime LTS, contenedor Linux, gates de cobertura, CUA/lectores/dispositivos, ampliación de lint/formato, mantenimiento de pines           |
| Infraestructura      | Permisos efectivos, separación de roles de migración/runtime, CDN/logs/proxy, backup/restauración y presupuestos de cómputo/transferencia                     |

Una tarea de producto puede necesitar una refactorización pequeña (por ejemplo R7), pero debe declarar ambos alcances. No cerrar un pendiente institucional porque se haya preparado código o una guía.

## Lineamientos y solicitudes futuras

Ver [lineamientos de implementación](lineamientos-implementacion.md) y [plantillas breve/completa con ejemplo Lugares](plantillas-solicitudes-codigo.md). Son documentación para esta aplicación, no reglas nuevas de Codex. El orden de TODO se actualiza sin eliminar el historial técnico de las etapas.

No se propone un refactor general inmediato. Los tres próximos pasos son:

1. **Cerrar evidencia antes de extender superficie:** autorizar/validar runtime LTS y primera CI remota; repetir matriz CUA priorizada. No iniciar esto desde una tarea de documentación.
2. **Atender un borde concreto:** elegir R1 o R3 sobre una familia que vaya a modificarse; usar resultados esperados y pruebas actuales antes de retirar compatibilidad. Inventariar R5 en paralelo, sin asumir que creación de convocatorias sigue desprotegida.
3. **Implementar un módulo con alcance aprobado:** usar el machote completo para Lugares o funcionarios; definir permisos, snapshot/herencia y datos públicos antes de escribir el esquema. Extraer solo las piezas necesarias.

Decisiones del usuario: prioridad del próximo módulo frente a deuda técnica; quién mantiene/consulta los catálogos y contactos; cambios de herencia e historial; política de conservación; cuándo autorizar CI/infraestructura; y cuándo termina la compatibilidad de adaptadores. Ninguna requiere cambiar permisos reales en esta revisión.
