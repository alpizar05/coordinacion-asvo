# Inventario y plan de contratos heredados de resultados

Fecha: 13 de noviembre de 2026. Base revisada: commit `a0061d7a22bdd702b4ccf4a120759a506b7d4351`, árbol funcional sin cambios. La auditoría inicial solo analizó y documentó. Posteriormente se implementó E1 localmente: ver [contratos del informe y evidencia](contratos-informe-70.md). Posteriormente también se implementó E2: ver [contratos de enlaces del 70](contratos-enlaces-70.md). C02 (ActionModal y wrappers) también se completó localmente: ver [evidencia y límites](contratos-action-modal.md). E3 (C03/C04) se implementó localmente: ver [contratos de fotografías](contratos-fotografias.md), con matriz visual pendiente. Los restantes casos conservan su estado inicial.

## Alcance y evidencia

Se contrastaron AGENTS, README, TODO, reevaluación R1, lineamientos, organización por funcionalidad, errores compartidos, contexto de navegación, autorización, transiciones, fotografías y pruebas. Se siguieron acciones canónicas, adaptadores, servicios, componentes y referencias de pruebas mediante búsquedas locales. La documentación instalada de Next sobre redirect confirma que es control de navegación, no un valor de éxito.

Comprobaciones ejecutadas aquí, sin DB/red/proveedores:

- `node scripts/audit-functional-boundaries.mjs`: ocho módulos de acciones, diez servicios, sin ciclos nuevos ni imports JSX de los adaptadores enumerados.
- `node scripts/audit-authorization.mjs`: inventario de 73 acciones/handlers en 24 archivos, política/capacidad declarada para cada una. No prueba permisos efectivos ni todos los caminos dinámicos.
- Revisión de referencias, ramas JSX y contratos; comprobación de enlaces locales y diff al terminar.

Las pruebas SQL y CUA citadas abajo **existen en el repositorio**; no se ejecutaron en esta auditoría documental. La [validación anterior](validacion-node26-postgres18.md) registra 92 unitarias, siete checks CI y 18 grupos SQL con Node 26.13.1/PostgreSQL 18.7. No constituye evidencia de una migración que todavía no se hizo. Los dos auditores estáticos se ejecutaron con el Node global disponible, sin cambiar el runtime del proyecto; no se presenta esto como una nueva certificación de runtime.

No se leyeron dotenv privados ni se accedió a beta, proveedores, permisos reales o servicios externos. Sin correo, cargas, fixtures, workflows, publicación o cambios funcionales.

## Base ya implementada que debe conservarse

- [FormResult](../lib/form-result.ts): éxito explícito `saved: true`, destino opcional y payload genérico; fallo con `error` y/o `fieldErrors`, cada campo admite varios mensajes. El fallo permite propiedades opcionales: `{}` es válido como estado inicial, pero no debe interpretarse como una operación exitosa ni convertirse en un nuevo resultado ambiguo de comandos.
- [Feedback](../app/form-feedback/form-feedback.tsx): resumen, mensajes accesibles, identificadores por instancia, primer intento, revalidación localizada, apertura de secciones y foco. `showErrors` emite `asvo:form-errors`, con prioridad sobre restauración de posición. No reiniciar ni desmontar formularios al fallar.
- [ActionModal](../app/coordinacion/action-modal.tsx): requiere `result?.saved` truthy para cerrar/confirmar; undefined falla con mensaje genérico. El contrato exige el literal true, pero el cast no impone ese valor en ejecución. Captura excepciones y conserva formulario, dirty y modal. El límite actual es su tipo amplio y cast, no que cualquier respuesta ya produzca éxito.
- [Confirmaciones](../app/status-ribbon.tsx): superficie compartida temporal, cinco segundos; para éxito, no para errores persistentes. Una confirmación de cola no significa entrega del correo.
- [Navegación](contexto-de-navegacion.md): `navigationSaved`, destinos internos mediante `preserveCurrentNavigation`, filtros/pestaña/registro y restauración. Conservar los adapters de navegación; no copiar parámetros o tokens privados a almacenamiento nuevo.

