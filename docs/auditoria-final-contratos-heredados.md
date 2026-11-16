# Auditoría final local de contratos heredados — E7

16 de noviembre de 2026. Árbol local posterior a C01–C10 y a la revisión de consumidores compartidos, incluyendo los cambios aún sin publicar. Esta auditoría cierra su revisión técnica local; no certifica una matriz visual completa, CI remota ni proveedores. No se publicó, migró beta ni activó automatizaciones.

## Conclusión y alcance

Se contrastaron AGENTS.md, README, TODO, el inventario inicial y sus actualizaciones, los informes de cada etapa, las acciones canónicas, servicios, adaptadores y consumidores React. Se revisaron retornos, errores generales/por campo, discriminantes, rutas de éxito y efectos posteriores al commit. Las búsquedas se contrastaron con usos reales: una coincidencia de `return`, `string` o `unknown` no demuestra un contrato heredado.

Las diez familias inventariadas están migradas a resultados explícitos o a sus contratos especializados legítimos. No se localizaron consumidores activos que necesiten los strings/void ambiguos anteriores ni casts a FormResult para aceptarlos. ActionModal ya no admite Promise<unknown>. No se encontró otra duplicación nueva de un sistema de resultados. El chequeo runtime en una envoltura y en su consumidor tiene funciones defensivas distintas; no duplica reglas de negocio.

Se preservan adaptadores publicados con consumidores de pruebas y tres sin consumidores dinámicos localizados. Por tanto **no se afirma ausencia absoluta de adaptadores sin consumidores**: están inventariados y su retiro sigue siendo una decisión R2. No se borran interfaces publicadas basándose solo en la ausencia de JSX.

## Familias y consumidores actuales

| Caso | Productor → consumidor activo | Contrato eliminado / vigente | Evidencia y límite |
| --- | --- | --- | --- |
| C01 Informe del 70 | saveOutingReport → submitReport → ReportForm/page | id/status implícitos y espejo errors retirados; ReportSaveResult/ReportSubmissionResult, borrador/final explícitos | unitarias report-result; functional-actions, outing-forms, registration, workflow-transitions, authorization. Frontera runtime en ReportForm; matriz visual completa del informe pendiente |
| C02 Modal y wrappers | productores de ficha, unidades, póliza, conciliación, recordatorio, agrupación → ActionModal/RegistryModal; incidentes/permisos → RegistryForm | Promise<unknown>/casts retirados; Promise<FormResult>, checkedFormResult, firma compartida | fixture de tipos de ocho productores, unitarias y CUA local/controlado/inline; no todas las pantallas reales |
| C03 Preparación de fotos | NewOutingForm/OutingEditor/AttachPhotos → PhotoDialog | string/void retirados; prepared explícito separado de saved | photo-result, tipos PhotoDialog, photo-uploads y outing-editor; CUA completo del flujo de fotos pendiente |
| C04 Persistencia de fotos | mutatePhoto/attachOutingPhoto → AttachPhotos; managePhoto conserva redirect | inferencia por prefijos y casts de errores retirados; PhotoMutationError/PhotoUploadError y todos los mensajes aplicables | photo-result, photo-uploads, outing-forms, legacy-operation-contracts; sin Graph real |
| C05 Generar enlace 70 | generateStaffBrief → generateBrief → PrivateLinkForm/ShareBrief | éxito interno indefinido/string retirado; BriefLinkResult con link requerido | brief-contracts/functional-actions/authorization; CUA nuevo con acción simulada para errores y generación |
| C06 Revocar enlaces 70 | revokeStaffBrief → revokeBrief → ShareBrief | void/UUID inválido sin resultado retirados; FormResult | brief-contracts, fallo SQL, acceso y concurrencia; CUA de respuesta contradictoria sin confirmación |
| C07 Destacada | saveHomepageFeature → setHomepageFeature → HomepageFeatureControl | retornos silenciosos/string retirados; FormResult y redirect legítimo Promise<never> | homepage-feature-contracts, elegibilidad/fallback/no-op/error sin confirmación; CUA de pantalla real pendiente |
| C08 Decisiones/70 | workflow → manageStaffEntry → manageRegistration → ManageRegistrationForm y panel/menú | códigos/string implícitos retirados; FormResult, éxito literal validado | registration-decision-contracts, workflow-transitions, staff-forms, authorization; matriz visual de todos los estados pendiente |
| C09 Gestión antigua | manageOutingRecord/manageLegacyEntry/saveCommonSeries/mutatePhoto → acciones de compatibilidad HTTP | servicios con strings/void ambiguos retirados; LegacyOutingResult/LegacyEntryResult/FormResult, redirects conservados | legacy-operation-contracts, functional-actions, authorization. Solicitud de apoyo sigue alcanzable; no se borró como código muerto |
| C10 Serie manual | saveManualSeries → createOutingCollection → CollectionForm | ID/null retirados; ID/destino obligatorios en éxito y errores explícitos | manual-series-contracts, outing-forms, functional-actions y tipos; repetición válida sigue creando otra serie por semántica histórica R5 |

