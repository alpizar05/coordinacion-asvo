# Cierre de auditoría de la matriz visual de consumidores

17 de noviembre de 2026. Revisión `3e0a187332414203201a53092acada85723abee3` más el diff local conservado. **Se cierra esta auditoría; no la ejecución total de la matriz.** No se publicó, desplegó, subió a GitHub ni activaron workflows. Solo datos ficticios, tres clústeres locales desechables y proveedores simulados.

## Resultado de la revisión de todas las celdas

Se revisaron las **1032 celdas** de 43 recorridos, dos viewports y doce criterios. Las 390 aprobaciones iniciales tenían archivos y metadatos, pero eso no bastaba para acreditar todo lo que decía su criterio.

| Estado | Antes | Después |
| --- | ---: | ---: |
| Verificada, afirmación acotada | 390 | **349** |
| Pendiente | 437 | **478** |
| No aplicable | 204 | **204** |
| Bloqueada | 1 | **1** |

No se promovió ninguna celda pendiente, bloqueada o N. Se conservó el contenido anterior de cada aprobación reclasificada en `aprobacion_anterior`.

**40 celdas de distribución vuelven a P:** las capturas y medidas de desbordamiento sí sirven, pero no acreditan todas las señales de contraste/estados y visibilidad del campo frente a encabezados/pies incluidos en ese criterio amplio. La muestra UX03 sigue siendo evidencia válida de sus pares medidos; no completa los demás controles por analogía.

**M21 desktop/apertura-cierre vuelve a P:** el propio informe distingue una primera apertura transitoria/destino directo de una segunda apertura con descarte. No demuestra el recorrido completo de apertura/teclado de la celda. Se conservan las comprobaciones de clonado, errores y guardado que sí tienen evidencia.

Las **349 aprobaciones retenidas** ahora tienen referencias por consumidor y viewport en [review.json](../tests/visual-close/review.json), además de las evidencias originales. Se retiraron 223 referencias candidatas repetidas cuyo prefijo coincidía pero pertenecían a otra ruta/viewport; son referencias repetidas, **no 223 defectos ni 223 observaciones únicas**. Ejemplo: `desktop-block-*` puede referirse tanto a clonar como a editar un bloque. Ninguna aprobación quedó sin observaciones de su ruta/tamaño correspondiente.

Cada V explicita el rol CUA observado: Administración, Coordinación general/unidad General o capacidad privada ficticia. No se extiende a todos los coordinadores de unidad por tener integración de autorización. Los otros roles/variantes pendientes siguen abiertos. La referencia estática de N, incluido AttachPhotos inalcanzable en esa composición, no equivale a una prueba visual ni autoriza retirar contratos.

[Auditoría completa por celda](../tests/visual-close/audit.json), [snapshot anterior](../tests/visual-close/matrix-before.json), [decisiones](../tests/visual-close/review.json) y [matriz vigente](matriz-visual-consumidores.json).

## Cobertura por familia y viewport

V/P/N/B son **celdas**, no cantidad de pruebas ni porcentaje de accesibilidad. Una P puede tener apoyo parcial valioso y seguir pendiente del criterio completo. La familia solo se completa al verificar todas sus variantes aplicables.

| Familia | Desktop 1440×900 — V / P / N / B | Celular 390×844 — V / P / N / B |
| --- | --- | --- |
| Navegación/listas: M01/M02/M05/M08/M31/M36/M40 | 0 / 63 / 21 / 0 | 0 / 63 / 21 / 0 |
| Inscripciones/logística: M03/M09–M15/M17 | 36 / 56 / 16 / 0 | 36 / 56 / 16 / 0 |
| Convocatorias/series/fotos: M06/M07/M18–M30 | 63 / 73 / 43 / 1 | 59 / 78 / 43 / 0 |
| Registro/Administración: M32–M35/M37–M39 | 55 / 15 / 14 / 0 | 56 / 14 / 14 / 0 |
| Comunicaciones/70: M04/M16/M41–M43 | 22 / 30 / 8 / 0 | 22 / 30 / 8 / 0 |