No se propone otra unión de resultados global ni una capa genérica de operaciones. Primero reutilizar FormResult; payloads de dominio y excepciones tipadas pueden seguir siendo distintos cuando su función lo requiera.

## Índice de casos

| ID | Familia/borde | Situación actual | Prioridad / riesgo |
| --- | --- | --- | --- |
| C01 | Informe del 70 | E1 implementada y verificada en contratos/SQL; nueva matriz visual pendiente | P1 / medio |
| C02 | ActionModal y wrappers | Promise unknown y cast, con guard de éxito existente | P2 / medio por alcance transversal |
| C03 | PhotoDialog y preparación/persistencia | string/void/FormResult mezclados; void cierra | P1 / medio-alto |
| C04 | Errores de persistencia de fotos | Mensajes filtrados por prefijo, primer error de carga proyectado | P2 / medio-alto |
| C05 | Generar enlace del 70 | E2 implementada/verificada localmente; comprobación visual pendiente | P2 / medio |
| C06 | Revocar enlaces del 70 | E2 implementada/verificada localmente; confirmación explícita, visual pendiente | P1 / medio |
| C07 | Destacada de portada | Servicio string/undefined y acción con redirect | P2 / medio |
| C08 | Decisiones de inscripción/70 | Helpers string/undefined bajo acción estructurada activa | P2 / alto por cupos/cola |
| C09 | Gestión antigua de salida/inscripción/serie/foto | Compatibilidad o JSX inalcanzable; no flujo editor actual | P3 / medio-alto si se retira sin comprobar |
| C10 | Crear serie manual | Servicio ID/null; acción FormResult activa | P3 / bajo; tipado opcional, no defecto demostrado |

Prioridad indica orden técnico recomendado, no un incidente de producción confirmado. C06 registró inicialmente un retorno void ante UUID inválido que el consumidor podía tratar como éxito; E2 lo corrigió y lo comprobó con la acción real. No se afirma que la UI normal genere ese UUID.

## C01 — Informe del 70: E1 implementada localmente

**Estado posterior:** servicio, acción, adaptador y consumidores de pruebas usan el contrato explícito; sin espejo errors legado. Ver [evidencia y límites de E1](contratos-informe-70.md). Las pruebas visuales completas siguen pendientes. Los párrafos siguientes conservan el hallazgo inicial para contrastar el cambio.

**Acción y consumidores.** [submitReport](../app/actions/reports.ts) → [saveOutingReport](../lib/outing-report.ts). Consumidor UI activo: [ReportForm](../app/resumen-salida/[token]/informe/report-form.tsx), montado desde su page. El [punto de entrada antiguo](../app/resumen-salida/[token]/informe/actions.ts) delega, sin consumidor JSX; permanece en pruebas.

**Contrato y comportamiento.** El servicio infiere éxito `{id,status}`, fallo de validación `{errors}` y fallo general `{error,errors:{form|participants|email}}`. La acción prioriza `error`, adapta `errors` a `fieldErrors` y trata el resto como éxito sin discriminarlo explícitamente por id/status. Hoy las ramas del servicio están definidas; no se constató un falso éxito real. El formulario ya recibe FormResult, conserva estado y abre la sección del primer error; al éxito hace replace/refresh a la ruta del informe con borrador/enviado. No necesita migrar toda su UX otra vez.

**Permisos y efectos.** Acceso mediante token válido, presupuesto contra abuso y condición de enlace/70 vigente; no sustituirlo por sesión de Coordinación. Dentro de sql.begin se bloquea salida, enlace e informe existente; se valida versión y roster. Guardar borrador no exige completitud final ni acredita asistencia. Finalizar bloquea edición y hace que la vista volunteer_attendance_evidence derive la evidencia de participación del informe finalizado; informe y auditoría se guardan atómicamente. No hay que agregar una escritura nueva de asistencia para migrar el contrato. Esta operación no envía correo por sí misma; altera el estado que consulta el seguimiento de informes. No agregar avisos nuevos.

