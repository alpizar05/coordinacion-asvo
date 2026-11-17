# Matriz visual de consumidores de Coordinación

17 de noviembre de 2026. **Auditoría de cierre realizada; ejecución integral todavía pendiente.** [Cierre, cobertura y riesgos](cierre-matriz-visual.md): 349 V, 478 P, 204 N y 1 B. Se revisaron las 1032 celdas y se reclasificaron 41 aprobaciones demasiado amplias. Se preserva el diff local. Registro/Administración, convocatorias/series/fotos e inscripciones/comunicaciones/70 incorporan CUA y PostgreSQL desechable con proveedores simulados. Sin beta, proveedores reales, publicación ni GitHub; las correcciones funcionales previas se distinguen de la ejecución de convocatorias, que no modificó código funcional.

## Alcance y criterio de lectura

La unidad de cobertura es **recorrido + consumidor + composición de ruta + viewport + estado**. Una prueba de ActionModal no completa Corregir ficha; probar RegistrationActions en un harness real tampoco completa sus tres páginas autenticadas. El informe privado del 70 se incluye como frontera asociada a Coordinación; el catálogo y las inscripciones públicas/privadas requieren su matriz propia, salvo comparación visual de referencia.

La [matriz detallada JSON](matriz-visual-consumidores.json) contiene cada celda, razón, ruta, datos, permisos y dimensiones. Esta página es su índice legible. Desktop **1440×900**, celular emulado **390×844**; ampliar a 320px/zoom cuando se ejecute distribución, sin atribuir esa cobertura al viewport base. La preparación inicial no creó fixtures; la ejecución local de registro/Administración se documenta en el informe enlazado abajo.

Estados exclusivos:

- **pendiente (P):** falta evidencia suficiente del alcance exacto o debe repetirse por cambios posteriores.
- **verificada (V):** evidencia identificable para la afirmación limitada, fecha, método y revisión de código. Nunca significa accesibilidad integral.
- **fallo reproducido (F):** defecto vigente demostrado; conservar captura y pasos. La auditoría de cierre reprodujo y corrigió la pérdida de captura por Escape pendiente; evidencia anterior/posterior en el informe. No quedan celdas F vigentes por ese caso.
- **bloqueada (B):** ejecución intentada impedida por un obstáculo concreto, con causa y siguiente paso. No usar por la mera decisión de no ejecutar esta etapa.
- **no aplicable (N):** requisito ajeno al recorrido, con razón por celda. No significa prueba aprobada.

No se usa “parcial” como aprobación: una celda amplia con apoyo parcial permanece P. No se trasladan automáticamente aprobaciones de un viewport, rol, estado o recorrido a otro.

## Cuatro niveles independientes de evidencia

| Nivel | Qué demuestra | Estado y alcance de la evidencia |
| --- | --- | --- |
| S: inspección estática | Consumidor presente, composición, guardas y pruebas localizadas | V para el inventario; no demuestra interacción ni autorización efectiva |
| H: harness compartido | Contrato/interacción de contenedor, con hijos ficticios | Evidencia histórica acotada, registro abajo; no completa consumidores |
| C: consumidor real + servicios simulados | UI real y validación cliente, respuesta ficticia | Evidencia histórica y cierre local, cada consumidor/viewport identificado |
| L: flujo con persistencia local ficticia | UI + SQL real + efectos simulados, en una misma ejecución | Ver ejecuciones por familia y celda; integración SQL sin navegador es evidencia funcional separada |

La preparación inicial registró S y P/N. Ahora M15/M32–M35/M37–M39 incorporan verificaciones C/L con evidencia por celda; conservan explícitos los pendientes. Las afirmaciones históricas H/C/L se conservan en el registro siguiente y no se borran ni se convierten en verificaciones actuales de todas las rutas.

