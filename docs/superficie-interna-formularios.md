# Etapa 2: superficie interna de formularios

16 de noviembre de 2026. Base ac50b645f1be8e0bf4bc9927dffc558c4faa7aa3. Implementación local de la [auditoría de utilidades](auditoria-utilidades-formularios.md), sin publicación.

## Inventario y decisiones

Se revisaron AGENTS, README, TODO, auditoría, diff y convenciones; guía instalada de Next sobre frontera servidor/cliente. El árbol inicial solo tenía `.codex/` sin seguimiento, que no se modificó. Los candidatos seguían en el código; la homologación Agregar/Editar ya estaba realizada y no se repitió.

Inventario AST temporal con el parser Babel incluido en Next: **339 archivos JS/TS/JSX/TSX** de app, lib, scripts y tests, ninguno sin parsear. Se examinaron declaraciones/exportaciones, identificadores (incluido JSX), imports con alias, namespaces, reexports y 153 expresiones de import dinámico. No hay imports/reexports externos de los siete símbolos candidatos, ni namespaces/reexports de los módulos analizados. El único import con argumento no literal, `import(module)` en tests/unit/isolation.test.mjs, recorre una lista explícita de infraestructura prohibida; no consume estos símbolos. Se contrastaron búsquedas textuales, firmas y consumidores indirectos; TypeScript complementa el análisis sintáctico con resolución de tipos. El AST no certifica consumidores fuera del repositorio.

| Candidato | Referencias y responsabilidad | Decisión |
| --- | --- | --- |
| Import ActionModal en salidas/[id]/page.tsx | Únicamente declaración del import, sin uso JSX/tipo; el componente sí tiene consumidores reales en otros archivos | Retirado únicamente ese import |
| focusFormField | Declaración y llamada desde el hook, dentro de form-feedback.tsx; cero referencias externas | Retirado export. Función async y revelado/foco intactos |
| FieldError | Declaración y tres usos JSX internos: FormField, FormFieldGroup y portal de FormFeedbackBindings; cero referencias externas | Retirado export. Renderizado, IDs y mensajes intactos |
| FieldErrorValue | Sin import directo externo; tipo de valores de FieldErrors y parámetros de fieldErrorMessages/updateFieldError | Conservado exportado: vocabulario del contrato compartido de errores. Retirar acceso por nombre no aporta una necesidad demostrada |
| PhotoFailure | Sin import directo externo; rama de PhotoPreparationResult y tipo de fieldErrors/constructor de PhotoMutationError | Conservado exportado: expresa el contrato de fallo de fotos, consumido indirectamente por diálogo/editor y manejo de excepciones |
| PhotoResult | Sin import directo externo; retorno de checkedPhotoResult, usado por PhotoDialog mediante inferencia | Conservado exportado: unión legítima preparación/persistencia de una función pública. No se restringe su acceso por nombre solo porque hoy se infiere |
| ReportStatus | Sin import directo externo; payload de ReportSaveResult y parámetro de reportConfirmation | Conservado exportado: contrato de estados del informe compartido entre servicio/acción/página; no se cambia esa API de tipos |
| RegistrationField | Sin import directo externo; RegistrationActionResult y errores/retornos de validadores públicos | Conservado exportado: conjunto de campos del contrato público/privado y sus validadores compartidos |

Conservar esos cinco tipos es una decisión deliberada de compatibilidad, **no cinco tareas de eliminación pendientes**. Pueden hacerse internos técnicamente sin cambiar el JavaScript emitido, pero los nombres participan en firmas exportadas y no se ha establecido una necesidad para restringirlos. El inventario local no demuestra ausencia de consumidores externos de una interfaz. No se añadieron casts, alias duplicados ni contratos alternativos.

Se preservan updateFieldError y su export, PhotoDialogProps (incluido su consumidor de tipos), las nueve rutas/módulos de compatibilidad, todas las firmas públicas de operaciones, payloads, redirects y acciones. La revisión de compatibilidad publicada sigue siendo R2, con sus condiciones de retiro existentes. No se eliminaron pruebas, snapshots, funciones ni ramas de formularios largos. No se simplificó ActionModal (etapa 3).

## Equivalencia y verificación ejecutada

Comparación textual exacta antes/después: form-feedback.tsx coincide íntegramente tras omitir únicamente dos modificadores `export`; la página coincide íntegramente tras omitir únicamente el import señalado. No cambiaron firmas de las funciones, cuerpos, JSX, contexto, portales, hooks, IDs ni asociaciones ARIA. Los usos internos permanecen en el AST posterior. Sin nuevas dependencias ni cambios de lógica, estilos o composición.

Node **26.13.1**, npm **11.7.0**, runtime temporal oficial; SHA256 del archivo Node: `aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735`. Entornos limpios sin dotenv del proyecto.

| Comprobación | Resultado |
| --- | --- |
| `npm run ci:typecheck` | Typegen y TypeScript en copia limpia aprobados; incluye fixtures de contratos existentes, como PhotoDialogProps |
| `npm run test:unit:coverage` | 107 aprobadas. Feedback, resultados, fotos, informes, entradas y navegación incluidos. 39 módulos declarados: líneas 100 %, ramas 96,77 %, funciones 99,56 %; no cobertura global ni de React |
| `npm run test:contracts` | Auditores de fronteras/autorización, delegaciones y contratos externos simulados aprobados; compatibilidad conservada |
| `npm run lint` | 354 archivos, sin cambios automáticos ni errores |
| `npm run format:check` | Aprobado en el alcance configurado; no equivale a formatear todos los archivos del repositorio |
| `npm run test:security:build` | Webpack en copia aislada aprobado; HTTP/cabeceras/Auth.js/cron no autorizado y rechazo de import DB desde cliente. Sin base de aplicación ni proveedores |
| Inventario posterior y `git diff --check` | Sin referencias/imports/reexports rotos; solo las dos funciones pasan de exportadas a internas |