**Contrato objetivo.** FormResult con payload de éxito id/status, o resultado de dominio explícito con un solo adaptador tipado si es necesario mantener independencia. Eliminar el espejo errors legado solo cuando todos sus consumidores estén migrados. Conflictos de roster, versión, enlace y email no editable siguen generales; no convertirlos en campos artificiales. Conservar todos los errores independientes del validador, defaults de modo y diferencia borrador/finalizado. El destino sigue resolviéndose en la acción, no en el servicio SQL.

**Pruebas disponibles/faltantes.** `scripts/test-outing-form-errors.mjs` consume errors; `test-registration-workflow.mjs` consume id/errors; `test-workflow-transitions.mjs` consume status/error y verifica carreras/rollback de auditoría; `test-functional-actions.mjs` ejercita acción, adaptador, borrador, finalización y bloqueo. Actualizarlas con expectativas de negocio independientes, no solo igualdad entre dos delegaciones. Agregar comprobación de rechazo de respuestas inesperadas en la frontera, error de persistencia, errores múltiples generales/campo y ausencia de invalidación/confirmación en fallo. CUA pendiente para secciones, foco, conservación y móvil después del cambio.

**Etapa mínima.** Servicio → acción → adaptador y pruebas directas en el mismo cambio; conservar interfaz pública y comportamiento de ReportForm. Riesgo medio: un mapeo erróneo puede declarar finalizado un borrador o perder un conflicto. Criterio de cierre: fallos inequívocos, éxito confirmado, borrador sin asistencia y finalización inmutable bajo concurrencia.

## C02 — ActionModal: cerrar el tipo, no rehacer el componente

**Estado posterior (14/11):** implementado y verificado localmente: Promise<FormResult>, frontera runtime compartida, wrappers compatibles y éxito literal. Pruebas de tipos, unitarias, integración y CUA acotada; matriz visual completa y navegación exitosa autorizada pendientes. [Evidencia](contratos-action-modal.md). Los párrafos siguientes conservan el hallazgo inicial.

**Consumidores activos.** ActionModal lo usan ProfileEditor (editProfile), VolunteerUnits (updateVolunteerUnits), RegistryModal para póliza (verifyPolicy) y conciliación (reconcileAttendance), ReportReminder (sendReportReminder), y SplitGroupForm (splitOutingGroup). [RegistryForm](../app/coordinacion/registry-form.tsx) inline ya exige Promise FormResult y no debe confundirse con el wrapper RegistryModal. El import de ActionModal en el detalle de salida no constituye un uso JSX activo.

**Contrato.** `action: (FormData) => Promise<unknown>` se castea a FormResult/undefined. El chequeo runtime rechaza undefined y falta de saved; usa truthiness, no una comprobación estricta saved === true ni validación de estructura. Una respuesta mal formada podría atravesar el cast y producir confirmación o llegar a feedback. No se localizó un productor activo que retorne esa forma mal formada. No hay un normalizador validado de resultados ni evidencia de consumidores activos que necesiten string/void. Algunos productores aún tienen tipos inferidos; comprobarlos al estrechar, sin casts que oculten incompatibilidades.

**Permisos/efectos.** Son los de cada acción: Administración corrige ficha/póliza; Coordinación opera por unidad en unidades/incidentes/conciliación/recordatorios/separación. Modal no autoriza. Las transacciones y cola de cada comando permanecen donde están; no centralizarlas en el componente.

**Conservación/objetivo.** Mantener apertura controlada/local, inFlight, dirty, errores, validate/revealField, atributos accesibles, navegación y ribbon. Estrechar a Promise FormResult cuando cada productor cumpla; payloads adicionales siguen permitidos por contrato. No hace falta esperar a eliminar todos los servicios legados internos para esto. No mapear toda excepción a éxito ni obligar a resultados de consultas a este contrato.

**Pruebas/etapa.** Feedback unitario en tests/unit/feedback.test.mjs; registry-forms, staff-forms, functional-actions y summary ejercitan productores; navegador existente de navegación incluye casos de modal/foco, no todos estos consumidores. Falta una matriz del componente con saved, undefined/forma inválida en frontera, fallos generales/campo y destino, más los seis usos funcionales. Cambio transversal pequeño después de tipar los productores que lo necesiten; riesgo medio. No quitar compatibilidad basada únicamente en que TypeScript compila.