La [ejecución de convocatorias, series y fotografías](matriz-visual-convocatorias-series-fotos.md) añade 164 observaciones, 111 capturas y persistencia local con Graph simulado a M06/M07/M18–M30. En esas 360 celdas amplias: **147 V, 126 P, 86 N y 1 B**. M18 conserva P global porque las tres acciones verificadas no completan la decisión de agrupación; M26 es N por composición inalcanzable, no por eliminación del contrato. No se transfieren aprobaciones entre variantes. Los hashes nuevos están en `fuentes_convocatorias_20261117`.

## Registro de evidencia y vigencia

Revisión actual: `HEAD 3e0a187332414203201a53092acada85723abee3` **más cambios locales no publicados**. El JSON fija SHA256 de consumidores y dependencias críticas revisadas hoy; no inventa un commit para el diff. Los registros anteriores no siempre fijaron hashes completos: su equivalencia exacta debe comprobarse antes de reutilizar un resultado. Cualquier cambio posterior al archivo o a su dependencia requiere analizar/repetir las celdas afectadas.

| ID / fecha / método | Afirmación verificada y evidencia | Vigencia y repetición necesaria |
| --- | --- | --- |
| H01 · 16/11 · S + CUA/H | [Auditoría UI/UX](auditoria-uiux-coordinacion.md), inventario y mediciones en docs/evidencia-uiux | Baseline histórica. Amarillo de PhotoDialog y foco BODY son hallazgos corregidos después, no defectos actuales abiertos. Repetir apariencia antigua carece de valor |
| H02 · 16–17/11 · CUA/H | [Fotos](actualizacion-modal-fotos.md); tests/photo-dialog/browser-results.json y audit-20261117-results.json. Galería/subida, campos/archivo, pending y reintento | V solo de PhotoDialog compartido con callbacks simulados. No sus cinco usos autenticados ni persistencia. Recuperación de subida desktop del 17/11 quedó incompleta por pérdida de pestaña; P para esa repetición |
| H03 · 16/11 · CUA/H/C | [Paneles](revision-modales-paneles.md), tests/coordination-panels/verified-results.json | Solo 13 observaciones corregidas para conclusiones finales; browser-results inicial contiene capturas obsoletas. Componentes de filtros/unidades/póliza no equivalen a sus páginas completas |
| H04 · 17/11 · CUA/H + medición | [Contraste](contraste-controles-coordinacion.md), tests/control-contrast/measurements.json y ratios.json | V para controles/superficies medidos: bordes normales 4,89:1 en blanco. 510 lecturas no son 510 controles únicos. No cubre glifos nativos ni todos los consumidores |
| C01 · 16/11 · CUA/C | [Agregar/Editar](auditoria-agregar-editar-inscripcion.md), tests/staff-registration-results/browser-audit-results.json | V de datos, errores, doble clic y respuestas en lista sintética con proveedor real. Repetir posición/foco después del cambio del restaurador del 17/11; Escape pending edición del 16/11 no certificó timing |
| C02 · 17/11 · CUA/C | [Foco Gestionar](auditoria-foco-gestionar.md), tests/manage-focus/results.json, capturas y verify-results.mjs | V limitada a confirmada, cancelación/detalle/edición/recordatorio y series automática/manual del harness real. Usar *-stable y after-fix-*; no lecturas transitorias ni éxitos sin fila origen. No todos los estados/roles/rutas |
| H05 · 16/11 · CUA/H | [ActionModal](feedback-action-modal.md), tests/action-modal/browser-results-stage3-audit.json | V histórica de cuatro modos, errores/archivo/reintento; repetir interacciones afectadas por CoordinationModal/CSS posteriores. No certifica cada consumidor |
| L01 · 12/11 · navegador + demo local | [Navegación](auditoria-contexto-navegacion.md), tests/navigation/browser-results.json | Evidencia histórica real de recorridos/listas y desaparición/vacío; no toda UI de formularios. Repetir foco/posición por navigation-position.ts del 17/11; conservar las demás comprobaciones como antecedentes |

