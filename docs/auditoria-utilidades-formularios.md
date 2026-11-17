# Auditoría de acciones, resultados y utilidades de formularios

16 de noviembre de 2026. Base: `b7de052967c46bf89b17b2193428b19f6336cb84` publicado; esta tarea es únicamente análisis y documentación local. No modifica código funcional, pruebas, AGENTS, dependencias, permisos ni configuración. No accede a beta/proveedores ni ejecuta migraciones, envíos o cargas.

## Resultado

**Conservar updateFieldError.** Tiene un único sitio de llamada de producción, pero ese sitio pertenece al hook compartido por 17 módulos de UI. Expresa una regla verificable: actualizar el campo corregido sin borrar errores independientes y sin mutar el estado anterior. La cantidad de consumidores directos no mide su alcance ni justifica eliminarla.

No se justifica crear un ejecutor genérico de formularios, una nueva unión global de resultados o un hook universal de operaciones. Hay simplificaciones pequeñas y oportunidades de uniformidad defensiva concretas. Las prioridades son: completar fronteras runtime de una familia acotada, reducir exportaciones/imports sin uso demostrado y simplificar feedback redundante después del validador compartido. Las propuestas no están implementadas.

## Método y límites

Se leyeron AGENTS, README, TODO, inventario histórico/actual de contratos, auditoría E7, revisión de consumidores compartidos y lineamientos de implementación. Se contrastaron con código, wrappers, handlers y pruebas. Se analizaron mediante AST imports, reexports, exports e imports dinámicos de **330 archivos JS/TS en app, lib, scripts y tests; 223 de producción**. El subconjunto central inventariado comprende **103 símbolos exportados** (incluye tipos/etiquetas), entre ellos **31 funciones de los ocho módulos app/actions**. Se revisaron además public-actions, photo-actions, editor-action, outing-decision-actions, adaptadores y handlers activos.

Los conteos siguientes son módulos importadores directos, no llamadas, usuarios ni formularios distintos. Los imports se contrastaron con usos: ActionModal se importa en el detalle de salida sin usarse, mientras RegistryModal incorpora dos usos funcionales indirectos. Los imports dinámicos se registraron por módulo y se revisaron manualmente en las pruebas relevantes; no se atribuyen todos sus exports a un consumidor por esa coincidencia. Un tipo usado internamente, una callback pasada por props o una función llamada dentro de su archivo no es código muerto por carecer de imports externos. Tampoco se puede demostrar ausencia de consumidores externos de una interfaz publicada solo con este repositorio.

Se ejecutaron en esta revisión: análisis AST temporal, búsquedas de referencias, auditores de fronteras funcionales y autorización, comprobación de enlaces locales y diff. Los auditores pasaron: ocho módulos de acciones, diez servicios, delegaciones y sin imports JSX de los nueve adaptadores enumerados; 73 acciones/handlers en 24 archivos con política/capacidad declarada. Se usó Node global 25.2.1 exclusivamente para lectura/análisis estático; no es una validación nueva del runtime fijado 26.13.1.

No se repitieron instalación, unitarias, SQL, compilación ni CUA porque no hay cambios funcionales. La evidencia de 104 unitarias, 23 grupos SQL y CUA acotada corresponde a [E7](auditoria-final-contratos-heredados.md), no a esta auditoría. No se interpreta cobertura de funciones puras como cobertura de los hooks o de toda la UI.

## Inventario y decisiones

Clasificación: **A conservar**, **B simplificar/mover al tocar la funcionalidad**, **C retirar superficie/compatibilidad solo tras verificar consumidores**, **D extracción compartida justificada o candidata acotada**. Las pruebas mencionadas existen; su ampliación se exige antes de implementar una propuesta.