[Conteos reproducibles](../tests/visual-close/coverage.json). Cero V en las filas amplias de navegación **no significa que no haya recorridos probados**: sus celdas incluyen combinaciones/historia/estados vacíos todavía no ejecutados en su totalidad. Se conservaron P con evidencia parcial; no se cambió la definición del criterio para hacerlos aprobar.

## Evidencia nueva: 92 observaciones y 57 capturas

Node **26.13.1**, npm **11.7.0**, PostgreSQL **18.7**. Se activó `scripts/local-env.zsh` para pruebas y se verificó el runtime principal/hijos/npm mediante el guard y los controles CI. Clústeres nuevos en 55527/55528/55529; cada fixture comprobó su `data_directory` antes de preparar/escribir. Aplicaciones temporales 3044/3045/3046 sin dotenv ni credenciales reales. No se usó la base persistente de desarrollo ni beta.

Se reutilizaron los consumidores y flujos reales de los fixtures existentes; no se sustituyeron reglas ni políticas. Solo en las copias temporales se aumentó la demora de respuestas a **6 segundos** para observar pending antes de terminar. Graph/correo permanecieron bloqueados/simulados. Las respuestas malformadas, errores y rechazos se inyectaron **antes** del caso de uso; los intentos reales posteriores sí ejecutaron SQL.

| Componente/consumidor real | Desktop y celular: evidencia nueva | Alcance de la afirmación |
| --- | --- | --- |
| CoordinationModal + Agregar/Editar + RowActionPanel | `desktop-add-*`, `desktop-edit-*`, `mobile-manage-*`, `mobile-detail-*`, `mobile-edit-*` | Encabezados, detalle demorado, cambio de paso, traspaso a Editar, errores conjuntos, resumen a alimentación, rechazo, controles pendientes, Escape desde encabezado, descarte/seguir y retorno. Alta/edición reales separadas de respuestas incompletas |
| PhotoDialog dentro de OutingEditor | `mobile-photo-*`, `desktop-photo-*`, `desktop-prepared-photo-*` | Subida PNG ficticia, descripción/crédito, autorización, archivo retenido, pestañas deshabilitadas, error/rechazo y preparación. Desktop editó una foto **preparada**, no la variante de fotografía ya persistida. El descarte de foto desktop no tuvo resultado concluyente y permanece pendiente |
| Editor largo y resumen | `mobile-parent-*`, `mobile-long-form-summary-reveal` | Error general + título/cupo, revelado de sección y foco en cupo; la foto preparada sigue visible después del error. No se produjo un nuevo guardado de fotografías en esta ejecución |
| ActionModal/Corregir ficha con rol A | `desktop-profile-*`, `mobile-profile-*` | Enter/Tab/Shift+Tab dentro del modal, errores correo/WhatsApp, corregir WhatsApp sin borrar el error de correo, rechazo, reintento, guardado SQL, nombres vacíos móvil, descarte y regreso. No se escribieron datos médicos/emergencias |
| Restaurador + Gestionar desde Resumen | `*-summary-confirm-*`, `*-summary-fixed-*` | Defecto BODY antes del arreglo y repetición posterior en ambos tamaños con doble clic, Escape pendiente, fila que deja de coincidir y foco en la siguiente; criterios conservados |
| Logística/ContextReturnLink | `mobile-logistics-*`, `desktop-logistics-*`, `*-summary-context-restored` | Transporte móvil y alimentación desktop por separado → persona → regreso al desglose y a Resumen. Atrás/Adelante móvil sin competir con el historial nativo; regreso contextual reabre el modal/disclosure y enfoca Ana. No completa todas las variantes de historia/pestañas/recarga |
| SectionWorkspace + ReportForm real por enlace ficticio | `desktop-report-*`, `mobile-report-*` | Finalización inválida con cuatro correcciones en datos precargados; resumen revela Acciones en desktop y confirmación final móvil sin robar el foco. Borrador incompleto inicia pending, bloquea secciones en ambos tamaños y conserva datos al recibir éxito sin destino. No se creó un informe nuevo por esa respuesta simulada |