Las siete pruebas DOM de tests/manage-focus/restore-focus.test.mjs no son CUA ni pruebas unitarias puras; las suites SQL de Agregar/Editar verifican transacciones por separado. Ni unas ni otras convierten un éxito UI simulado en persistencia confirmada. Un error de respuesta posterior al commit puede haber guardado; no prometer ausencia absoluta de efectos o entrega exactamente una vez.

## Inventario por recorrido

Roles: **A** Administración, **CG** Coordinación general, **CU(U1)** coordinación de la unidad del recurso. A sola no hereda operación de salidas. Autoridad: [políticas verificables](autorizacion.md), lib/authorization.ts y guardas de cada consumidor. La ficha muestra Actualizar unidades con `coordinates`; el permiso servidor también contempla A, diferencia de visibilidad a comprobar sin cambiar permisos en esta tarea. Las asignaciones son siempre ficticias, no Entra real.

El JSON explicita además las variantes de decisiones: confirmar, espera, rechazar/cancelar con motivo, recuperación histórica y asignar/quitar 70 cuando corresponde. No basta recorrer solamente Cancelar.

En todas las filas ejecutar ambos viewports. **P** es ejecución de ruta pendiente; el JSON desglosa las doce celdas y sus N justificadas. No se requieren errores por campo artificiales para copiar, navegar o acciones sin campos.