| Símbolo / archivo | Consumidores reales y responsabilidad | Evidencia / recomendación | Riesgo y pruebas requeridas |
| --- | --- | --- | --- |
| updateFieldError — lib/form-result.ts:40 | useFormFeedback.changed; una llamada dentro de reduce sobre campo y dependencias | A. Preservar inmutabilidad y errores independientes. Prueba directa en tests/unit/feedback.test.mjs; análisis específico abajo | Bajo al conservar; no inlinear sin mantener casos de borrar/poner/múltiples errores y dependencias |
| fieldErrorMessages — lib/form-result.ts:4 | Diez módulos de producción, más llamadas internas de checkedFormResult/updateFieldError; normaliza string/lista y descarta mensajes en blanco | A. Ya centraliza una semántica usada por resumen, campos, validadores de borde y legado | Alto si se sustituye por truthiness/length. feedback.test y form-result.test; blancos, listas y undefined |
| FormResult / FieldErrors — lib/form-result.ts | 36/18 módulos importadores respectivamente; consumidores de tipos y contratos | A. No crear contratos equivalentes por componente. RegistryForm ya usa ActionModalProps['action']; esa duplicación ya fue resuelta | Alto por alcance. Fixtures de tipos, límites de runtime, integración de familia afectada |
| checkedFormResult — lib/form-result.ts:15 | Catorce módulos: UI, managePhoto y checkedPhotoResult. Valida resultados desconocidos y proyecta feedback/destino | A. Es frontera runtime, no wrapper redundante. No preserva link/id/status/issue; conservar payload separado cuando se necesita | Alto. form-result.test, tipos negativos y CUA; respuesta ausente, malformada, contradictoria, errores múltiples |
| isFieldErrors — lib/form-result.ts, privada | Únicamente checkedFormResult | A. El único uso no justifica mezclar la validación estructural con la decisión principal | Bajo al conservar. Casos malformados de form-result.test |
| focusFormField / FieldError — app/form-feedback/form-feedback.tsx:18/86 | Sin imports externos localizados; se usan internamente por focus, FormField, FormFieldGroup y FormFeedbackBindings | C/B. Candidatas a dejar de exportarse, no a borrar. Mantener las funciones y su responsabilidad | Bajo/medio. Revisar reexports/pruebas/futuras APIs antes de quitar export; tipos y CUA foco/resumen/ARIA |
| useFormFeedback — mismo módulo:33 | Diecisiete módulos UI; conserva intentos, errores, etiquetas, dependencias y foco | A. Núcleo compartido, no extraer otro hook de formulario por encima sin caso concreto | Alto. Error antes/después del intento, dependencias, servidor, secciones ocultas y prioridad frente al scroll |
| revealForm / useFeedback / fieldId / errorId — mismo módulo, privadas/locales | Revelado de details, acceso a contexto y IDs por instancia | A. No inlinear por contar un uso ni convertir IDs en constantes globales | Alto en foco/ARIA. Secciones nativas/controladas, instancias simultáneas e IDs únicos |
| FormFeedbackProvider / FormErrorSummary / FormField — mismo módulo | Diecisiete importadores cada uno, con composiciones indirectas distintas | A. Componentes compartidos existentes; reutilizar, no otro sistema de feedback | Alto. DOM, teclado, etiquetas, errores múltiples y conservación de los controles |
| FormFieldGroup — mismo módulo:117 | Administración, importaciones, unidades e informe | A. Agrupa checkbox/selecciones con error de grupo; no sustituir por campo escalar por uniformidad | Medio. Anuncio/accesibilidad del grupo y foco al control pertinente |
| FormFeedbackBindings — mismo módulo:124 | Cuatro editores largos: salida nueva, edición, serie manual y datos comunes | B. Mantener puente DOM mientras esos controles no usan FormField; reducir por secciones al tocar cada editor, no eliminar en bloque | Alto en archivos. CUA de campos existentes, File input montado, limpieza de hosts/atributos y foco |
| ActionModal / ActionModalProps — app/coordinacion/action-modal.tsx | Ficha, unidades, RegistryModal, recordatorios y agrupación. Seis usos funcionales contando póliza/conciliación del wrapper | A/B. Mantener control de apertura/inFlight/dirty. Simplificar fallback redundante solo después de checkedFormResult y rama de fallo | Medio. action-modal-contract.ts, form-result.test, harness local/controlado, rechazo, reintento y doble envío |
| RegistryModal / RegistryForm — app/coordinacion/registry-form.tsx | Modal: póliza/conciliación. Inline: incidente/permisos | A. Wrapper agrega validador por kind; inline conserva reset exclusivo de incidente. No son una delegación sin semántica | Medio/alto. Validación por kind, reset solo tras éxito, permisos y CUA |
| PhotoPreview / PhotoDialogProps — app/coordinacion/photo-dialog.tsx:13/14 | Preview tiene uso interno y OutingEditor externo; Props sostiene la unión y tests/types/photo-dialog-contract.ts | A. Preview encapsula crear/revocar ObjectURL; Props permite verificar preparación frente a persistencia | Medio/alto. No quitar cleanup ni tipo por contar solo una importación; pruebas de tipo y CUA |
| checkedPhotoResult / PhotoPreparationResult — lib/photo-result.ts | Guardia: un consumidor, PhotoDialog. Preparación: diálogo/editor; forma local de éxito en creación | A. Una frontera especializada válida, respaldada por photo-result.test; no reemplazar prepared por saved | Alto. Preparación/persistencia contradictorias, varios errores y archivos retenidos |
| PhotoMutationError / OutingCreationError / OutingEditError / PhotoUploadError | Mutación/creación/editor/workflow y adaptación en acciones | A. Excepciones tipadas para abortar fases/SQL; parecido de constructores no justifica una clase universal | Alto. photo-uploads, outing-editor y outing-forms: rollback/compensación/errores y referencias compartidas |
| reportSubmissionResult — lib/report-result.ts:9 | Un consumidor: submitReport; valida id/estado/intención antes de destino | A. Adaptador de dominio, no delegación trivial; report-result.test independiente | Alto. Borrador/final, resultado contradictorio, persistencia fallida y ausencia de asistencia indebida |
| reportConfirmation — lib/report-result.ts:23 | Una página del informe; comprueba estado persistido y flag URL | A. Evita anunciar finalización por un query param; no inlinear para reducir exports | Alto. report-result.test: sin informe, estado distinto y combinación de flags |
| FieldErrorValue / PhotoFailure / PhotoResult / ReportStatus / RegistrationField | Sin imports externos directos localizados; usados en las firmas/tipos del mismo módulo | C/B. Evaluar visibilidad exportada, no borrar los tipos ni fusionar sus diferencias. Rendimiento no es una razón para retirar tipos borrados al compilar | Bajo. Fixtures TS y consumidores por reexport/inferencia; no mismo alcance que retirar una ruta publicada |
| legacyResultMessage — lib/legacy-operation-result.ts:5 | manageOuting y managePhoto; renderiza errores para redirects compatibles | A. Comparte formateo/deduplicación, no interpreta texto para decidir éxito | Medio. legacy-operation-result.test y legacy-operation-contracts; no volver a códigos textuales |
| formText / scalarInputErrors — lib/form-input.ts:4/8 | Siete módulos importadores cada uno; validación de FormData y entradas públicas | A. Frontera de datos: rechaza scalar con File o valores repetidos. No sustituir por String(form.get(...)) | Alto. runtime-inputs.test y pruebas de cada flujo; sin mutar FormData |
| textValues — lib/form-input.ts:13 | Un consumidor: outing-form-validation, para secuencias/periodos | A. Helper puro de entrada repetida, probado aisladamente; no eliminar por un consumidor | Medio. runtime-inputs.test: strings/File y secuencia original |
| historicalIdentification — lib/form-input.ts:18 | Validación y operaciones históricas autorizadas | A. Distinta de nueve dígitos de inscripción pública. No unificar reglas incompatibles | Alto. Histórico alfanumérico y formato público exacto en registration/runtime-inputs |
| validateDateFilter — lib/filter-validation.ts:3 | Una importación: StatusFilter, usado por Solicitudes e Informes | A. Ejemplo claro de reutilización indirecta. Mantener Hasta para rango invertido | Medio. feedback.test y filtros de las dos páginas; criterios conservados |
| validateParticipation / validateCancellation / validateRegistrationData / registrationDetails — lib/registration-validation.ts | Público/privado, servidor y validación de Coordinación por composición | A. Reglas compartidas con diferencias explícitas, no duplicación de un resultado de operación | Alto. registration.test/runtime-inputs; SQL público/privado/Coordinación, cupos/póliza/fechas sin cambios |
| validateStaffParticipation / validateEntryManagement / validateSplitGroup — lib/staff-registration-validation.ts | Formularios y servicios de Coordinación; cada validador tiene varios consumidores | A. Extienden reglas según actor/operación; no sustituir por validación cliente o motor de reglas | Alto. registration.test, staff-forms y decisiones; motivos/fechas/selección/versiones |
| validateProfile / validateRegistryForm — lib/profile-validation.ts / lib/registry-validation.ts | Ficha y registro/admin; validación cliente/servidor | A. Compartidas y probadas; helper local required conserva contexto y límites de cada kind | Alto. feedback/registry/runtime-inputs; separación Admin/Coordinación y unidades obligatorias |
| validatePhoto / validateNewOuting / validateOutingEdit / validateManualSeries / validateCommonSeries — lib/outing-form-validation.ts | Diálogo/acciones/servicios y editores, no solo UI | A. Composición y validación en las dos fronteras son deliberadas. No crear esquemas paralelos | Alto. outings.test, SQL de creación/editor/series, varias fotos/periodos y alcance explícito |
| validateReport / validateOutingDecision — lib/outing-report-validation.ts / lib/outing-decision-validation.ts | Cliente y operación del informe/decisión | A. Conservar intención borrador/final y confirmaciones específicas | Alto. outings/registry y SQL de informes/transiciones |
| mapErrors — NewOutingForm:87 | Varias llamadas locales; convierte índice de foto a ID estable de memoria | A. No es equivalente al editor que usa keys estables; no extraer un conversor genérico de claves | Alto en UX. Reordenar/eliminar foto, varios errores y archivo conservado |
| StaffParticipationFields — app/coordinacion/staff-participation-fields.tsx | AddRegistration y EditRegistration | A. Presentación ya compartida. Evitar otra extracción de campos equivalente | Medio. Diferencias de transporte, fechas y legacySeats; integración y CUA |
| ImportWizard — app/coordinacion/registro/importer.tsx | Importer y PolicyImporter, por props preview/apply | A. Extracción ya justificada. ImportPreview es consulta distinta de FormResult de aplicación | Alto. CSV malformado, filas inválidas, previsualización sin escrituras y confirmación explícita |
| createStaffInvitation / splitStaffGroup / addRegistration, payloads link/id/status opcionales | Servicios/acciones y PrivateLinkForm/SplitGroupForm/AddRegistration | B. Estrechar payload requerido en éxito al tocar cada familia, reutilizando FormResult<Field, Payload>. No crear otro resultado global | Medio. Tipos negativos para éxito sin payload y SQL/consumidor correspondiente; estado de espera conserva mensaje |
| createOuting.target — app/actions/outings.ts:17/23 | No se localizó lectura activa de esta propiedad del resultado; fieldErrors sí se consume | C/B. Candidato a retirar payload residual tras confirmar tests/compatibilidad. No eliminar target de las excepciones que se adapta a fieldErrors | Medio. Búsqueda completa de consumidores y error de periodo/foto con foco; no confundir propiedad serializada con target interno |
| decideOuting / saveOutingEdit — outing-decision-actions.ts / salidas/[id]/editor-action.ts | OutingDecisionForm y OutingEditor respectivamente | A/B. Son fronteras de autorización/SQL/fotos, no wrappers de una sola llamada. Ubicación local puede alinearse con app/actions al tocar la familia (R2/R3); no mover por estética ahora | Alto. Política de servidor, locks, auditoría/cola postcommit y fotos compensadas |
| updateAutomaticCollection / privateAction | Compatibilidad de serie y enlace privado, no ruta nueva del editor moderno | C. Conservar redirects mientras se verifica fin de compatibilidad; no reemplazar su resultado con FormResult solo por uniformidad | Alto. functional-actions/legacy-operation-contracts/registration, URLs/fragmentos/errores |
| Nueve módulos de compatibilidad inventariados en E7 | Pruebas y contrato preservado; tres sin consumidor dinámico localizado | C. Ya hay tarea R2; no crear otro TODO ni borrar por ausencia de JSX | Alto por interfaz publicada; criterio de retiro e inventario abajo |