## C03 — PhotoDialog: distinguir preparar de persistir

**Estado posterior (14/11):** migración local de contratos explícitos, errores tipados y consumidores conjuntos. [Evidencia y límites](contratos-fotografias.md). Los párrafos siguientes conservan el hallazgo inicial; la matriz CUA sigue pendiente.

**Consumidores activos.** [PhotoDialog](../app/coordinacion/photo-dialog.tsx) recibe callbacks de NewOutingForm, OutingEditor y [AttachPhotos](../app/coordinacion/salidas/[id]/attach-photos.tsx). Los dos primeros solo preparan estado en memoria; AttachPhotos llama attachOutingPhoto para persistir.

**Contrato.** `void | string | FormResult | Promise<...>`. String se presenta como error; objeto sin saved como fallo; void cierra como éxito. NewOutingForm y OutingEditor devuelven void al preparar fotos/metadatos y string al superar el límite. AttachPhotos devuelve FormResult en fallo pero void tras persistir y actualizar ribbon. No puede deducirse del retorno si la foto está preparada o guardada en servidor. Es comportamiento actual deliberado en callbacks locales, no prueba de pérdida de fotos.

**Permisos/efectos.** Preparar no autoriza ni escribe. Persistir usa staff/unidad, PhotoUpload workflow, autorización previa a bytes/Graph, revalidación y confirmación SQL corta; compensación/operación idempotente. Conservar los límites, portada, seis fotos, créditos y herencia; no ejecutar Graph al preparar.

**Conservación/objetivo.** Error mantiene modal, archivo y metadatos; preparación correcta incorpora foto al formulario sin anunciar persistencia. Dar resultado explícito a callbacks locales, separado semánticamente del guardado persistente. Reutilizar errores de FormResult; no forzar una marca saved de servidor falsa para una foto que solo vive en memoria. AttachPhotos debe confirmar explícitamente la persistencia. Eliminar string/void solo tras migrar los tres productores.

**Pruebas/etapa.** photo-uploads, outing-editor, outing-forms, functional-actions y unitarias de metadatos cubren servidor; no prueban por sí solos cierre/retención de PhotoDialog. Falta CUA: preparar/editar/agregar desde galería, fallo con archivo retenido, límite, persistencia y reintento sin duplicados. Una etapa para el contrato del diálogo y sus tres productores; riesgo medio-alto por mezclar preparación y persistencia.

## C04 — Frontera de errores de fotografías

**Estado posterior (14/11):** migración local de contratos explícitos, errores tipados y consumidores conjuntos. [Evidencia y límites](contratos-fotografias.md). Los párrafos siguientes conservan el hallazgo inicial; la matriz CUA sigue pendiente.

**Acción/consumidores.** [mutatePhoto/attachOutingPhoto](../app/photo-actions.ts) → AttachPhotos → PhotoDialog; managePhoto es otra envoltura con redirect. OutingEditor usa saveOutingEdit, un camino diferente.

**Contrato.** FormResult externo existente, pero el catch decide qué error.message mostrar con una expresión regular de prefijos en español. No interpreta ese texto como éxito: filtra el mensaje expuesto. PhotoUploadError se reduce a la primera entrada de fieldErrors bajo photo; otros objetos con fieldErrors se castean. Es remanente de tipado/proyección, no motivo para rehacer el workflow de cargas.

**Permisos/efectos.** Los de C03; preservar fases, control de versión, bitácora, compensación y referencias compartidas. saveOutingEdit y createOuting ya usan excepciones tipadas; mantenerlas cuando garantizan rollback.

**Conservación/objetivo.** Clasificar fallos públicos por tipo/código y mapear todos los campos pertinentes con sus identificadores. Errores generales de acceso, proveedor o conflicto no deben transformarse automáticamente en un campo; revisar qué representa cada PhotoUploadError antes de cambiar su proyección. Mantener mensaje seguro y archivos para reintento. No exponer mensajes arbitrarios de DB/Graph ni tokens.