No se ejecutó CUA nueva: no cambió la composición del feedback ni el comportamiento de foco/campos/ARIA. La igualdad de código no se presenta como prueba visual ni como verificación de lectores o dispositivos físicos. Se conserva la evidencia visual histórica y sus límites. No se necesitó PostgreSQL ni integración SQL: no se modificaron operaciones de negocio o persistencia. No hubo migraciones, envíos, cargas, acceso a beta/proveedores ni activación de workflows.

El inventario y runtime temporales y las copias de las comprobaciones se retiraron. La matriz CUA completa, CI remota, retiro de compatibilidad y etapa 3 mantienen su seguimiento independiente.

## Auditoría posterior de la implementación

16 de noviembre de 2026. Se volvió a leer AGENTS, auditoría de utilidades, implementación y diff completo (incluido este documento inicialmente sin seguimiento). **Sin hallazgos funcionales que requieran corrección.** Esta revisión solo agrega documentación y evidencia; no modifica nuevamente código ni pruebas.

Se repitió el inventario AST de los 339 archivos con el parser de Next, incluyendo identificadores JSX, imports con alias, reexports, namespaces, require e imports dinámicos. No hay consumidores externos de los siete candidatos. Los 153 imports dinámicos tienen destino literal salvo el test de aislamiento `import(module)`, cuya lista explícita no contiene estos módulos. No hay reexports, namespaces ni require de los módulos candidatos. Es análisis sintáctico del repositorio, complementado por tipos/build, no garantía sobre integraciones externas desconocidas.

La comparación con ac50b645f1be8e0bf4bc9927dffc558c4faa7aa3 verifica:

- El archivo de feedback completo es idéntico al original salvo dos palabras `export`. focusFormField conserva declaración/call en líneas 18/46; FieldError conserva declaración y tres composiciones JSX en líneas 86/102/120/145. No cambiaron revelado, fallback de foco, hook, renderizado de mensajes, IDs, ARIA o portales.
- El detalle de salida es idéntico salvo la eliminación del import ActionModal. No se retira el componente ni se altera su lógica de feedback.
- **No se privatizó ningún tipo**. FieldErrorValue, PhotoFailure, PhotoResult, ReportStatus y RegistrationField y sus firmas/contratos completos siguen idénticos. Son decisiones conservadas de la tabla anterior, no deuda que obligue a retirarlos.
- lib/form-result.ts y app/coordinacion/photo-dialog.tsx son idénticos, incluidas las exportaciones de updateFieldError y PhotoDialogProps y sus consumidores de pruebas.
- Los nueve módulos de compatibilidad son idénticos: app/staff-actions.ts; add-registration-actions.ts, edit-registration-actions.ts, manage-registration-actions.ts, registration-detail-actions.ts, attendance-actions.ts y report-reminder-actions.ts bajo app/coordinacion; app/coordinacion/salidas/[id]/resumen/actions.ts; app/resumen-salida/[token]/informe/actions.ts.
- El diff de tests frente a la base está vacío: no se eliminaron ni debilitaron pruebas/snapshots. Tampoco hay cambios en lib o app/actions. No se añadieron any, casts, tipos, contratos ni dependencias; el único arco de imports modificado se elimina, por lo que esta etapa no introduce ciclos nuevos. Esto no declara inexistentes todos los ciclos históricos del proyecto.

### Comprobaciones repetidas en esta auditoría

Node 26.13.1/npm 11.7.0 y archivo oficial con el mismo SHA256 registrado arriba. Entornos limpios, sin dotenv ni credenciales. Volvieron a pasar:

1. `npm run ci:typecheck`: typegen y TypeScript en copia limpia, con fixtures de tipos activos.
2. `npm run test:unit:coverage`: 107 aprobadas, cero fallos; mismos 39 módulos y cobertura 100 % líneas / 96,77 % ramas / 99,56 % funciones, sin extrapolar a React o a toda la plataforma.
3. `npm run test:contracts`: auditores funcionales y de autorización, compatibilidad y contratos Auth.js/correo simulados.
4. `npm run lint`: 354 archivos, sin correcciones automáticas. `npm run format:check` en su alcance configurado y `git diff --check`.
5. `npm run test:security:build`: compilación Webpack aislada, HTTP/cabeceras/Auth.js, cron no autorizado y rechazo de DB importada desde cliente. Copia temporal retirada, sin conexiones a una base de aplicación ni proveedores.

No corresponde repetir CUA bajo el criterio de esta etapa: no hubo cambios de composición, cuerpos, atributos ni rutas de foco. La equivalencia textual/AST y el build no se presentan como una nueva prueba visual, de lectores de pantalla o de dispositivos físicos. No se ejecutó integración SQL ni PostgreSQL porque no hay modificación de persistencia o reglas de negocio. Los pendientes visuales, CI remota, etapa 3 y retiro de compatibilidad conservan su alcance; ninguno se marca completo por esta revisión. Runtime e inventario temporales retirados. Sin publicación, beta, migraciones, envíos, cargas ni workflows.