Los números de línea son de la base revisada. No representan una autorización para cambiar esos símbolos en esta tarea.

## updateFieldError: análisis específico

En `useFormFeedback.changed` se revalida el formulario, pero se aplican únicamente las correcciones del campo modificado y sus dependencias. El reduce llama a updateFieldError por cada campo de ese conjunto. Una sola expresión de llamada puede ejecutarse muchas veces en todos los formularios que usan el hook.

Ejemplo de la regla: con errores name y email, corregir name no debe borrar email ni otros errores del servidor. El helper copia el objeto anterior, elimina solo el campo que ya no tiene mensajes y conserva la lista cuando hay varias correcciones. fieldErrorMessages mantiene la misma definición de mensaje visible que el resto del feedback.

Opciones evaluadas:

- **Conservar en lib/form-result.ts (recomendada ahora):** módulo puro, sin React/DB/red y con pruebas existentes. Evita acoplar las pruebas de esta regla al DOM. No obliga a crear archivos ni capas nuevas.
- Mover a un módulo puro de feedback: defendible por cohesión si el estado de errores crece y aparecen más operaciones; hoy agregaría movimiento/archivo sin un beneficio suficiente. No crear ese módulo solo para alojar una función.
- Mover como función privada dentro de form-feedback.tsx: reduce la API, pero obliga a probar el hook o introducir otra frontera para una regla que hoy se prueba sin React. No mejora claramente la legibilidad.
- Inlinear en el reduce: ahorra un nombre pero oculta la regla de conservación y dificulta su prueba directa. No se recomienda.

