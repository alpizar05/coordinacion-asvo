# Matriz visual: convocatorias, series y fotografías

17 de noviembre de 2026. Ejecución local sobre `3e0a187332414203201a53092acada85723abee3` más el diff previo preservado. **164 observaciones CUA, 111 capturas y 28 comprobaciones reproducibles de evidencia. No se modificó código funcional en esta ejecución.** La matriz global continúa abierta: no se convierten las variantes verificadas en aprobación de criterios más amplios.

## Entorno y método

- Consumidores reales y rutas autenticadas de Next, con sesión demo de Coordinación general y unidad General. Se conservaron políticas, consultas, casos de uso y transacciones. No se amplió autorización para probar.
- Desktop 1440×900 y celular emulado 390×844, en el navegador integrado. No incluye 320px, zoom, otros motores, dispositivos físicos ni lectores hablados.
- Node.js 26.13.1 y npm 11.7.0. PostgreSQL **18.6** nativo disponible: se creó otro clúster desechable, con puerto 55528, usuario ficticio y comprobación de `current_database()`/`data_directory` antes de preparar o escribir. **No certifica PostgreSQL 18.7.**
- Copia temporal de app/lib/public; no se copiaron `.env` ni credenciales. El entorno se construyó con `cleanTestEnvironment`. Sin acceso a beta ni proveedores.
- Graph sustituido en el adaptador de transporte: token ficticio, almacenamiento en memoria y primer PUT rechazado con 503. Se ejecutó la orquestación real de preparación/carga/confirmación, incluida la interpretación de las respuestas y la persistencia PostgreSQL. El resto de `fetch` quedó bloqueado.
- Respuestas UI de prueba: primer intento válido devuelve error general y dos campos; segundo rechaza **antes de ejecutar el caso de uso**; siguiente intento ejecuta la operación real. PhotoDialog aplica la misma secuencia antes del callback de preparación. Cada intento válido tiene demora de 1600ms. Estos dobles viven únicamente en la copia temporal.
- Destinatario exclusivamente `persona@example.test`. Demo impide despacho y la protección `.test` conserva la cola vacía. No se enviaron correos ni se cargaron archivos externos.

Se registraron estado AX, elemento activo, URL, criterios, scroll, campos/selecciones/archivo visible, asociaciones de error, controles deshabilitados, diálogos y desbordamiento. `results.json` contiene las observaciones crudas, incluidas las transitorias y los intentos fallidos del arnés; sus nombres **no son por sí solos un resultado aprobado**.

## Evidencia nueva por consumidor

Las etiquetas siguientes son nombres de observaciones en [results.json](../tests/outing-visual/results.json). Los guardados SQL están en [persistence.json](../tests/outing-visual/persistence.json); las decisiones de cobertura están en la [matriz detallada](matriz-visual-consumidores.json).

