# C10 — Contratos de creación de serie manual

14 de noviembre de 2026. Alcance: saveManualSeries, createOutingCollection, su adaptador staff-actions y CollectionForm. Se preservan los cambios previos sin publicarlos.

## Hallazgo y cambio

El servicio devolvía el ID creado o null si la selección ya no estaba disponible. Era un resultado de dominio legítimo, no un string de error interpretado por idioma; faltaba un tipo explícito y la acción no adaptaba los fallos técnicos. Esta etapa utiliza el FormResult existente en lugar de introducir otro protocolo:

- ManualSeriesSaveResult: éxito con saved true e id obligatorio; selección no disponible como error general.
- ManualSeriesCreateResult: éxito con destination obligatorio. La acción solo lo construye después de sql.begin confirmado; no deduce éxito por truthiness del ID.
- La acción retorna conjuntamente los errores independientes de name, description y outing del validador compartido. Permisos, selección actual distinta o inexistente y conexión/persistencia son generales.
- Excepciones de auditoría/SQL continúan abortando la transacción; la acción las convierte en un mensaje general seguro, sin exponer SQL o credenciales.
- El adaptador staff-actions conserva nombre y argumentos, pero declara el resultado preciso y sigue teniendo consumidores verificados.

El formulario usa checkedFormResult, éxito literal y destino no vacío antes de router.push. Una respuesta incompleta o sin mensajes tiene un fallback general visible. Se conservan nombre, descripción, búsqueda, selección, sección activa en errores generales, busy/pending, resumen/revealField/foco y distribución de tablas/listas. Los errores de campo pueden abrir la sección correcta mediante el feedback existente. No se agregaron resets, almacenamiento del navegador, modales ni estilos.

La interfaz pública conserva argumentos y URL `/coordinacion/colecciones/manuales/<id>?confirmacion=serie`. No se agregaron redirects al fallar ni notificaciones. El estado `_previous` compatible se mantiene. El protocolo interno ID/null cambia a FormResult; todos sus consumidores localizados y las pruebas se migraron juntos.

## Reglas que se conservan

La acción obtiene la sesión, deriva general/unidades y mantiene los mismos roles efectivos: Administración sola no concede esta creación. El servicio recibe esos alcances ya derivados, consulta la selección actual en PostgreSQL y mantiene los locks for share en orden de ID. El servicio sigue suponiendo entradas previamente validadas por la acción; no se convierte en un endpoint público independiente.

Se conservan nombre de hasta 120 caracteres, descripción opcional de hasta 2000, selección obligatoria y validación de UUID. Los IDs repetidos en un envío se deduplican antes de insertar miembros. Si algún recurso ya no existe o cambió de unidad, se devuelve conflicto general sin crear colección parcial. No existe un campo version de este formulario: se valida la selección actual bajo bloqueo; no se inventó uno ni una migración.

Se conservan creación de colección/miembros y auditoría atómicos. No se modifican las salidas agrupadas, fechas, estados, herencia, cupos, espera, fotos ni mensajes. Puede seleccionarse una salida no pública o histórica autorizada como antes; la visibilidad de la colección pública continúa filtrando sus miembros por las reglas de catálogo existentes.

**Idempotencia R5:** una creación válida repetida sigue creando otra serie y otra auditoría, incluso si el contenido coincide. Dos solicitudes válidas concurrentes siguen siendo dos creaciones legítimas. Esta etapa no incorpora una clave de operación ni promete exactamente una vez ante respuesta perdida después del commit. La prueba de reintento verifica rollback y creación única tras un fallo previo al commit; no se presenta como solución de la deduplicación global. R5 permanece pendiente.

## Pruebas y evidencia local

Node.js 26.13.1, npm 11.7.0, PostgreSQL 18.7 UTF-8 desechable y Next.js 16.4.5 Webpack. Fuentes/binarios oficiales verificados por SHA-256. Sin dotenv privados, beta o proveedores; runner protegido por destino loopback y nombre reservado antes de escribir.

- TypeScript en copia fresca con tests/types/manual-series-contract.ts: requiere ID/destino al confirmar y rechaza null/string como resultados legados; adaptador y acción compatibles.
- 103 unitarias existentes; 38 módulos puros explícitos, 100 % líneas, 96,75 % ramas y 99,56 % funciones. No se agregó artificialmente el servicio SQL al denominador ni se declara cobertura global.
- Contratos estáticos, ocho controles CI, lint/formato y compilación/HTTP/server-only aislados. Sin Turbopack adicional.
- Integración SQL: grupo nuevo manual-series-contracts y suite completa de 23 grupos pasaron. Bases y triggers de fixtures retirados por el runner.

El nuevo grupo manual-series-contracts usa acciones/SQL/políticas reales con Next/Auth.js/petición simulados. Prueba errores múltiples y entradas repetidas mal formadas, ausencia de sesión/admin sin Coordinación, selección inexistente, fallo de auditoría después de inserts con rollback total, reintento correcto, ID y destino persistidos, miembros sin repetir, adaptador, repetición válida y concurrencia históricas, unidad ajena/cambio de unidad desde la selección y conexión cerrada. En fallos compara colección/miembros/auditoría/correo/salidas, conserva FormData y exige ausencia de destino y revalidaciones; en éxito comprueba miembros y auditoría reales. Cero fetch/Graph y cero correo creado o enviado.

## Límites pendientes

No se ejecutó una matriz CUA nueva desktop/celular. Pendiente comprobar foco, secciones ocultas, búsqueda/selección conservadas en pantalla, errores sin navegación, reintento y confirmación en la página creada. La revisión de ramas y las pruebas SQL/tipos no acreditan DOM, lectores de pantalla ni dispositivos reales. Los fixtures se retiran al finalizar; los scripts y pruebas reproducibles permanecen en scripts/ y tests/.

No se agregaron migraciones, dependencias, permisos reales, cambios de proveedor ni automatizaciones. Sin publicar, desplegar o subir a GitHub. C10 solo cierra su implementación funcional/automatizada, no E7 ni CI remota/infraestructura/visual. R2/R3/R5 continúan separados.