La prueba `field corrections preserve unrelated server errors and accept multiple messages` comprueba corrección/eliminación, error nuevo, preservación de otros campos, inmutabilidad, arrays y array vacío. **Límite:** no prueba por sí sola la ejecución React de dependencies ni la regla antes del primer intento; esos comportamientos pertenecen a useFormFeedback y su evidencia DOM. Al tocar el hook conviene añadir un recorrido específico de dependencias sin sustituir el validador real.

## Duplicación: dónde simplificar y dónde no

### Feedback posterior a una guardia: simplificación concreta (B)

ActionModal llama checkedFormResult y entra en la rama `saved !== true`. La guardia ya garantiza error general o mensajes por campo no vacíos. El cálculo posterior con optional chaining, Object.values/some y un segundo fallback vuelve a comprobar esa garantía. RegistryForm y ManageRegistrationForm muestran directamente los errores del resultado validado.

Etapa mínima: simplificar solo esa rama de ActionModal, manteniendo catch e inFlight/finally. No crear `hasErrors`, `normalizeResult` ni un hook de submit para eliminar ese cálculo. Los fallback de **PrivateLinkForm y CollectionForm no son todos equivalentes**: también cubren saved sin link/destination requerido. Los de informe/creación cubren ausencia de destino. Deben conservarse o tiparse de forma específica; no borrarlos mediante un reemplazo global.