| ID | Recorrido / ruta | Consumidor | Acceso | Datos mínimos | Prioridad | Desktop / celular (cobertura completa) |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | Menú global: abrir, navegar y cerrar sesión<br>`/coordinacion/*` | `coordination-nav.tsx` | Sesión; opciones según concesiones | general, unidad U1 y admin separados | 3 | P / P |
| M02 | Resumen: filtros y selector de Requiere atención<br>`/coordinacion` | `summary-filters.tsx` | CG/CU(U1) | tres bandejas, periodos 7/14/30, vacío | 3 | P / P |
| M03 | Resumen: Gestionar inscripción y volver al origen<br>`/coordinacion` | `page.tsx` | CG/CU(U1) | revisión, confirmada, espera y canceladas | 1 | P / P |
| M04 | Resumen: recordatorio con/sin enlace del 70<br>`/coordinacion` | `report-reminder.tsx` | CG/CU(U1) | 70 confirmado; enlace activo/ausente; informe pendiente | 2 | P / P |
| M05 | Convocatorias: filtros, orden y detalle/regreso<br>`/coordinacion/convocatorias` | `outings-table.tsx` | CG/CU(U1) | salidas U1/U2, vacíos y fila eliminada | 3 | P / P |
| M06 | Series: filtros, Gestionar automática, copiar y enlaces<br>`/coordinacion/convocatorias` | `collections-table.tsx` | CG/CU con bloques autorizados | serie automática dos bloques U1 | 2 | P / P |
| M07 | Series: Gestionar manual, copiar y enlaces<br>`/coordinacion/convocatorias` | `collections-table.tsx` | CG/CU propietario | serie manual propia/ajena; salidas U1/U2 | 2 | P / P |
| M08 | Solicitudes: filtros por estado/unidad/fechas y retorno<br>`/coordinacion/inscripciones` | `inscripciones/status-filter.tsx` | CG/CU(U1) | rango invertido, intersección y lista vacía | 2 | P / P |
| M09 | Solicitudes: decisiones, detalle, historial, editar y recordatorio<br>`/coordinacion/inscripciones` | `registration-actions.tsx` | CG/CU(U1) | todos los estados admitidos, otra unidad, versión obsoleta | 1 | P / P |
| M10 | Salida: filtros y Gestionar en Inscripciones<br>`/coordinacion/salidas/[id]` | `registration-actions.tsx` | CG/CU(U1) | fijas/flexibles, confirmada/espera/cancelada, varios 70 | 1 | P / P |
| M11 | Salida: agregar persona y alta revisión/espera<br>`/coordinacion/salidas/[id]` | `add-registration.tsx` | CG/CU(U1) | persona 9 dígitos, póliza válida/insuficiente, cupo lleno | 1 | P / P |
| M12 | Salida: editar inscripción sin cambiar su estado<br>`/coordinacion/salidas/[id]` | `edit-registration.tsx` | CG/CU(U1) | fechas, transporte 0/límite, observaciones y versión obsoleta | 1 | P / P |
| M13 | Salida: transporte → persona → desglose<br>`/coordinacion/salidas/[id]` | `transport-summary.tsx` | CG/CU(U1) | conductores/no conductores, siguiente fila y vacío | 2 | P / P |
| M14 | Salida: alimentación → persona → desglose<br>`/coordinacion/salidas/[id]` | `food-summary.tsx` | CG/CU(U1) | restricciones exclusivamente ficticias, fila desaparece | 2 | P / P |
| M15 | Salida: conciliación de asistencia<br>`/coordinacion/salidas/[id]` | `attendance-reconciliation.tsx` | CG/CU(U1), estado permitido | dos informes contradictorios, resolución previa/versiones | 1 | P / P |
| M16 | Salida: invitación privada, copiar y fallo<br>`/coordinacion/salidas/[id]` | `salidas/[id]/outing-invitation.tsx` | CG/CU(U1) | salida fuera de plazo, invitación local ficticia | 2 | P / P |
| M17 | Salida: separar agrupación flexible<br>`/coordinacion/salidas/[id]` | `split-group-form.tsx` | CG/CU(U1), abierta/confirmada | grupo coincidente y modificado, título/cupo inválidos | 1 | P / P |
| M18 | Salida: completar/cancelar/eliminar/decisión agrupación<br>`/coordinacion/salidas/[id]` | `outing-decision-form.tsx` | CG/CU(U1), precondición por acción | pasada/futura; con/sin inscripciones; motivo vacío | 1 | P / P |
| M19 | Salida: destacar/quitar destacada<br>`/coordinacion/salidas/[id]` | `homepage-feature-control.tsx` | CG/CU(U1) | pública abierta vigente, vencida y privada | 2 | P / P |
| M20 | Nueva salida: secciones, periodos, vinculación y publicar local<br>`/coordinacion/salidas/nueva` | `salidas/nueva/new-outing-form.tsx` | CG/CU(U1) | dos periodos, solicitud nueva/existente, logística | 1 | P / P |
| M21 | Nuevo bloque: clonar y conservar serie<br>`/coordinacion/salidas/nueva?bloque=[id]` | `salidas/nueva/new-outing-form.tsx` | CG/CU(U1), bloque fuente autorizado | fuente con fotos, fechas y herencia | 1 | P / P |
| M22 | Editar salida individual: edición directa y descarte<br>`/coordinacion/salidas/[id]?editar=1` | `salidas/[id]/outing-editor.tsx` | CG/CU(U1) | individual sin Personalizar; versión y campos inválidos | 1 | P / P |
| M23 | Editar bloque: herencia y personalización<br>`/coordinacion/salidas/[id]?editar=1` | `salidas/[id]/outing-editor.tsx` | CG/CU(U1) | bloque hereda; campos/fotos personalizados | 1 | P / P |
| M24 | Fotos de nueva salida: agregar/editar preparada<br>`/coordinacion/salidas/nueva` | `salidas/nueva/new-outing-form.tsx` | CG/CU(U1), fuente de galería permitida | galería, PNG válido/inválido; 0/5/6 fotos, crédito/permiso | 1 | P / P |
| M25 | Fotos del editor: agregar/editar preparada<br>`/coordinacion/salidas/[id]?editar=1` | `salidas/[id]/outing-editor.tsx` | CG/CU(U1), fuente de galería permitida | individual y serie; archivo + metadatos; límite conjunto | 1 | P / P |
| M26 | Fotos: consumidor legado inalcanzable en esta composición<br>`/coordinacion/salidas/[id]?editar=1` | `salidas/[id]/attach-photos.tsx` | Contrato conservado; persistencia activa en M25 | Sus montajes exigen editing dentro de information, que se muestra solo !editing | 1 | N / N (inspección S, no prueba visual) |
| M27 | Serie automática: datos comunes, alcance y descarte<br>`/coordinacion/colecciones/automaticas/[id]` | `colecciones/automaticas/[id]/collection-editor.tsx` | CG/CU si gestiona todos los bloques y destino | bloques heredados/personalizados y selección explícita | 1 | P / P |
| M28 | Serie automática: bloques, enlace a nuevo bloque y destacada<br>`/coordinacion/colecciones/automaticas/[id]` | `colecciones/automaticas/[id]/page.tsx` | CG/CU según bloques; destacar exige todos | bloques U1/U2, vigencia, vuelta a lista | 2 | P / P |
| M29 | Crear serie manual: filtros, selección y guardado<br>`/coordinacion/colecciones/nueva` | `colecciones/nueva/collection-form.tsx` | CG/CU, todas las seleccionadas autorizadas | selección vacía, varias salidas y error de nombre | 1 | P / P |
| M30 | Serie manual: consultar salidas y regreso<br>`/coordinacion/colecciones/manuales/[id]` | `colecciones/manuales/[id]/page.tsx` | CG/CU propietario | serie propia/ajena y sin miembros visibles | 2 | P / P |
| M31 | Voluntariado: buscar, filtrar, paginar y regresar<br>`/coordinacion/registro` | `registro/volunteer-filters.tsx` | A/CG; CU solo denegado | 28 personas ficticias, última página vacía | 2 | P / P |
| M32 | Persona: corregir ficha<br>`/coordinacion/registro/[id]` | `registro/profile-editor.tsx` | A; CG sin admin denegado | identificación duplicada, errores múltiples y versión | 1 | P / P |
| M33 | Persona: actualizar unidades<br>`/coordinacion/registro/[id]` | `registro/volunteer-units.tsx` | CG (botón actual); probar A según servidor/visibilidad | General obligatorio, U1/U2; selección conservada | 1 | P / P |
| M34 | Persona: verificar póliza<br>`/coordinacion/registro/[id]` | `registro/[id]/page.tsx` | A | cobertura invertida, número y tipo; campos múltiples | 1 | P / P |
| M35 | Persona: registrar incidente y vínculo a salida<br>`/coordinacion/registro/[id]` | `registro/[id]/page.tsx` | CG | incidente general/vinculado y campos vacíos | 1 | P / P |
| M36 | Persona: trayectoria, participación y conciliación/regreso<br>`/coordinacion/registro/[id]` | `registro/[id]/page.tsx` | A/CG para ficha; operación de salida según unidad | participaciones con/sin evidencia y sección activa | 2 | P / P |
| M37 | Administración: asignar/revocar permisos<br>`/coordinacion/administracion` | `administracion/page.tsx` | A | UUID ficticio, unidad faltante, revocar propio admin | 1 | P / P |
| M38 | Administración: CSV voluntariado, previsualizar/confirmar<br>`/coordinacion/administracion` | `registro/importer.tsx` | A | CSV válido/inválido, fila/columna, duplicados, reintento | 1 | P / P |
| M39 | Administración: CSV pólizas, previsualizar/confirmar<br>`/coordinacion/administracion` | `registro/importer.tsx` | A | CSV de cobertura, persona no encontrada, filas inválidas | 1 | P / P |
| M40 | Informes: filtros, informe/responsable/salida y regreso<br>`/coordinacion/informes` | `informes/page.tsx` | CG/CU(U1) | borrador/finalizado, rango invertido y vacío | 2 | P / P |
| M41 | Resumen de salida: generar/revocar/copiar enlace del 70<br>`/coordinacion/salidas/[id]/resumen` | `salidas/[id]/resumen/share-brief.tsx` | CG/CU(U1), 70 confirmado asignado | varios 70, sin responsable, enlace vencido/revocado | 1 | P / P |
| M42 | Resumen: consultar informes en desglose<br>`/coordinacion/salidas/[id]/resumen` | `salidas/[id]/resumen/page.tsx` | CG/CU(U1) | varios informes, seleccionado y ausencia de informe | 2 | P / P |
| M43 | 70: informe por enlace, borrador/finalizar<br>`/resumen-salida/[token]/informe` | `../resumen-salida/[token]/informe/report-form.tsx` | Capacidad privada vigente, no rol de Coordinación | token solo local; incompleto, finalizado, asistencia real ficticia | 1 | P / P |