El detalle de consumidores, nueve rutas de compatibilidad y sus condiciones de retiro está en [consumidores compartidos](consumidores-compartidos-resultados.md). Sus inventarios estáticos y delegaciones se volvieron a ejecutar. No hay imports JSX de esas nueve rutas; las pantallas usan los módulos funcionales. Ramas JSX antiguas no alcanzadas y limpieza de adaptadores pertenecen a R2.

## Correcciones de esta auditoría

1. PrivateLinkForm ahora valida el resultado con checkedFormResult antes de presentar el link o notificar éxito. Conserva el payload original y su discriminante; no castea ni proyecta como si el validador de feedback conservara link. Un saved verdadero acompañado de error ya no muestra enlace ni confirmación. Se aplica al consumidor compartido de invitaciones y enlace del 70.
2. ShareBrief valida la respuesta de revocación antes de cambiar la presentación y tiene una ref síncrona inFlight, además del estado pendiente, para evitar invocaciones simultáneas desde ese control.
3. ReportForm valida el resultado recibido antes de navegar y muestra error general si falta el destino requerido. Nueva convocatoria, edición de salida y datos comunes de serie también reutilizan checkedFormResult y éxito literal; creación sin destino devuelve feedback general. Mantiene el destino producido por su acción especializada; no cambia borrador, finalización ni datos enviados.
4. El harness UI incorpora dobles explícitos de acciones para enlaces, únicamente en una copia temporal. Los consumidores reales se conservan; solo se sustituyen allí sus imports a acciones. Los resultados malformados de ese fixture JS son intencionales y no son contratos de producción.

Son endurecimientos de fronteras y del bloqueo de invocaciones, sin cambios intencionales de reglas, estilos, endpoints, permisos o notificaciones. La única diferencia observable buscada es rechazar respuestas contradictorias/inesperadas como fallo y no anunciar éxito. Una compilación intermedia detectó la pérdida de estrechamiento del payload link; se corrigió comprobando también el discriminante del resultado original, sin cast. Tipos y build final pasaron.

## Excepciones legítimas y deuda separada

- FormResult vacío sirve como estado inicial, nunca como éxito de una operación. El validador runtime lo rechaza como respuesta de envío.
- Queries de personas, galerías y detalles; previews CSV; lecturas de informes; HTTP/Response; Auth.js y redirects mantienen sus contratos propios. Los redirects no se atrapan como errores de guardado.
- PhotoDialog distingue preparar en memoria de persistir. Las excepciones tipadas de fotos/edición abortan transacciones o fases y se adaptan en el borde; reemplazarlas por retornos después de escrituras podría confirmar datos parciales.
- Promise<unknown> de validate en photo-upload-workflow es un snapshot opaco interno, no la acción de un formulario. Unknown de los validadores runtime es una entrada deliberada de frontera. Los tests negativos también lo usan deliberadamente.
- La comparación del sentinel de cabecera CSV clasifica errores de archivo; no decide éxito de una mutación a partir de texto.
- Payloads opcionales en tipos inferidos/compatibles, como invitación o splitStaffGroup, pueden estrecharse cuando se toque esa familia; las ramas actuales de éxito producen el dato y los consumidores relevantes lo comprueban. No se presenta esa oportunidad de tipado como una nueva migración pendiente de strings/void ni se amplía el contrato global para resolverla.
- No-op explícito continúa como éxito donde ya era una operación válida. No se introdujo un discriminante global sin necesidad.