### Mensajes por campo y formularios distintos (A)

`Object.keys(errors).length` y `Object.values(errors).some(fieldErrorMessages...)` no son equivalentes para `{field:undefined}`, strings blancos o listas vacías. Los validadores de dominio actuales crean mensajes concretos en sus fallos; no se constató un fallo de negocio por esta diferencia. No se propone una extracción global hasta elegir y probar una semántica común. La normalización de mensajes ya está en fieldErrorMessages.

Se repiten captura de FormData, validate/showErrors, ref inFlight, estado pendiente y finally. Lo que ocurre entre ellos cambia: crear/navegar, actualizar/refrescar, generar payload privado, preparar foto sin persistir, aplicar CSV y limpiar filas, cancelar con issue de gastos, o resetear un incidente después de éxito. Un ejecutor genérico requeriría callbacks/opciones para reconstruir esos flujos y ampliaría el riesgo sin necesidad demostrada.

### Fotos y excepciones (D candidata, no recomendada aún)

createOuting y saveOutingEdit comparten una proyección breve de PhotoUploadError: provider como general; otros como fieldErrors. mutatePhoto, en cambio, agrupa mensajes del upload bajo `photo` porque usa el control de un solo archivo. No son tres conversiones intercambiables.

Solo si crecen consumidores con la **misma** proyección se justifica una función pura limitada a PhotoUploadError, sin IO ni cambios de transacción. Dos ramas breves no justifican ahora una jerarquía de errores, un adaptador universal o un wrapper Graph nuevo. Los constructores OutingCreationError/OutingEditError difieren en target y en la forma en que se preserva rollback; no fusionarlos por semejanza visual.