**Pruebas/etapa.** photo-uploads y outing-forms prueban fallos externos/conflictos; ampliar con varios errores independientes y mensajes que cambien de redacción sin cambiar su categoría. CUA para asociación de cada error. Etapa después/junto a C03 si mantiene alcance acotado; riesgo medio-alto. Ninguna carga real necesaria.

## C05 — Generar enlace privado del 70

**Estado posterior:** E2 implementada localmente. Servicio y acción retornan FormResult explícito, con link obligatorio en el éxito de generación; los conflictos conservan su categoría general. [Evidencia y límites](contratos-enlaces-70.md). Los párrafos siguientes registran el hallazgo inicial.

**Acción/consumidor.** generateBrief en [communications](../app/actions/communications.ts) → generateStaffBrief en [staff-communications](../lib/staff-communications.ts); [PrivateLinkForm](../app/coordinacion/private-link-form.tsx) dentro de ShareBrief consume `{saved,link}`/errores. Adaptador resumen/actions.ts permanece para pruebas, sin JSX.

**Contrato.** Servicio devuelve string de fallo o undefined al terminar; acción lo interpreta por truthiness y devuelve FormResult con link opcional por intersección. La UI exige saved y link. Contrato útil ya estructurado hacia cliente, pero éxito interno implícito y payload no requerido por el tipo.

**Permisos/efectos.** briefs.generate por unidad, salida permitida, inscripción confirmada y assigned70. Bloqueo de salida, revocación de enlaces anteriores de esa persona, inserción del nuevo digest y auditoría en una transacción. No manda correo. Conservar privacidad y duración; link en payload legítimo, nunca en almacenamiento persistente nuevo.

**Objetivo/conservación.** Resultado explícito y payload obligatorio en éxito de la acción; error de lead junto al selector cuando corresponda, conflictos generales fuera. Mantener PrivateLinkForm, selección, error y enlace solo en éxito; no revocar dos veces por un error de presentación.

**Pruebas/etapa.** authorization y functional-actions verifican acceso/generación/revocación; faltan aserciones tipadas de payload, fallos generales y formulario sin enlace falso. Etapa propia de generación/enlaces, riesgo medio; no mezclar cambios de vigencia o política.

## C06 — Revocar enlaces del 70

**Estado posterior:** E2 implementada localmente. UUID inválido, permisos y fallos devuelven error general; cliente solo confirma/oculta enlace tras saved === true. Se conserva el no-op auditado. [Evidencia y límites](contratos-enlaces-70.md). Los párrafos siguientes registran el hallazgo inicial.

**Acción/consumidor.** revokeBrief → revokeStaffBrief; [ShareBrief](../app/coordinacion/salidas/[id]/resumen/share-brief.tsx) espera resolución de Promise y anuncia revocación. Adaptador resumen/actions.ts y pruebas son consumidores de compatibilidad.

**Contrato.** Ambos caminos correctos terminan void; UUID inválido retorna silenciosamente antes de autenticar/escribir. El cliente no distingue ese retorno de una revocación confirmada. Excepciones sí muestran error. Con UUID válido y cero enlaces también se audita una revocación: determinar/conservar esa semántica actual, sin inventar que ausencia de cambios es fallo.

**Permisos/efectos.** briefs.revoke por unidad; bloqueo de salida, update revoked_at y auditoría atómicos. Sin correo. No cambiar alcance (todos los enlaces de esa salida), tokens ni permisos.

**Objetivo/conservación.** Resultado explícito para éxito/error general. Acción sin campos: no asociar UUID/permisos a un control artificial. ShareBrief conserva enlace visible y estado ante error, revoking/pending y ribbon solo tras confirmación. No obligar a modal ni añadir un motivo nuevo.

**Pruebas/etapa.** authorization y functional-actions prueban revocación real/denegada; falta inválido/no-op/fallo SQL con ausencia de confirmación en cliente. Puede hacerse junto a C05; riesgo medio, prioridad P1 por éxito inferido de void. CUA pendiente para no ocultar el enlace tras fallo.

## C07 — Convocatoria destacada