## Reglas y efectos conservados

Se ejecutó SQL real exclusivamente en un clúster nuevo PostgreSQL 18.7 UTF8 loopback 127.0.0.1:55503, con usuario ficticio asvo_ci. El runner validó destino/versión antes de crear las bases reservadas de cada grupo. No se cargaron dotenv de la aplicación ni credenciales de proveedores.

La matriz SQL verifica falta de sesión, otra unidad, roles insuficientes, recursos y enlaces inválidos/vencidos/revocados; bloqueos y versiones obsoletas; decisiones simultáneas; auditoría/cola atómicas; borrador sin asistencia y final inmutable; cupos, espera y promociones; fotos con autorización previa, compensación, reintentos y referencias compartidas. Los grupos mail-outcomes y photo-uploads usan dobles para fallos externos y concurrencia.

**Un rechazo no equivale siempre a ausencia absoluta de efectos.** La recuperación de una inscripción puede rechazarse después de una promoción FIFO legítima a otra persona. La implementación histórica devuelve error para la recuperación y mantiene el despacho autorizado de esa promoción. La suite lo comprueba; no se transformó en éxito ni se alteró su transacción para forzar un rollback universal. Los errores de controles puros no habilitan ese despacho.

No se encontraron confirmaciones falsas en los caminos cubiertos. Las aserciones SQL comparan registros, auditoría, outbox y efectos de invalidación; no solo igualan dos adaptadores. Se mantienen deduplicación de cola, orden por inscripción, reservas de worker y destinatarios .test. La aceptación de Graph no significa entrega ni exactamente una vez. Resultados inciertos de correo siguen pendientes de revisión según su modelo vigente, no se reenvían ciegamente.

La protección inFlight evita envíos simultáneos desde controles cubiertos, pero no garantiza idempotencia de todas las operaciones frente a recarga/repetición de una petición ya confirmada. Serie manual conserva expresamente esa limitación histórica R5. No se cambiaron reglas para ocultar el riesgo.

## Comprobaciones ejecutadas

Runtimes verificados: Node 26.13.1, npm 11.7.0, PostgreSQL 18.7; Next 16.4.5. Binarios/fuentes oficiales temporales con los SHA256 ya registrados en validacion-node26-postgres18.md. Sin instalación global ni modificación de Vercel/Neon.

| Comprobación | Resultado |
| --- | --- |
| check-runtime | Node del padre, PATH e hijo 26.13.1; npm 11.7.0 |
| ci:install:verify | npm ci en copia limpia, ignore-scripts, lockfile intacto, sharp nativo y build Turbopack sin DB/proveedores |
| ci:typecheck | Next typegen + TypeScript en copia limpia, fixtures de tipos y casos negativos, incluido el código final corregido |
| lint | 344 archivos, sin errores; incluye dobles del harness |
| format:check | Alcance Prettier configurado del proyecto aprobado; no se afirma formateo global de todos los TSX |
| test:unit:coverage | 104 pruebas aprobadas, 38 módulos puros declarados: líneas 1230/1230 (100 %), ramas 1311/1355 (96,75 %), funciones 225/226 (99,56 %). No es cobertura global ni React/DOM |
| test:contracts | Inventarios de autorización/fronteras y contratos Auth.js/correo con dobles, sin red real ni DB |
| test:ci | Ocho controles locales aprobados; no ejecuta el workflow remoto |
| test:integration:ci | Los 23 grupos del manifest aprobados; migración desde cero, adopción compatible/incompatible, checksums, fallo intermedio y ejecutores concurrentes incluidos |
| test:security:build | Build Webpack final; rutas HTTP/cabeceras/Auth.js local/cron no autorizado; rechazo real de importar DB desde cliente; sin efectos externos durante build/inicio |
| diff | Sin errores de whitespace; cambios de infraestructura/workflows/migraciones/dependencias: ninguno |