### Fronteras runtime todavía dispares (B; uniformidad defensiva, no fallo constatado)

AddRegistration, EditRegistration, OutingDecisionForm, ImportWizard, RememberRegistration y PrivateRegistrationForms aún tienen comprobaciones como `if (!result.saved)` sin checkedFormResult. Los productores actuales están tipados y sus caminos normales retornan el contrato; la revisión no demuestra que produzcan un saved malformado. Una respuesta sintética contradictoria/truthy podría, sin embargo, llegar al camino de éxito del consumidor, a diferencia de ActionModal y los editores endurecidos en E7.

La simplificación adecuada es **reutilizar checkedFormResult por una familia**, no escribir otro normalizador ni cambiar sus servicios. Para AddRegistration debe conservarse status, y para público/privado issue y el flujo autorizado de recordar datos; la proyección de checkedFormResult no preserva esos payloads. Mantener el original validado por su contrato especializado cuando corresponda. ImportPreview y las búsquedas siguen siendo consultas, no guardados. Esta es una ampliación defensiva de consumidores distinta de repetir las migraciones C01–C10 ya completadas.

## Compatibilidad y código sin uso

- Import de ActionModal en `app/coordinacion/salidas/[id]/page.tsx`: no tiene uso JSX/tipo localizado. Puede retirarse en una limpieza mínima. No demuestra que ActionModal o todos los formularios antiguos del archivo estén sin uso.
- focusFormField y FieldError: funciones vivas dentro del módulo; solo su exportación externa parece innecesaria. Igual distinción para FieldErrorValue, PhotoFailure, PhotoResult, ReportStatus y RegistrationField, usados en firmas/composición interna.
- PhotoDialogProps tiene consumidor de pruebas de tipos y uso interno: no retirarlo como si no existiera consumidor.
- ReportReminder ya enlaza directamente sendReportReminder; RegistryForm ya reutiliza la firma de ActionModal. No repetir esos cambios ya publicados.
- `app/staff-actions.ts`, add-registration-actions, registration-detail-actions, attendance-actions, resumen/actions y el adaptador de informe están en pruebas de compatibilidad. edit-registration-actions, manage-registration-actions y report-reminder-actions no tienen consumidor dinámico localizado, pero permanecen en inventarios y contrato preservado. Detalle en [consumidores compartidos](consumidores-compartidos-resultados.md).
- Antes de retirarlos: confirmar fin de compatibilidad publicada, buscar imports dinámicos/reexports y consumidores externos, migrar pruebas y ajustar el auditor/inventario. Una prueba estática que exige su existencia no demuestra uso de negocio, pero tampoco autoriza romper el contrato.
- Solicitud de apoyo conserva un consumidor alcanzable de manageOuting. Las ramas de edición antiguas siguen pendientes de R2; revisar el return de la página antes de retirar cada rama. No borrar el conjunto por una búsqueda de nombres.