**Acción/consumidores.** setHomepageFeature → saveHomepageFeature en [outing-series](../lib/outing-series.ts). [HomepageFeatureControl](../app/coordinacion/homepage-feature-control.tsx) activo en detalle de salida y serie automática; staff-actions conserva adaptador.

**Contrato.** String de error/undefined de éxito; UUID/kind inválidos retornan silenciosamente. La acción redirige con destacadaError o confirmacion y fragmento #destacada. No analiza la redacción para el resultado, solo truthiness. Retirar selección inexistente puede no escribir/auditar y aun así volver a selección automática.

**Permisos/efectos.** series.feature sobre unidades, bloques for share, elegibilidad pública/abierta/plazo y auditoría. Sin correo ni cupos. No alterar prioridad manual ni fallback automático de portada.

**Objetivo/conservación.** Servicio con resultado explícito; adaptador de redirect compatible mientras la UI sea form action. No imponer modal ni errores por campo a dos botones sin entradas. Conservar éxito idempotente y query/fragmento, evaluar contexto nav sin cambiar silenciosamente navegación en esta etapa.

**Pruebas/etapa.** No se localizaron referencias explícitas a homepage/feature/destacada en scripts/test-*.mjs; la suite functional-actions actual no demuestra este control de portada. Esto no descarta efectos indirectos, pero falta una prueba identificable de la operación. Agregar casos explícitos de destacar, retirar, no-op, plazo, permiso y error sin confirmación. Riesgo medio; familia independiente después de enlaces.

## C08 — Helpers de decisiones de inscripción activos

**Servicio/consumidores.** assignRegistration70 y changeRegistrationStatus en [registration-workflow](../lib/registration-workflow.ts) devuelven string o undefined. Los consume manageStaffEntry, que ya devuelve FormResult y es usado por manageRegistration → ManageRegistrationForm/RegistrationActions (menú desktop y panel inferior móvil). También manageLegacyEntry y pruebas directas.

**Contrato.** La UI ya es estructurada; el remanente es el éxito implícito del helper. recoverRegistration/promoteWaitlist son comandos internos sin resultado de formulario; no necesitan FormResult por asociación. Mensajes de transición no deben convertirse en códigos interpretados por idioma.

**Permisos/efectos.** ManageStaffEntry valida recurso, unidad, versión y schedule bajo bloqueo de salida. Helpers suponen ese bloqueo; no mover decisiones fuera de transacción. Cambios, auditoría y creación de correo atómicos; dispatch después del commit. Conservar FIFO, ocupación, promoción, recuperación cancelada, motivos, póliza y revocación de enlaces.

**Objetivo/conservación.** Resultado de decisión explícito en helpers y mapeo único a FormResult en servicio. Mantener fieldErrors existentes de motivo/aprobación/identificación; conflictos generales. Mantener formulario/panel abiertos, acción seleccionada y navegación. No refactorizar estados ni notificaciones en este cambio.

**Pruebas/etapa.** registration, workflow-transitions, staff-forms y functional-actions contienen expectativas string/undefined y verifican concurrencia/rollback. Migrar todas las expectativas y consumidores juntos sin reemplazar reglas por dobles. Faltan las aserciones de contrato nuevo y matriz visual afectada. Riesgo alto; etapa separada después del piloto del informe.

## C09 — Compatibilidad y ramas de edición antiguas

**Casos y consumidores reales.**