[Índice nuevo](../tests/visual-close/results.json), [observaciones AX/DOM](../tests/visual-close/observations), [capturas](../tests/visual-close/evidence), [clasificación de lecturas transitorias](../tests/visual-close/classification.json). Las capturas son muestras de IAB, no pruebas con lector hablado o dispositivo físico.

## Defecto nuevo reproducido y corregido

**Escape bloqueado durante pending invalidaba la captura de posición.** En Resumen, una confirmación con doble clic capturaba correctamente la fila al enviar. Pulsar Escape desde el encabezado no cerraba el panel porque estaba pendiente, pero el listener global de teclado borraba la captura. Tras confirmar y desaparecer la fila, el foco quedaba en BODY.

- Antes: `mobile-summary-confirmed-next-row` y `desktop-summary-before-fix-body` muestran BODY. No se presentan como éxitos.
- Cambio acotado en `app/coordinacion/navigation-context.tsx`: conservar la captura por Escape únicamente si el formulario enviado tiene un fieldset deshabilitado y el objetivo pertenece a ese formulario o a su diálogo. No se ignora Escape en otro diálogo, interacción externa o formularios no pendientes.
- Los errores siguen invalidando la captura; teclado de navegación, wheel, popstate y cambios fuera del formulario mantienen su comportamiento. No se guarda esta referencia en el almacenamiento del navegador ni se agregan tokens/datos personales.
- Después: `desktop-summary-fixed-next-row` enfoca el enlace de la siguiente fila de Desktop; `mobile-summary-fixed-next-row` hace lo mismo para Mobile. URL conserva unidad, siete días y bandeja de revisión.
- Cinco regresiones nuevas se suman a las siete del contrato/efectos existentes: Escape en formulario y encabezado pendientes, Escape no pendiente, diálogo ajeno y error antes de Escape. **12/12** correctas.
- Regresión compartida ampliada después del cambio: Resumen y Logística en ambos tamaños, Atrás/Adelante móvil y campos de ReportForm en secciones ocultas. Las capturas de fotos/ficha/errores iniciales son anteriores al último ajuste: se identifican como esa fase, no se afirman repetidas todas después. El cambio solo conserva una captura ante Escape bloqueado; las pruebas verifican que errores y otras interacciones todavía la invalidan.

No hubo otros defectos funcionales nuevos suficientemente demostrados para justificar cambios. Se preservaron los arreglos anteriores de portal/estilos de fotos, foco/descarte, pasos de Gestionar, workspace, frontera de agrupación y canonicalización CSV; no se atribuyen a este cierre.

## Persistencia confirmada y simulación

[Snapshot SQL final saneado](../tests/visual-close/persistence-final.json):

- Inscripciones: **29 registros**, uno agregado desde Coordinación y una edición; cuatro confirmaciones desde Resumen, una por intento real. Siete eventos de auditoría: Recibió inscripción, Agregó, Editó y cuatro Confirmó. Sin duplicados de salida/persona. Seis notificaciones demo; cola real **cero filas/cero sent_at**.
- Ficha: una corrección real auditada, WhatsApp ficticio `80000002` y Voluntariado General conservado. Los datos inválidos usados para descarte no se guardaron.
- Fotos: la UI preparó una segunda fotografía, el padre falló y se descartó explícitamente la preparación al salir. PostgreSQL conserva **una fotografía** en esa salida y ninguna auditoría de edición. Preparación y preview no se confundieron con persistencia.
- Informe: el éxito simulado sin destino no creó registros; `outing_reports` de este fixture permanece vacío. La UI muestra error general, conserva el formulario y permite reintentar. La finalización inválida no acredita asistencia.
- Los dos informes del fixture de registro estaban finalizados **desde el seed** para conciliación: no son informes creados por CUA en este cierre.

La evidencia anterior de **borrador incompleto editable sin asistencia y finalización bloqueada tras recarga** sigue en [la etapa de inscripciones/70](matriz-visual-inscripciones-comunicaciones-70.md) y su SQL 18.6; no se renombra como ejecución nueva 18.7. Las transiciones/estados/bloqueos también pasaron en integración 18.7, sin sustituir esas reglas por callbacks.