## Guion de ejecución de cada fila

1. Verificar destino local desechable antes de cualquier futura escritura; sesión ficticia CG, CU(U1) o A según fila. Usar UUID y personas ficticias, identificación de nueve dígitos, destinatarios .test y dobles de Graph/correo. Probar otra unidad/rol insuficiente sin alterar concesiones reales.
2. Abrir desde su origen real, registrar URL/criterios sin tokens, viewport, scroll, disparador y elemento enfocado. Abrir/cerrar limpio, Tab/Shift+Tab/Enter/Escape y descarte; comprobar foco al origen o fallback si desaparece. Menú desktop sin X y panel móvil con X; no inventar pasos para series.
3. Generar errores independientes y generales juntos si hay campos; verificar resumen navegable, aria-invalid/describedby únicos y sección revelada. Corregir un campo sin borrar los otros errores. Recoger AX como inspección, nunca como lectura hablada.
4. Demorar la respuesta simulada: doble clic, cambio de pestaña, Escape/cierre y controles. Error/rechazo: modal abierto, selección/datos/File/metadatos conservados y recuperación. Reintentar explícitamente, sin envío automático. Diferenciar preparación `{prepared:true}` de persistencia y de fallo posterior al commit.
5. Éxito válido: confirmación temporal solo entonces, cierre/refresh adecuados y contexto conservado. Comprobar pestaña, filtros, desplazamiento y regreso multinivel. Si desaparece una fila, probar vecina/lista vacía; no inventar paginación en tablas sin ella. Para crear/menú/breadcrumb y enlaces públicos mantener navegación habitual.
6. Formularios largos: varias secciones, último error, header/footer fijos, archivos, borrador incompleto frente a finalizar. En informe finalizado no habilitar edición ni acreditar asistencia desde borrador.
7. Registrar evidencia y limpiar fixtures de esa ejecución. Sin enlaces privados/tokens, nombres reales, restricciones reales o contenido médico en capturas/logs/documentos.