| Camino | Contrato | Uso encontrado / decisión |
| --- | --- | --- |
| manageOuting → manageOutingRecord | string/undefined; códigos completada, eliminada, unidad-incompatible mezclados con errores; redirect con query/fragmento | Referencias JSX en page de salida, pero los formularios se evalúan en information/tools cuando editing; el return final muestra esos paneles solo cuando no editing. El editor actual usa saveOutingEdit; editEnd sí se pasa al editor y usa OutingDecisionForm, no debe borrarse. Hay pruebas directas functional-actions y adaptador staff-actions. |
| manageEntry → manageLegacyEntry | void si UUID/ref inválido; objeto back para éxito/error; acción redirige a back o /coordinacion | Sin consumidor JSX localizado; conserva adaptador staff-actions. El flujo actual es manageRegistration. Tests/inventario pueden exigir exportación; no retirar automáticamente. |
| updateAutomaticCollection | FormResult de fallo o redirect de éxito | Sin consumidor JSX; CollectionEditor usa saveAutomaticCollection. Adaptador staff-actions; verificar importadores y contrato publicado antes de retirar. |
| managePhoto | Resultado FormResult convertido a mensaje general y redirect, perdiendo campo específico | Referencia JSX dentro de rama editing inalcanzable del panel information; AttachPhotos usa attachOutingPhoto. No equivale al flujo actual del diálogo. |
| privateAction | FormResult interno convertido a redirect actualizada/error booleano | Compatibilidad y test-registration-workflow; UI privada usa submitPrivateRegistration. Conservar mientras existan consumidores autorizados. |

**Permisos/efectos.** manageOutingRecord bloquea salida y requiere unidad; gestiona fechas, cupo, solicitudes compartidas, cancelaciones y cola/auditoría. manageLegacyEntry conserva permisos y cambio bajo bloqueo, filtros históricos y dispatch. Las envolturas no deben confirmar ni enviar después de una validación fallida. Revisar efectos existentes por camino, no suponer que un nombre legacy implica que nunca pueda invocarse directamente.

**Conservación/objetivo.** Donde hay redirect no se conserva el formulario montado: no atribuirle las garantías del editor nuevo. La migración mínima futura es clasificar compatibilidad, decidir conservar/deprecar, tipar el servicio si sigue necesario y mantener el redirect externo. No convertir redirects en objetos a ciegas, ni atraparlos como fallos de guardado. No borrar exports solo por falta de JSX. Limpieza de ramas muertas corresponde a R2, coordinada pero separada de R1.

**Pruebas/etapa.** functional-actions compara redirects de manageOuting y adaptador, incluidos anchors/errores; registration prueba privateAction; auditor de fronteras exige delegación de los adapters. Para manageEntry/updateAutomaticCollection/managePhoto no se identificó una matriz dinámica completa que legitime su retiro. Inventariar compatibilidad externa y agregar tests de invalidez/redirect antes de modificar. P3, riesgo medio-alto por API y navegación histórica; no es la primera familia de formularios activos.

## C10 — Crear serie manual: resultado especializado permitido

**Acción/consumidor.** saveManualSeries → createOutingCollection → CollectionForm. ID o null por selección no disponible; acción ya devuelve error general o saved/destination.

**Permisos/efectos.** Rol/unidades y confirmación del conjunto seleccionado, locks for share, inserts colección/miembros y auditoría atómicos; sin correo. El formulario conserva selección ante error y navega tras éxito.

**Objetivo y pruebas.** ID/null puede seguir como resultado de dominio explícitamente tipado; no necesita FormResult interno por uniformidad. Si se toca, nombrar el conflicto/payload y conservar la adaptación externa. outing-forms/functional-actions cubren selección/creación; idempotencia de creación manual sigue en R5, no se declara solucionada al tipar. P3, bajo; abordar al tocar series, sin prometer que cambiar tipo evita duplicados.

## Contratos que no deben convertirse automáticamente

- Consultas findRegistrationVolunteers, loadEditableRegistration y loadRegistrationDetail: people/data/error/total describen carga, no guardado. Sesión/unidad siguen comprobadas. Previews CSV (importPreview/previewPolicies) retornan rows/token/resumen; son lectura/validación, con errores de archivo y filas; aplicar ya devuelve FormResult.
- readOutingReports, briefAccess y consultas de portada/registro/galería: datos o ausencia autorizada; no resultados de mutación.
- login/logout: Auth.js/cookies/redirect. Route Handlers de fotos, cron y Auth.js: Response/HTTP, cabeceras/cache/status propios; no FormResult.
- OutingCreationError, OutingEditError y PhotoUploadError: excepciones tipadas para abortar transacciones/fases. Se adaptan en la frontera; retornarlas dentro de una transacción después de escrituras podría confirmar cambios parciales. No suprimir throw por uniformidad.
- `validate: (...) => Promise<unknown>` en photo-upload-workflow es callback interno de preparación con snapshot opaco, no una acción de formulario como ActionModal. Evaluar snapshot al tocar fotografías; no incluirlo en un reemplazo textual de unknown.
- `return` en preflightOnly, limpieza compensatoria o dispatch demo tiene intención de control/efectos, no un error de formulario silencioso.
- FormResult + payload de link/status/target, RegistrationActionResult con issue importante y tipos inferidos compatibles no son automáticamente un contrato duplicado. Mejorar payload requerido si hay riesgo concreto, sin eliminar el modal de identificación/póliza ni recibos privados.
- Mensajes de error traducidos son presentación; buscar truthiness/códigos de negocio, no eliminar todas las cadenas. `registry-csv` compara un sentinel headers del parser; pertenece al adaptador de archivo, no determina éxito de una mutación. Cambiarlo solo al revisar esa frontera.