Los errores inyectados fueron previos al commit. No se infiere ausencia absoluta de efectos si se pierde una respuesta después de guardar, ni entrega exactamente una vez. Ningún email fue enviado ni aceptado por Graph en estas pruebas.

## Automatización ejecutada

| Comprobación | Resultado / evidencia |
| --- | --- |
| Tipos, lint/formato, unitarias, CI local, contratos y build después del arreglo | Correctos en [checks.json](../tests/visual-close/checks.json); **108 unitarias**, **8 controles CI**, inventarios de contratos y Webpack/HTTP aislado |
| Integración con PostgreSQL 18.7 y guard de versión previo | **24 grupos** correctos, [integration.log](../tests/visual-close/integration.log): migraciones/adopción/checksum/concurrencia, permisos/enlaces, estados, cupos/FIFO, formularios, fotos, outbox y fallos externos con dobles; bases retiradas |
| Regresiones de consumidores/efectos | **12/12**, registro/agrupación y Escape; separadas de unitarias puras |
| Restauración DOM previa | **7/7** en `tests/manage-focus/restore-focus.test.mjs` |
| Verificadores históricos offline | Registro: 16 combinaciones; convocatorias: 28 controles; inscripciones: tres pruebas. Releer archivos no equivale a ejecutar nuevamente su CUA |
| Verificación nueva de auditoría/evidencia | **7/7** en `tests/visual-close/evidence.test.mjs`: 1032 estados, referencias/rutas/tamaños/roles, redacción, pending efectivo, foco, SQL y limpieza |

La primera compilación de seguridad no pudo abrir su listener por restricciones del sandbox. Repetición autorizada fuera del sandbox correcta; después del arreglo se repitió el conjunto y el build volvió a pasar. Se conserva [el diagnóstico inicial](../tests/visual-close/build-sandbox-initial.log) y [la comprobación posterior](../tests/visual-close/test-security-build.log). No es un defecto de Next ni se relajaron cabeceras/validación de origen.

Las suites afectadas y el build final usan el código corregido. La integración completa anterior al pequeño ajuste de teclado sigue siendo evidencia de reglas/SQL, que no cambiaron; no se afirma que pruebe ese listener cliente.

Comandos desde el proyecto, con el entorno local activado:

```sh
source scripts/local-env.zsh
node tests/visual-close/audit.mjs
node --test tests/visual-close/evidence.test.mjs
node --import ./tests/participation-visual/register.mjs --test tests/participation-visual/regressions.test.mjs
node --import ./tests/manage-focus/register.mjs --test tests/manage-focus/restore-focus.test.mjs
```

`checks.mjs` ejecuta comprobaciones de código. `sql.mjs` requiere fixtures activos, valida URL/directorio/versión y no acepta proveedores. La reproducción CUA usa `tests/{registry,outing,participation}-visual/fixture.mjs`; los dobles viven en copias, no en rutas activas del proyecto. Guardar nuevas capturas en otra carpeta, preservando las originales. `review.mjs` genera una propuesta histórica en un archivo separado; no reescribe la matriz vigente al reejecutarlo.

Estos verificadores offline y la suite dependiente de CUA **no son un E2E autónomo de CI**. No se instaló nada ni se activaron workflows.

## Vigencia, pruebas conservadas y límites del método