La integración completa incluye manual-series-contracts, legacy-operation-contracts, registration-decision-contracts, homepage-feature-contracts, brief-contracts, functional-actions, mail-outcomes, photo-uploads, workflow-transitions, authorization, registration, public-registration, staff-forms, registry-forms, outing-forms, form-audit, outing-editor, volunteer-search, volunteer-participation, summary, security, db-commands y schema-migrations. Se retiraron las bases de cada grupo.

## Navegador, accesibilidad y límites

Se ejecutó el harness disponible con CUA IAB, CSS y consumidores compartidos reales, sin base ni Graph, sobre copia sin dotenv. [Registro reproducible de resultados](../tests/action-modal/browser-results-e7.json) y [captura móvil](../tests/action-modal/evidence/auditoria-e7-mobile.png).

Verificado en esta sesión:

- Modal local y controlado, errores múltiples, foco inicial, apertura de sección oculta desde resumen, errores generales/por campo y rechazo de respuestas indefinidas, string, saved truthy, contradictorias y excepciones sin cerrar.
- Texto y valor del selector de archivo ficticio conservados ante errores. La API CUA no expuso FileList/bytes en su evaluación de DOM; no se afirma inspección del payload del archivo.
- Doble clic con respuesta demorada: contador 7 → 8, controles deshabilitados, sigue 8 al terminar el fallo; reintento correcto 8 → 9, cierre y franja de éxito.
- Generación de enlace con errores de campo, respuesta vacía, contradicción o excepción: sin link nuevo ni confirmación; éxito simulado genera link y franja. Revocación contradictoria conserva error y no afirma revocación.
- RegistryModal: dos correcciones, fallo general conserva selección/motivo, reintento correcto. RegistryForm: resultado ausente conserva datos, reintento explícito confirma.
- Móvil 390 × 844: modal de 358px, sin overflow horizontal; campos con aria-invalid, aria-describedby e IDs distintos, foco en primero. Viewport restablecido y pestaña cerrada.

El pendiente de doble envío demorado/reintento de la revisión anterior queda cubierto para ActionModal. No equivale a prueba de todos los controles ni a idempotencia global. Los criterios unidad/pestaña permanecieron en la URL del harness; no se ejecutó de nuevo la suite completa de recorridos multinivel de tests/navigation/browser.mjs. Las unitarias aisladas de navegación sí se ejecutaron dentro de las 104 y no se alteró su implementación.

**Pendiente visual explícito:** PhotoDialog completo con archivos reales de prueba/galería y reintentos, informe completo del 70, destacada, gestión de cada estado y serie manual, más matriz de pantallas reales y recorridos de navegación. CUA sigue siendo una dependencia interactiva, no CI autónomo. Se comprobaron DOM/árbol accesible/foco; no voz de lectores de pantalla reales, Safari/Firefox ni dispositivos físicos. La evidencia histórica permanece fechada; no se convierte en una ejecución nueva.

## Publicación posterior y decisiones

- Completar la matriz visual anterior y los recorridos de negocio con sus fixtures locales aislados; priorizar fotos e informe del 70.
- Autorizar y observar primera CI remota/Linux por separado. No se activaron workflows ni se cambiaron reglas del repositorio.
- Decidir fin de compatibilidad de rutas publicadas antes de retirar adaptadores R2. R3 (sesión) y R5 (idempotencia restante) siguen siendo trabajos distintos.
- Conservar revisiones institucionales de retención/infraestructura y permisos efectivos de proveedores como pendientes externos. No se consultaron ni cambiaron aquí.
- No hay cambios de esquema nuevos por esta auditoría. La preparación operativa de una publicación deberá revisar las migraciones ya existentes en la rama y el procedimiento vigente de workers; no se ejecutó contra beta ni se asume su estado.

La auditoría técnica local está ejecutada y documentada. No se declara aprobación total de publicación mientras esos límites sigan abiertos.

## Limpieza final comprobada

La consulta de cierre devolvió PostgreSQL 18.7 / UTF8 y cero bases con prefijo asvo. Se detuvo el servidor local; el harness retiró su copia. Los ejecutores de instalación, tipos y build retiraron sus copias al terminar. Fuentes, binarios y clúster temporales de esta auditoría se retiraron después de las comprobaciones; permanecen únicamente pruebas, documentación y evidencia ficticia en el repositorio.