No se localizó una función de los módulos centrales que pueda borrarse entera con seguridad solo por tener cero imports externos. Sí hay superficie exportada e imports candidatos, y compatibilidad que requiere una decisión explícita.

## Etapas mínimas y próximos tres cambios

### 1. Frontera de resultados de Agregar/Editar inscripción (P2, beneficio defensivo)

Alcance: únicamente AddRegistration y EditRegistration y sus contratos estrictamente necesarios. Reutilizar checkedFormResult conservando status y el mensaje revisión/espera; sin cambiar SQL, auditoría, cupos ni correo. Tras verificar esa familia, evaluar las restantes por separado, no migrarlas todas en el mismo cambio.

Aceptación: respuesta vacía, string, truthy, contradictoria y rechazo no cierran ni confirman; varios errores conservan datos/persona/archivo y foco; una petición mientras está pendiente; reintento normal mantiene status real y navegación. Tipos, pruebas de resultado y SQL staff-forms/functional-actions pertinentes; CUA de modal desktop/móvil. No afirmar idempotencia de servidor solo por inFlight.

Exclusiones: público/privado, importaciones, OutingDecisionForm, cambios de notificaciones y un ejecutor genérico. Riesgo medio por payload status y cierre del modal. No es una vulnerabilidad de permisos demostrada.

### 2. Reducir superficie interna sin eliminar reglas (P3, bajo riesgo/beneficio moderado)

Primero retirar el import no usado de ActionModal. Revisar export de focusFormField/FieldError y los tipos locales enumerados; privatizar solo los que no sostengan un contrato necesario. **Mantener updateFieldError**, PhotoDialogProps y las nueve rutas de compatibilidad hasta sus condiciones de retiro.

Aceptación: inventario AST/referencias revisado, sin imports/reexports rotos, TypeScript y pruebas apropiadas; funciones internas siguen presentes. CUA de foco/campos/ARIA si cambia la composición del feedback. No reestructurar todo el módulo ni eliminar snapshots de prueba para hacer desaparecer consumidores.

Exclusiones: interfaces publicadas, eliminación de lógica y migración de formularios largos. Riesgo bajo en import, medio en API de tipos; retirar un export no debe obligar a añadir casts.

### 3. Simplificar feedback redundante de ActionModal (P3, cambio acotado)

Sustituir el chequeo defensivo repetido de su rama de fallo por consumo directo del resultado ya validado, siempre que las pruebas demuestren la garantía de checkedFormResult. Mantener catch para rechazos de la acción, inFlight/finally, control local/externo, errores por campo, foco, archivo y navegación.

Aceptación: contratos negativos y form-result.test; harness para errores generales/múltiples, campos ocultos, respuesta indefinida/contradictoria, doble clic, reintento y guardado normal. Sin cierres ni confirmaciones falsas. No quitar fallback de payload requerido de enlaces o destinos por analogía.

Exclusiones: cambiar FormResult, estilos, flujo de publicación, callbacks de fotos o crear `hasErrors` por anticipado. Riesgo bajo/medio; si la simplificación requiere ampliar el contrato, detenerse y conservar el código.

Después, al tocar la funcionalidad: estrechar payloads opcionales, revisar target residual de creación y las demás fronteras runtime; coordinar retiro de compatibilidad con R2 y desacoplamiento de sesión con R3. Mantener R5/idempotencia, matriz CUA completa, CI remota, infraestructura y retención como pendientes independientes. Ninguna recomendación de esta auditoría se marca como implementada.

## Anexo: símbolos centrales contrastados

Lista de los 103 exports del subconjunto central del análisis. Incluye funciones, tipos y constantes; su presencia no implica deuda ni propuesta de eliminación. Los imports dinámicos y callbacks se revisaron aparte, como se explica en el método. Las recomendaciones por responsabilidad están en la tabla anterior.