- Todos los hashes finales están en [revision.json](../tests/visual-close/revision.json) y `fuentes_cierre_20261117`. Los hashes originales permanecen: no se sustituyen para fingir que una captura anterior usó código nuevo.
- Los desacuerdos de generaciones antiguas en SplitGroupForm y SectionWorkspace se corresponden con arreglos posteriores documentados y verificados en sus etapas. El cambio del runtime de los fixtures 18.6 → 18.7 no convierte sus snapshots anteriores en 18.7 ni invalida automáticamente el comportamiento cliente.
- La nueva excepción de Escape solo afecta la invalidación de una captura pendiente. Las demás aprobaciones históricas se conservan para su afirmación limitada con análisis de impacto, unitarias DOM y regresión representativa; no se certifica toda su matriz otra vez.
- Los registros viejos identificaban Node, pero no todos guardaron una comprobación efectiva de npm/hijos. Se conservan como evidencia funcional histórica sin presentar el pin escrito como medición universal; este cierre sí verifica Node/npm efectivos.
- Se revisó el diff funcional completo: no hay cambios en políticas, Server Actions/casos de uso, migraciones, estados, cupos, espera, enlaces, auditoría o destinatarios para resolver UI. La única corrección funcional nueva es el listener descrito. La normalización LF/CRLF y sus aserciones son de una etapa previa; HMAC/versión/confirmación/filas inválidas permanecen intactos.
- No se retiraron pruebas/snapshots ni se debilitaron assertions. Se añadieron cinco casos a la suite DOM existente y verificadores separados; no se movieron dependencias de navegador/base a la suite unitaria pura.
- Algunas capturas terminadas en pending ya tenían la respuesta: se clasificaron por contenido, no por nombre. Un selector agotado o una navegación todavía sin hidratar no llevó a reenviar la operación automáticamente. [Clasificación](../tests/visual-close/classification.json).
- El recolector no pudo iterar FileList en una captura; se corrigió la lectura a value/fakepath y estado preparado. Esto no acredita bytes. La propiedad disabled aislada no refleja un fieldset deshabilitado: las capturas siguientes incluyen `disabledEffective`.
- El intento de salir del editor con foto preparada encontró la protección de cambios sin guardar. Se utilizó **Descartar y salir** del consumidor; no se burló esa protección. El descarte del diálogo de foto desktop no se usa como aprobación a partir de un intento inconcluso de Escape.

## Pendientes y riesgos concretos

1. **478 celdas pendientes**: matrices de menú/filtros/orden/paginación, contextos completos por lista, vacíos/desaparición, variantes de roles/unidades y decisiones cruzadas. Conservar sus evidencias parciales; no repetir lo ya verificado sin motivo.
2. **Una bloqueada: M19 desktop/apertura-cierre.** Enter de la Server Action de destacada produjo `Origin:null` en IAB. El ratón tras hidratación funcionó; repetir teclado en navegador nativo sin debilitar Next/allowedOrigins.
3. **Distribución/contraste restante**: completar las 40 celdas reclasificadas con controles/superficies/estados específicos, no solo scrollWidth. Zoom/forced-colors y otros tamaños siguen en la matriz externa, sin usarlos como requisito artificial para cerrar un subcaso de viewport base.
4. **Variantes de producto/UI**: permisos desktop pending, clonado inicial desktop, selección filtrada de series, herencia/alcances adicionales, subida en alta, edición de foto persistida desktop/descarte y límites conjuntos, consulta staff M42, enlaces vencidos/copiar fallido y diferencias de listas documentadas en las etapas.
5. **Roles**: A sola no ve Actualizar unidades aunque el servidor contempla esa capacidad; se mantiene la visibilidad vigente y la decisión de producto pendiente, sin ampliar permisos en esta auditoría. CU(U1)/otra unidad y combinaciones de roles tienen integración, no una nueva CUA completa.
6. **Compatibilidad de importaciones tras una publicación futura**: previews anteriores firmados con CRLF pueden requerir previsualización nueva. No se aplican silenciosamente filas o firmas obsoletas.
7. **Controles independientes no ejecutados**: lectores de pantalla hablados, dispositivos físicos, otros motores, zoom/forced-colors e infraestructura/CI remota/proveedores. AX, foco y tamaño emulado no demuestran esos controles. No se declara accesibilidad global.

Los tres fixtures, bases, aplicaciones temporales, archivos PNG/CSV de ejecución y pestaña se retiraron; viewport restaurado. Se conservaron scripts, capturas ficticias y snapshots saneados, y se descartaron logs efímeros de servidor después de extraer eventos sin tokens. [Recibo de limpieza](../tests/visual-close/cleanup.json).