### Registro obligatorio para cerrar una celda

`ID + viewport + criterio + variante/rol/estado → estado, fecha, revisión (commit + diff/hash), método S/H/C/L, evidencia relativa, resultado observado y límites`.

Para V indicar la aserción exacta y captura/observación; para F, pasos, esperado/observado y defecto; para B, obstáculo y desbloqueo; para N, justificación. No sustituir resultados originales ni borrar fallos del harness: excluirlos con motivo y enlazar la repetición válida. Marcar familia completa solo cuando sus filas/variantes aplicables estén verificadas, no por porcentaje agregado.

## Matrices independientes (sin aprobación implícita)

| Matriz | Cobertura y condiciones | Estado / evidencia |
| --- | --- | --- |
| Lectores hablados | VoiceOver/Safari y NVDA/Firefox o Chrome, versiones registradas; título/rol, errores, resumen, cambio de paso, pending y retorno | P. AX/DOM de C02 no demuestra anuncio hablado; requiere sesión específica |
| Dispositivos físicos | iOS/Safari y Android/Chrome: teclado virtual, viewport dinámico, orientación, scroll y selector de archivos | P. 390×844 en IAB es emulación de tamaño |
| Otros navegadores | Chrome, Edge, Firefox y Safari con versiones; dialog, foco nativo, Tab en límites, upload, clipboard | P. Historial CUA IAB no identifica automáticamente equivalencia de motores |
| Accesibilidad visual extendida | 320px, zoom 200/400 %, forced-colors, controles nativos, foco/contraste de superficies restantes | P. UX03 conserva aprobación acotada, no certificación global |
| Infraestructura | CI remota, runtime real, permisos proveedores, correo/cola, SharePoint y red | P; fuera de esta tarea, sin consultar proveedores. CI local y dobles no acreditan configuración desplegada |

