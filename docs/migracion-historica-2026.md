# Migración histórica 2026 a la beta

## Fuente y contrato

Paquete privado: `outputs/migracion-coordinacion-2026/migracion-voluntariado-2026.json`, versión 3. SHA-256: `9e7051bed16648ad8ca3025895aa6377775241a3e8f7134da5e678e0eed32213`. Lote: `voluntariado-2026-v3-9e7051bed16648ad`. Se leyó `migration_contract` antes de construir el importador.

Los originales contienen información personal y no deben agregarse al repositorio. `historical_import_batches` conserva contrato, fuentes, hash y conteos; `historical_import_records` conserva cada ficha, solicitud organizativa, convocatoria, inscripción, póliza, informe y cola de revisión completos. Incluye las variantes de contacto, estados, marcas temporales, filas y referencias originales. Los UUID de personas se remapean por identificación; los otros registros conservan sus UUID deterministas. Las tablas de staging no tienen rutas públicas.

## Adaptación al esquema

- 329 grupos → 329 `requests` organizativas DEMO y 329 bloques `outings`. Los 820 envíos individuales originales y 17 inscripciones de responsables autorizadas → 837 `registrations`, nunca 837 `requests`.
- Se conservan solicitantes y contactos DEMO: SINAC (264), ASVO (57), centros educativos (6) y ADI (2). El correo de contacto se incluye en `requests.contact` porque el esquema no tiene una columna propia. Se añade `.test`; el valor original queda en staging. Los teléfonos desconocidos no se inventan.
- Actividades y planes se toman de las labores y acciones de informes que ya incluye el paquete. Las observaciones permanecen como contexto original; no se convierten en requisitos ni logística. Los textos describen historia, no instrucciones futuras verificadas.
- Se reutilizan personas existentes sin sobrescribir sus nombres, contactos existentes, unidades ni permisos. Los correos y teléfonos que estén vacíos se completan desde el paquete; los correos nuevos conservan la protección `.test`. Las personas nuevas se crean con Voluntariado General. Los contactos importados no se consideran verificados. Los correos activos llevan `.test`, salvo las identificaciones autorizadas mediante `BETA_IMPORT_ALLOWED_IDENTIFICATIONS` en configuración privada.
- Las pólizas existentes con el mismo número/persona se reutilizan sin cambiar su verificación. Las nuevas usan `Poliza DEMO`, fechas del paquete y `verified_at=null`. No se inventa cobertura de enero: una inscripción fuera de las fechas de su póliza queda sin `policy_id`, conservando la referencia original en staging.
- Se conserva `legacy_status` y `historical_participation` en `registrations.details`, además del original íntegro. El estado operativo candidato `confirmada` no equivale por sí solo a asistencia confirmada. La trayectoria distingue «Participación registrada · Histórico» y «Participación asumida · Demo»; estas marcas no se suman como asistencia acreditada por informes.
- Los 17 registros DEMO mantienen su procedencia y `received_at=null`. Se permite ese nulo en el esquema y la interfaz muestra «Sin fecha original»; no se fabrica una recepción.
- El 70 se toma únicamente de `lead70_candidates` respaldados por vínculos fuertes: 105 inscripciones enlazadas al responsable correspondiente. Sin informe fuerte no se asigna responsable. No se crean más personas ni inscripciones ficticias.

## Supuestos técnicos del demo

Las 329 salidas quedan privadas y ninguna en estado abierto. Para satisfacer campos obligatorios ausentes:

- `capacity = max(1, inscripciones confirmadas del grupo)`: marcador técnico DEMO, **no cupo históricamente autorizado**.
- `flexible=false`: valor técnico, **no declaración de modalidad histórica**.
- Las 19 unidades ambiguas usan Voluntariado General; las opciones originales se conservan para revisión.
- Estado derivado: cancelada cuando todas sus inscripciones están canceladas; completada si el periodo terminó y hay registros históricos completados o informe fuerte; confirmada para los restantes casos. Resultado a fecha de corte 10/11/2026: 292 completadas, 25 canceladas y 12 confirmadas. No se altera el estado original conservado en staging.
- Fecha límite técnica igual al inicio. Al estar privadas y no abiertas no se ofrece inscripción pública.

## Informes y pendientes

Los 129 informes tienen una sola copia original en staging. Se importan 79 a `outing_reports`: vínculo fuerte con un único grupo, responsable con inscripción enlazada y rango original válido. Se conservan nombre/correo del responsable (correo activo protegido), labores, acciones, observaciones y fecha original de envío. Su estado es finalizado por tratarse de un informe ya entregado.

Los otros 50 permanecen pendientes en staging. Hay 11 informes con varios grupos fuertes que requieren resolver consolidación/asociación; 36 sin grupo fuerte; y 3 adicionales con único vínculo fuerte pero rango original inválido. En total el paquete contiene 5 informes con rangos de fecha/hora inválidos: se conservan sin corrección automática. No se duplica un informe en varios grupos ni se elige un grupo arbitrariamente. Los informes empresariales sin inscripción compatible permanecen en staging, sin crear personas ni inscripciones.

Los 155 vínculos se conservan en `historical_import_report_links`: 105 fuertes analíticos y 50 probables. Los probables tienen `state='pendiente'`; ningún vínculo se marca aprobado por una persona. Los fuertes de informes no importables también quedan pendientes.