| Consumidor | Evidencia ejecutada | Resultado y límite |
| --- | --- | --- |
| **M20 Nueva convocatoria** | `desktop-new-*`, `mobile-new-*`: vacíos, seis correcciones iniciales, resumen que revela fechas, dos periodos, error de periodo duplicado desktop, galería, respuesta mixta, rechazo y reintento | Dos salidas por alta independiente en SQL, con fechas y solicitud compartida correctas. La llegada autocompleta regreso. No se probó la vinculación desde el selector de origen ni toda su combinación de teclado/archivos |
| **M21 Nuevo bloque** | `desktop-block-*`, `mobile-clone-*`: datos/foto precargados, fechas nuevas, errores, demora, rechazo y reintento; `mobile-series-clone-link` activa el enlace real de la tabla | Un nuevo bloque por ejecución, mismo request, sin duplicados. Descarte desktop en una segunda apertura. La primera apertura desktop se verificó por destino directo después de una activación transitoria; no se declara probado ese clic inicial |
| **M22 Editar individual** | `desktop-individual-editor`, `desktop-edit-*`, `mobile-individual-*`, `mobile-photo-parent-*`, `mobile-editor-discard`, `mobile-discard-*` | Edición directa sin Personalizar. SQL conserva estado y guarda título/foto. Error general y campos simultáneos, resumen a cupo, archivo conservado, rechazo Graph y reintento. Tab/Shift+Tab/Escape del descarte móvil. Falta teclado exhaustivo y repetir doble clic del guardado de texto móvil con contador reiniciado |
| **M23 Editar bloque** | `desktop-block-inheritance`, `desktop-block-mixed/rejection/persisted`, `mobile-block-inheritance/persisted`, `mobile-photo-edit-*` | Título propio editable, ubicación/unidad heredadas deshabilitadas; personalización solo del bloque. Foto/título propios sobreviven a editar el título común. Fallos del editor desktop y fallos del diálogo de foto móvil son pruebas diferentes; falta ciclo completo de fallo del editor del bloque móvil |
| **M24 Fotos preparadas en alta** | `desktop-new-photo-*`, `mobile-gallery-*`, `desktop-prepared-photo-edit-required`, `desktop-photo-edit-*`, `desktop-photo-discard-prompt` | Galería en ambos tamaños; metadatos y descarte de edición en alta/clonado desktop; pending, Escape bloqueado, errores/rechazo, foco al disparador. Preparación local explícita; la publicación posterior se comprueba en M20/M21. Falta subida en esta ruta y edición preparada móvil |
| **M25 Fotos del editor** | `desktop-photo-upload-empty/invalid-file`, `desktop-upload-*`, `desktop-edit-graph-failure/file-retained`, `mobile-upload-*`, `mobile-parent-file-retained`, `mobile-photo-edit-*` | Subida ficticia en ambos tamaños; extensión inválida desktop, PNG corrupto y >3MB móvil, autorización/descripción requeridas. Archivo, crédito y permiso sobreviven a errores. Primer PUT simulado falla; reintento sin volver a elegir archivo guarda referencia única. Edición de foto existente móvil; falta esa variante desktop y límite agregado de bytes en UI |
| **M26 AttachPhotos** | Inspección del JSX activo, descrita abajo | No aplicable como consumidor alcanzable de esta ruta. Se conserva el módulo y sus contratos; no se inventó una página para probarlo |
| **M27 Datos comunes** | `desktop-common-*`, `mobile-common-*`: alcance/confirmación requeridos, título explícitamente seleccionado, resumen revela revisión, error mixto, rechazo y guardado | Cambios afectan los bloques heredados y conservan las excepciones. Se mantuvo `apply=title` y confirmación al fallar. Falta descarte, otras selecciones —incluidas fotos— y regreso multinivel. Pending móvil registrado; no se completa el criterio amplio desktop con una captura faltante |
| **M29 Serie manual** | `desktop-manual-*`, `mobile-manual-*`: nombre/selección vacíos, dos miembros, resumen desktop, demora/doble clic, error mixto, rechazo y reintento | Una serie por alta, dos miembros únicos y confirmación/destino reales. No se certifica selección con filtro activo ni descarte; faltan teclado y contexto completos |
| **M06/M07 Gestionar series** | `desktop-series-actions-open/escape`: automática compacta sin X; `mobile-series-actions-open/copy`: manual en panel inferior con X, copia de URL local y retorno al disparador | Se mantuvieron diferencias de dispositivo. No hay pasos de edición: son enlaces/copia. Falta ejecutar las variantes cruzadas en sus rutas y fallo de portapapeles; C02 histórica sigue como apoyo separado |
| **M18 Acciones** | `desktop/mobile-cancel-*`, `desktop/mobile-complete-*`, `desktop/mobile-delete-*`: requerido, pending, error mixto, rechazo, reintento y estado final | Cancelación con inscripción cancela ambas; completar exige actividad realizada y fecha pasada; eliminar exige cero inscripciones. SQL confirma una sola operación. **Decisión de agrupación no tuvo ejecución visual nueva**: M18 no se cierra globalmente |
| **M19/M28 Portada y bloques** | `mobile-feature-selected/cleared`, `desktop-feature-selected`, `desktop-series-feature-selected`, `mobile-series-feature-cleared-stable`, `mobile-series-clone-link` | Selección individual y de serie, retirada y enlace de clonación locales. Sin campos visibles: no se fabrican errores por campo. Restricción de Origin en el arnés y pendientes de teclado/error/pending se describen abajo |
| **M30 Consulta manual** | `desktop-manual-persisted`, `mobile-manual-persisted` | Destino real tras crear y dos miembros visibles. Página de consulta; sin guardado propio. Enlaces a salidas y retorno multinivel permanecen pendientes |

La distinción entre individual y serie se verificó en UI y SQL. La actualización común cambia `Serie Ficticia` a `Serie Editada Desktop`; el bloque personalizado termina como `Bloque Personalizado Desktop`, con overrides de título y fotos. La serie pasa de dos a cuatro bloques por los dos clonados. Las dos altas independientes crean dos bloques cada una.