| Módulo | Símbolos exportados revisados |
| --- | --- |
| app/actions/administration.ts | `grant` |
| app/actions/communications.ts | `createOutingInvitation`, `generateBrief`, `revokeBrief`, `sendReportReminder` |
| app/actions/outings.ts | `createOuting`, `manageOuting`, `splitOutingGroup` |
| app/actions/registrations.ts | `manageEntry`, `findRegistrationVolunteers`, `addRegistration`, `loadEditableRegistration`, `saveEditedRegistration`, `manageRegistration`, `loadRegistrationDetail` |
| app/actions/reports.ts | `reconcileAttendance`, `submitReport` |
| app/actions/series.ts | `createOutingCollection`, `updateAutomaticCollection`, `saveAutomaticCollection`, `setHomepageFeature` |
| app/actions/session.ts | `login`, `logout` |
| app/actions/volunteers.ts | `verifyPolicy`, `importPreview`, `applyImportRows`, `editProfile`, `updateVolunteerUnits`, `previewPolicies`, `applyPolicyRows`, `recordVolunteerIncident` |
| app/coordinacion/action-modal.tsx | `ActionModalProps`, `ActionModal` |
| app/coordinacion/manage-registration-form.tsx | `ManageRegistrationForm` |
| app/coordinacion/photo-dialog.tsx | `PhotoChoice`, `PhotoPreview`, `PhotoDialogProps`, `PhotoDialog` |
| app/coordinacion/private-link-form.tsx | `PrivateLinkForm` |
| app/coordinacion/registry-form.tsx | `RegistryModal`, `RegistryForm` |
| app/form-feedback/form-feedback.tsx | `focusFormField`, `useFormFeedback`, `FormFeedbackProvider`, `FieldError`, `FormField`, `FormErrorSummary`, `FormFieldGroup`, `FormFeedbackBindings` |
| lib/filter-validation.ts | `validateDateFilter` |
| lib/form-input.ts | `formText`, `scalarInputErrors`, `textValues`, `historicalIdentification` |
| lib/form-result.ts | `FieldErrorValue`, `FieldErrors`, `fieldErrorMessages`, `FormResult`, `checkedFormResult`, `updateFieldError` |
| lib/legacy-operation-result.ts | `LegacyOutingResult`, `LegacyEntryResult`, `legacyResultMessage` |
| lib/outing-decision-validation.ts | `OutingDecision`, `validateOutingDecision` |
| lib/outing-form-validation.ts | `validatePhoto`, `validateNewOuting`, `validateOutingEdit`, `validateManualSeries`, `validateCommonSeries` |
| lib/outing-report-validation.ts | `ReportValues`, `ReportField`, `ReportErrors`, `validateReport` |
| lib/photo-result.ts | `PhotoFailure`, `PhotoPreparationResult`, `PhotoResult`, `checkedPhotoResult`, `PhotoMutationError` |
| lib/profile-validation.ts | `profileFieldLabels`, `ProfileField`, `ProfileInitial`, `validateProfile` |
| lib/registration-validation.ts | `RegistrationField`, `RegistrationSchedule`, `RegistrationActionResult`, `registrationFieldLabels`, `registrationLimits`, `validateParticipation`, `validateCancellation`, `registrationDetails`, `validateRegistrationData` |
| lib/registry-validation.ts | `RegistryFormKind`, `validateRegistryForm` |
| lib/report-result.ts | `ReportStatus`, `ReportSaveResult`, `ReportSubmissionResult`, `reportSubmissionResult`, `reportConfirmation` |
| lib/staff-registration-validation.ts | `staffRegistrationLabels`, `validateStaffParticipation`, `validateEntryManagement`, `validateSplitGroup` |

## Seguimiento de etapa 1 — 16/11/2026

Agregar/Editar inscripción se implementaron después de este análisis: [contratos, pruebas y límites](contratos-agregar-editar-inscripcion.md). Ambos consumidores validan su respuesta; el alta exige revisión/espera y conserva errores generales junto a los de campo. La observación previa sobre esos dos formularios y status opcional es histórica. Siguen pendientes OutingDecisionForm, ImportWizard y público/privado, además de las etapas de exports y simplificación de ActionModal. La implementación no cambia la recomendación de conservar updateFieldError ni autoriza publicar.