## Orden recomendado por riesgo

1. **Escrituras sensibles y alto impacto:** M09–M12, M15, M17–M18, M32–M39 y M43. Datos, permisos, concurrencia y errores; Agregar/Editar/Gestionar parten de evidencia C existente, pero completar composición real y estados. Importaciones exigen preview sin escrituras y confirmación, nunca aplicar filas inválidas.
2. **Formularios largos, fotos y series:** M20–M29 y M41. Preparación/persistencia, herencia, alcance común, compensación simulada, enlaces requeridos y recuperación de archivos. No ejecutar Graph real.
3. **Navegación y comunicaciones visibles:** M02–M08, M13–M14, M16, M19, M28, M30–M31, M36, M40–M42. Repetir en especial L01 tras cambio del foco; recordatorios con envío simulado y referencia de plantilla, no entrega real.
4. **Regresión transversal y matrices independientes:** M01, teclados/foco de todos los anteriores, contraste restante, lector hablado/dispositivos/motores. Programarlas explícitamente; una familia no cierra esos controles institucionales ni CI remota.

Los niveles 1–3 se pueden ejecutar por familia acotada. Comenzar por ruta de salida con alta/edición/decisiones, luego Administración y asistencia/informe; no iniciar una reescritura visual general. Fijar hashes antes de ejecutar evita confundir evidencia histórica con el nuevo diff.

## Comprobaciones de esta preparación

Inspección de AGENTS, README/TODO, auditorías de UI/UX/fotos/paneles/contraste/foco, autorización y navegación, consumidores y registros existentes. Validación local del JSON, rutas de fuentes y enlaces de evidencia; revisión del diff documental. No se ejecutaron nuevas suites funcionales, compilación ni navegador: solo se agregan documentos y seguimiento. No se marcaron completas pruebas visuales, lectores, infraestructura o publicaciones pendientes.

## Ejecución local de registro y Administración

La [verificación de ocho recorridos en desktop y celular](matriz-visual-registro-administracion.md) agrega evidencia nueva de rutas y servicios reales, con respuestas de fallo simuladas antes de persistir. Incluye correcciones de CSV multipart y navegación de etapas; no cierra el resto de consumidores, historial extendido, lectores, dispositivos ni runtime PostgreSQL 18.7. Las celdas JSON son la autoridad del estado, no la tabla inicial P/P.

## Ejecución de inscripciones, comunicaciones y 70 — 17/11

[Informe y límites por consumidor](matriz-visual-inscripciones-comunicaciones-70.md): 393 observaciones, 323 capturas y ocho grupos SQL locales. Altas/ediciones, decisiones y 70, agrupación, enlaces/invitaciones, recordatorios, Logística multinivel e informe borrador/final. Se corrigieron dos fallos reproducidos de frontera de agrupación y captura de posición ante doble clic. JSON incorpora evidencia por celda; los criterios amplios no recorridos conservan P. No se completan historia nativa exhaustiva, M42, otros roles visuales, lectores/dispositivos ni PostgreSQL 18.7.

## Cierre de auditoría — 17/11/2026

[Informe final](cierre-matriz-visual.md): revisión de todas las celdas, trazabilidad por ruta/viewport/rol, 40 celdas de distribución y una apertura de clonado devueltas a P, sin promover pendientes o bloqueadas. Nueva CUA de 92 observaciones/57 capturas y PostgreSQL 18.7; Escape durante pending conserva ahora el origen cuando no puede cerrar la operación. Types/lint/formato, 108 unitarias, ocho controles CI, contratos, 24 grupos SQL, 12 regresiones de efectos, siete DOM y siete controles de evidencia correctos. Fixtures retirados; sin publicación.

Los balances de cada etapa anterior son históricos, no el total vigente: consultar JSON/cierre. Las aprobaciones conservan su afirmación acotada y rol realmente observado. Contextos completos, otras variantes y matrices externas siguen pendientes.
