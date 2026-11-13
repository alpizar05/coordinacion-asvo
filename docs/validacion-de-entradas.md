# Validación de entradas y resultados de operaciones

Etapa local de refactorización, 12 de noviembre de 2026. Sin migración de esquema ni publicación.

## Contratos compartidos

`FormResult<Campo, DatosDeExito>` sigue siendo la unión serializable de éxito, error general y errores por campo (uno o varios mensajes). El segundo parámetro es opcional para conservar los formularios anteriores. Recepción pública y alta desde Coordinación exigen `id` y `status` en el éxito; no se inventan identificadores en fallos. Se conservan `RegistrationActionResult.issue`, los mensajes importantes y los adaptadores anteriores, incluido el contrato del informe del 70.

`form-input.ts` lee texto sin convertir archivos en cadenas y rechaza valores repetidos en controles escalares. No modifica FormData. Los grupos repetidos legítimos —periodos, selección de filas o fotos— se validan como listas. Errores de versión o integridad de la previsualización siguen siendo generales; no se intentan enfocar campos ocultos.

## Reglas de inscripción

| Regla | Pública / edición privada | Coordinación |
| --- | --- | --- |
| Identificación | Alta pública: exactamente nueve dígitos ASCII, sin espacios ni guiones. Edición privada identifica mediante el enlace autorizado. | Alta selecciona una ficha existente. Conciliación mantiene el identificador histórico autorizado; no se impone retroactivamente la regla pública. |
| Fechas fijas | El servidor toma las fechas publicadas. | Las fechas enviadas deben coincidir con la salida. |
| Fechas flexibles | Calendario válido, regreso posterior o igual y al menos un día de intersección, incluidos los extremos. Se permiten extensiones. | Misma regla; la aprobación posterior sigue vigente. |
| Transporte | Cantidad entera de 0 a 100 cuando ofrece transporte. Sin transporte se descarta la cantidad del formulario. | Mismos límites; también se validan los datos tipados al entrar al servicio. |
| Alimentación / observaciones | Hasta 500 caracteres, conservando el recorte de espacios existente. | Igual. |
| Póliza | Verificada y cubre el periodo completo, con límites inclusivos. | Misma consulta `registrationCoverage`. |

Se conservan separados formato de identificación inválido, persona no encontrada y póliza insuficiente. `eligible` mantiene la elegibilidad por unidad. La comprobación en servidor es obligatoria aunque el navegador también valide. Se mantienen límites HTML con las mismas constantes; el pegado y saneamiento a dígitos no cambian.

Los servicios de alta y edición de Coordinación reutilizan `validateRegistrationData`, que adapta datos estructurados a la misma regla de participación. No dependen únicamente de la validación de la Server Action. Los errores de fechas y logística se devuelven juntos antes de escribir. Permisos, cierre, duplicados activos, cobertura y conflictos concurrentes conservan sus mensajes y tratamiento general existentes.

## Otros límites de confianza

- **Fotos:** `parsePhotoMetadata` comprueba JSON, lista de hasta seis, estructura, claves, tipos de metadatos, origen, autorización y referencias únicas. `validatePhoto` comprueba archivo, MIME y tamaño; Sharp sigue verificando los bytes reales. Los errores conservan el identificador de cada foto preparada. El editor usa el mismo parser antes de cargar o escribir.
- **CSV:** `registry-csv.ts` concentra el parser puro y las reglas de fila/columna, sin SQL ni escrituras. Rechaza entradas que no sean texto, archivos grandes, encabezados inválidos y filas repetidas. El servicio conserva previsualización firmada, confirmación, bloqueo, comparación concurrente e idempotencia. La comparación de firmas usa longitud en bytes; versiones de reintento deben ser hashes válidos.
- **Formularios existentes:** ficha, póliza, incidente, conciliación, permisos y decisiones de salida reutilizan la lectura escalar segura. El informe del 70 rechaza tipos malformados también en borrador, sin exigir los campos finales cuando se guarda borrador.
- **Microsoft Graph:** `graph-response.mjs` valida las propiedades efectivamente usadas de respuestas exitosas: token opaco no vacío sin controles/espacios e identificador de foto no vacío. No imprime respuestas ni secretos. Una respuesta inválida del token mantiene el correo pendiente de reintento. `sendMail` continúa aceptando la respuesta exitosa sin JSON; Auth.js conserva su protocolo y adaptadores.

No se añadieron componentes visuales, almacenamiento del navegador ni redirecciones. Se reutilizan errores por campo, resúmenes, foco y modales existentes. Los validadores no consumen ni borran archivos de FormData; no se cambiaron cupos, promociones, auditoría, notificaciones ni contexto de navegación.

## Verificación y límites

- 68 pruebas unitarias, sin DB/red/credenciales. Límites, datos malformados, errores independientes, no mutación de FormData, fotos, CSV y Graph.
- Los 12 grupos de integración y dos contratos pasan. Recepción pública, edición/cancelación privada y alta/edición desde Coordinación se ejecutan con PostgreSQL real local desechable, destinatarios ficticios y red bloqueada. Se comprueban reintentos, ausencia de notificaciones por entradas inválidas, cobertura, unidades, cupos/lista de espera, versiones y concurrencia. El runner retira las bases temporales.
- TypeScript y compilación correctos; `git diff --check` sin problemas.
- Cobertura V8 del subconjunto explícito de 29 módulos puros: 100 % líneas, 95,89 % ramas y 99,36 % funciones. No representa cobertura global. La medición inicial de 25 módulos permanece como referencia histórica; la extracción de CSV y los nuevos validadores amplían el denominador.

No se ejecutó una nueva verificación visual ni de lector de pantalla en esta etapa. Se mantuvieron los componentes y pruebas de decisiones de foco/contexto; eso no sustituye una prueba de navegador de todos los formularios. Las respuestas reales de Microsoft no se consultaron: se usaron dobles. No se promete cobertura combinatoria completa, entrega de correo exactamente una vez ni autorización centralizada; estas tareas siguen en TODO.