## Preparación, persistencia y fallo externo

El diálogo prepara la fotografía y devuelve el foco a Agregar/Editar foto. El padre conserva el archivo y solo lo envía al guardar la convocatoria. En el editor individual desktop y el de Fotos Mobile:

1. El archivo PNG ficticio, metadatos y autorización se conservaron tras errores del diálogo.
2. El formulario padre conservó lo preparado ante fallo mixto y rechazo anterior al commit.
3. Graph simulado rechazó el primer PUT. Se mostró error general; no apareció confirmación ni se cerró el editor.
4. Un reintento explícito conservó el archivo, efectuó carga simulada y guardó una referencia PostgreSQL.
5. La consulta final encontró exactamente dos referencias Graph ficticias distintas, una por salida, sin duplicar posiciones ni superar seis fotos.

No se capturó una pareja SQL antes/después de **cada** callback de preparación. La evidencia de preparación es UI más el límite de código del callback; la persistencia se demuestra por separado con SQL y eventos del adaptador. Los errores inyectados de la acción ocurrieron antes del caso de uso: **no prueban** ausencia de efectos ante pérdida de una respuesta posterior al commit. La suite `photo-uploads` sí verifica compensación, conflictos y reintentos por separado, sin navegador.

## Inventario corregido: AttachPhotos

En `app/coordinacion/salidas/[id]/page.tsx`, los dos montajes de AttachPhotos dentro de `information` requieren `editing` o `canAttachPhotos` (que también requiere `editing`). El render final elige **OutingEditor cuando editing**, y solo entrega `information` a OutingTabs cuando **!editing**. Por lo tanto, esos montajes no son alcanzables en la composición actual.

M26 se marca N por este motivo estático; no se elimina el componente ni sus interfaces. La persistencia activa de la ruta se verificó en **M25/OutingEditor**. No se cambia la composición para hacer aparecer un consumidor legado.

## Contexto y teclado

- Desktop: lista con `salidaBuscar=Individual&salidaOrden=starts:asc` → individuo → editar/guardar → enlace contextual → misma búsqueda/orden y foco en `Individual Editada Desktop`.
- Celular: lista con esos criterios → individuo → editar → descarte cancelado mediante Escape y retorno a Descartar → descarte explícito → PDP → regreso contextual → foco en `Individual Editada Mobile`.
- Resúmenes de errores abrieron fechas/cupo o revisión común antes de enfocar. Metadatos enfocaron descripción/crédito dentro del diálogo. Asociaciones `aria-describedby` existían en los casos comprobados.
- Pendientes: Atrás/Adelante/recarga, cambio/desaparición de fila, filtros combinados, pestañas distintas y cadenas de varios niveles de **cada** consumidor. Las celdas amplias de contexto permanecen P, aunque hay recorridos parciales satisfactorios.
- No se ejecutó barrido exhaustivo de Tab ni lectura hablada de todos los formularios. Inspección AX/ARIA no equivale a lector de pantalla.

## Incidencias del arnés y observaciones no aprobadas

No se reprodujo un defecto de aplicación que justificara modificar código funcional.

- El `.fill()` de controles React ocasionalmente cambió el DOM sin actualizar su estado; al cambiar de sección volvía el valor previo. Las fechas se ingresaron después con teclas nativas ArrowUp/ArrowDown y se comprobaron otra vez. `desktop-new-period-duplicate` inicial **no** demuestra el duplicado: usar `desktop-new-duplicate-stable`. Para texto móvil se confirmó entrada con teclas y el estado Cambios sin guardar.
- Las primeras navegaciones/subidas del navegador integrado tardaron varios minutos. Se registraron intentos transitorios sin navegación; no se contabilizan como activaciones verificadas.
- Enter en el formulario de portada desktop y una acción de serie antes de hidratar produjeron `Origin:null`; Next rechazó la Server Action. El clic después de hidratar funcionó. No se relajó `allowedOrigins`, validación ni seguridad. El teclado de esa frontera queda B, para repetir en navegador nativo.
- `mobile-series-feature-cleared` y `mobile-series-feature-origin-blocked` son intentos fallidos; la retirada correcta es **`mobile-series-feature-cleared-stable`**. `mobile-series-actions` inicial precede hidratación; usar **`mobile-series-actions-open`**.
- Un timeout esperando un encabezado no equivale a fallo de persistencia: en los casos documentados se inspeccionó la página resultante y SQL. No se volvió a enviar automáticamente.
- El primer helper SQL consultó una columna `status` inexistente en outbox; se corrigió **el helper de prueba** a `delivery_state`. No cambió la aplicación. El fallo no se presenta como verificación SQL.