Las 392 propuestas de participantes tienen `Decisión=null`, incluso las 239 de confianza Alta. Por ello `outing_reports.participants=[]`: no se transforma una propuesta en identidad/asistencia verificada, ni una ausencia en texto en `attended=false`. Las listas originales y candidatos completos quedan disponibles en staging para revisión. No se fabrican resoluciones de asistencia.

Se conservan, sin aplicar, las colas: 339 cambios de informes, 1040 cambios de inscripciones, 143 grupos sin informe identificado y 1 posible inscripción casi duplicada.

Consulta administrativa de los informes pendientes:

```sql
select source_key, payload->>'source_row' as fila, notes->'reasons' as motivos
from historical_import_records
where batch_id='voluntariado-2026-v3-9e7051bed16648ad'
  and entity='report' and state='pendiente';
```

## Fotografías

Se almacenan seis originales en la biblioteca privada de SharePoint y se generan versiones WebP de tarjeta (560 × 350) y visualización (máximo 1440 × 1100). Se reutilizan identificadores de archivo: no se suben 329 originales.

Asignación de portadas: Montezuma 30, Tortuguero 16, UEA 29, COVIRENAS 38, BRIF 27 y General 189. Montezuma/Tortuguero prevalecen por estación; las demás se eligen por unidad. Buena Vista y lugares sin imagen específica usan General. Son imágenes ilustrativas, no evidencia fotográfica de la gira histórica. Crédito: ASVO, imagen facilitada para la beta. Se conservan hashes de las imágenes y referencias de SharePoint en `historical_import_photos`.

Cada bloque y su solicitud organizativa reciben la misma portada. La galería elimina repeticiones por identificador de archivo para mostrar las seis imágenes sin centenares de duplicados.

## Ejecución y repetición

Vista previa sin mutaciones:

```sh
node --env-file=.env.production.local scripts/import-historical-beta.mjs
```

Carga autorizada (configuración privada de beta y SharePoint requerida):

```sh
node --env-file=.env.production.local scripts/import-historical-beta.mjs --apply --photos-dir=/ruta/a/photos --output=/ruta/privada/resultado-importacion-beta.json
```

El importador solo admite la beta conocida en Neon o una base demo local. Las identidades exceptuadas del sufijo `.test` se configuran privadamente; no se publican en el repositorio. Las imágenes tienen nombres deterministas en SharePoint y hash de contenido, por lo que un reintento tras un fallo de red reutiliza el mismo archivo. Los registros operativos y staging se escriben en una transacción con bloqueo, seguida de validación antes de confirmar. La preparación de tablas/fotos queda registrada aun si la transacción operativa falla, para reintentar sin duplicar imágenes.

Un lote completado se valida nuevamente y no se vuelve a insertar. Cambiar el archivo produce otro hash: no regenerar otra versión del snapshot sin conciliar primero las referencias históricas.

No se invocan acciones de inscripción, envíos, recordatorios ni generación de enlaces privados. Se comprueba que las 837 inscripciones no tengan correos, recordatorios ni enlaces generados por esta carga. Se validan relaciones, portadas, responsables, ausencia de inscripciones activas duplicadas y correos protegidos.

Pruebas: `node scripts/test-historical-import-plan.mjs`; importación real en un esquema local aislado y repetición idempotente; TypeScript y compilación de producción. El resultado de la carga beta se guarda junto al paquete privado como `resultado-importacion-beta.json`.

## Resultado de la beta

Carga confirmada el 10 de noviembre de 2026 (Costa Rica). Se reutilizaron las 167 personas y 166 pólizas: no se duplicaron fichas ni se añadieron verificaciones de póliza. Se crearon 329 solicitudes organizativas DEMO, 329 convocatorias privadas, 837 inscripciones (820 originales y 17 DEMO), 79 informes operativos y 50 informes pendientes íntegros en staging. Los 105 responsables quedaron enlazados a su inscripción. Se subieron seis imágenes a SharePoint y se asignaron 329 portadas. Validación transaccional: cero inscripciones activas duplicadas; cero correos, recordatorios o enlaces privados creados; los 50 vínculos probables permanecen pendientes.

Para consultar las convocatorias migradas, entrar en Coordinación → Convocatorias de salida y cambiar el filtro Estado de «abierta» a «Todos» o «completada». Las convocatorias históricas no aparecen en el catálogo público. Los pendientes de informes y participantes requieren revisión posterior; no se convirtieron en asistencias verificadas.

### Cambio posterior de visibilidad

Por solicitud posterior, las 329 convocatorias se marcaron públicas (`listed=true`), conservando las 292 completadas, 25 canceladas y 12 confirmadas. El catálogo sigue mostrando únicamente convocatorias abiertas con inscripción vigente: este cambio de visibilidad no reabre inscripciones ni modifica fechas. El importador conserva el valor inicial privado al crear el lote, pero al verificar un lote ya cargado respeta cambios posteriores de visibilidad y no los sobrescribe.

### Apertura posterior de convocatorias

El 11 de noviembre de 2026, por solicitud expresa, las 12 convocatorias migradas en estado Confirmada pasaron a Abierta, conservando sus fechas, fecha límite, visibilidad pública e inscripciones. Las 12 cumplen los criterios del catálogo al realizar el cambio. Las 292 completadas y 25 canceladas no se modificaron. La salida `235ecbc1-960a-5d32-94a4-7306bbd24038` quedó abierta, pública y con fecha límite 13/11/2026. Los valores técnicos de cupos y modalidad del demo siguen documentados en los supuestos de esta guía. La verificación del importador respeta estos cambios posteriores y no vuelve a cerrar ni privatizar el lote.