## Plan por etapas y aceptación

| Etapa | Alcance mínimo | Evidencia requerida antes de cerrar |
| --- | --- | --- |
| E1 | C01 servicio/acción/adaptador/tests del informe | Borrador/finalizado, múltiples campos, enlace/version/roster, carreras y rollback; UI sin falsos éxitos ni pérdida de datos. |
| E2 | C05/C06 generación y revocación del enlace 70 | UUID inválido, permiso, asignación, enlaces viejos/nuevos, no-op, fallo SQL, payload y confirmación correcta. |
| E3 | C03 y luego C04: preparación de foto vs persistencia, proyección de errores | Tres productores, todos los errores aplicables, archivos retenidos, operación idempotente, Graph simulado y compensación. |
| E4 | C08 helpers de decisiones | Matriz de estados, versiones/carreras, cupos/espera/promoción, auditoría/cola sin duplicados; panel/menú/filtros conservados. |
| E5 | C07 portada destacada | Elegibilidad/fallback/no-op/permiso, contrato explícito y redirect compatible. |
| E6 | C02 tipado compartido y revisión de compatibilidad C09/C10 | Cada consumidor cumple el contrato sin casts amplios; cerrar solo el legado que tenga retiro justificado. C02 puede adelantarse si todos sus productores ya son compatibles. |
| E7 | Auditoría final transversal | Inventario sin huecos, excepciones justificadas, pruebas apropiadas y limitaciones visuales/remotas explícitas. |

Antes de cada etapa: revisar nuevamente consumidores; no asumir que el inventario es permanente. Verificar destino local desechable antes de escribir; sin credenciales beta, correo ni cargas reales. Mantener permisos, SQL/locks/versiones, atomicidad de auditoría/cola, efectos postcommit, semántica de reintento y navegación. No añadir migraciones ni funciones de producto para resolver tipado.

Comandos futuros según familia: `npm run ci:typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit:coverage`, `npm run test:contracts`, `npm run test:ci`, integración `test:integration:ci -- --only=<grupo>` con CI_DATABASE_URL protegida, y builds aislados si se modifican fronteras server/client. Usar Node/npm fijados y PostgreSQL 18.7; sin dotenv de beta. Un nuevo contrato no se valida únicamente haciendo coincidir dos adaptadores que delegan al mismo servicio.

## Pendientes y decisiones

La auditoría por sí sola no completó implementaciones. E1 fue implementada y verificada después en local; ver su informe enlazado. E2 también fue implementada/verificada localmente. Próximo paso técnico: E3 (fotografías), manteniendo las verificaciones visuales de E1/E2 pendientes. Mantener por separado R3 (políticas de sesión), R2 (JSX/adapters sin uso) y R5 (idempotencia restante). No mezclar su alcance con completar resultados.

Se necesita decisión antes de retirar compatibilidad externa de C09 o de modificar semántica de no-op; la opción conservadora es preservarlas. No hace falta cambiar reglas de cupos, borrador/finalización o permisos para ejecutar E1.

Siguen pendientes la primera CI remota autorizada, matriz visual completa CUA, dispositivos/lectores reales y verificaciones de infraestructura/proveedores. Una inspección estática o publicación del archivo de documentación no cierra esos puntos.