## Evidencia histórica conservada

H02: PhotoDialog compartido, galería/subida/edición y estados, en [actualizacion-modal-fotos.md](actualizacion-modal-fotos.md). Sirve para el componente; no completa por analogía las variantes pendientes de M24/M25.

C02: CollectionsTable real y RowActionPanel, en [auditoria-foco-gestionar.md](auditoria-foco-gestionar.md). Se conserva la comprobación de foco/menú de ambos tipos; los criterios de filtros/ruta completa siguen separados.

H04: contraste de controles y tokens, en [contraste-controles-coordinacion.md](contraste-controles-coordinacion.md). No se alteraron estilos en esta ejecución ni se repitieron sus ratios como medición nueva. Las capturas actuales permiten revisar distribución, no certificar contraste de toda la plataforma.

Los hashes de consumidores/dependencias actuales están en `fuentes_convocatorias_20261117` del JSON. No se atribuyen las correcciones previas de CSS, PhotoDialog, foco o SectionWorkspace a esta ejecución.

## Comprobaciones ejecutadas

Todos los resultados y salidas se conservan en [tests/outing-visual](../tests/outing-visual):

| Comprobación | Resultado |
| --- | --- |
| `ci:typecheck` | Correcto |
| `test:unit` | 108 pruebas correctas |
| `test:contracts` | Correcto |
| `lint` | Correcto |
| `format:check` | Correcto en el alcance de formato definido por el proyecto |
| `test:security:build` | Next Webpack de producción/HTTP y rechazo de importación server-only correctos; copia aislada retirada |
| Integración `outing-editor`, `outing-forms`, `photo-uploads` | Tres grupos correctos, SQL local y dobles externos |
| Integración `manual-series-contracts`, `legacy-operation-contracts`, `homepage-feature-contracts` | Tres grupos correctos, SQL local y dobles externos |
| `verify-results.mjs` | 28 comprobaciones offline: errores/foco, controles pending, archivo/metadatos, criterios/fila de regreso y resultados SQL |

La primera ejecución de la suite estática encontró EPERM al abrir loopback; la repetición autorizada fuera del sandbox terminó correctamente. No se usaron credenciales ni servicios beta. Las suites de integración crearon y retiraron sus bases propias. No equivalen a una CI remota ni a una suite de navegador autónoma.

Al añadir el registro completo, lint advirtió que el JSON excedía su límite de tamaño. Se compactó el artefacto sin retirar observaciones ni cambiar la configuración de lint; la repetición final pasó con 400 archivos revisados. El verificador volvió a pasar después de compactarlo.

Reproducir evidencia grabada sin base/red:

```sh
node tests/outing-visual/verify-results.mjs
```

Repetir CUA requiere preparar de nuevo el fixture local (`node tests/outing-visual/fixture.mjs`, Node fijado y binarios PG locales compatibles), comprobar su destino, usar CUA y después detener **el PID que imprime ese fixture**. No reutilizar los UUID de contexts temporales ni los directorios de esta ejecución. `checks.mjs sql` necesita ese clúster activo; el runner de integración protege y crea otras bases desechables. Los scripts del arnés no se importan desde app ni se despliegan.

## Limpieza y pendientes

La pestaña temporal se cerró y se restableció el viewport. El servidor y clúster desechables se detuvieron; se verificó la ausencia del directorio temporal y de `tests/outing-visual/active.json`. Se conservan scripts, registros y capturas ficticias para trazabilidad; no una ruta `/audit`, base o fixture activo en el proyecto.

Se mantienen abiertos por consumidor los criterios no ejecutados indicados arriba. Especialmente: subida en alta, edición preparada móvil/edición existente desktop, bytes agregados, selección filtrada de serie manual, otras selecciones comunes y su descarte, decisión de agrupación, variantes cruzadas de Gestionar y navegación completa. No se cierra UX04 ni la auditoría visual general a partir de este subconjunto.

Lectores hablados, dispositivos físicos, otros navegadores, infraestructura/CI remota y PostgreSQL18.7 continúan como matrices o verificaciones independientes.
