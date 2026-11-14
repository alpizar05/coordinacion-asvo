# Contratos de fotografías: preparación y persistencia

Etapa E3 (C03/C04), 14 de noviembre de 2026. Continúa [ActionModal y wrappers](contratos-action-modal.md). Sin publicación, cambios en beta, correo ni cargas reales.

## Hallazgo y cambio

PhotoDialog tenía tres consumidores activos: Nueva convocatoria, OutingEditor y AttachPhotos. Los dos primeros devolvían void al preparar datos en memoria y strings ante un límite; AttachPhotos devolvía void después de persistir. El diálogo interpretaba esas formas como cierre. Se migraron conjuntamente todos sus callbacks.

Ahora `PhotoDialogProps` exige un alcance explícito:

- `operation="prepare"`: devuelve `PhotoPreparationResult`, con `prepared: true` únicamente cuando la foto o sus metadatos se incorporan al estado del formulario. No afirma persistencia ni muestra confirmación global.
- `operation="persist"`: devuelve el `FormResult` existente; solo `saved: true` confirma persistencia. AttachPhotos retorna ese resultado, y solo entonces actualiza navegación, selección y franja de éxito.

La distinción local es necesaria: no se amplió FormResult ni se creó un sistema de errores paralelo. PhotoPreparationResult reutiliza su rama de fallo. `checkedPhotoResult` aplica la frontera compartida y rechaza void, strings, estructuras ambiguas y éxito del alcance equivocado. No interpreta mensajes. Las pruebas de tipo negativas impiden volver a introducir esos callbacks.

PhotoDialog sigue usando FormField, FormErrorSummary y useFormFeedback. Un fallo no ejecuta el cierre ni reinicia archivo/metadatos; conserva modo, selección y errores. El resumen/foco mantiene prioridad sobre navegación, que solo se marca guardada tras persistencia. No se cambiaron estilos, pestañas, filtros ni restauración contextual.

## Frontera de persistencia (C04)

Se retiraron el cast estructural de errores y el filtro por prefijos en español de photo-actions. PhotoMutationError identifica fallos públicos controlados: campos de validación o problema general. Los fallos desconocidos usan un mensaje seguro, sin exponer SQL/Graph. Los errores de selección inexistente apuntan a photoId; permisos sobre el origen son generales. Los límites totales y conflictos siguen siendo generales.

La acción reutiliza validatePhoto para devolver conjuntamente archivo, descripción, crédito, autorización o selección inválidos antes de preparar bytes; el servicio mantiene su validación autoritativa. Galería conserva el comportamiento heredado de usar metadatos de origen cuando no se suministran. No se agregaron restricciones de producto.

PhotoUploadError distingue validación de archivo de fallo de proveedor. Este último es general en attachOutingPhoto, createOuting y saveOutingEdit. La acción de adjuntar conserva todas las entradas de archivo en lugar de seleccionar solo la primera. Sus identificadores se proyectan al único control photo del diálogo; los editores largos conservan las claves por fotografía.

Se conservaron autorización antes de bytes/Graph, fases de preparación/carga/commit, versión y revalidación transaccional, idempotencia, bitácora, compensación de huérfanos, protección de archivos compartidos, herencia, portada y seis fotos. No se movieron efectos al interior de bloqueos SQL. No hay cambios de esquema, proveedor, endpoint ni redirect; managePhoto conserva su compatibilidad HTTP y no se retiró sin evidencia de consumidores ausentes. Otros helpers/decisiones no se migraron.

## Verificación local

Runtime: Node.js 26.13.1 y npm 11.7.0; PostgreSQL 18.7 desechable UTF-8; Next.js 16.4.5 Webpack. Los archivos oficiales se verificaron por SHA-256. Las bases se validan por destino loopback y nombre desechable antes de escribir, y se retiran al finalizar.

- 101 pruebas unitarias: frontera de preparación/persistencia, respuestas mal formadas, campos independientes y fallos generales; reglas existentes sin regresiones. Cobertura de 37 módulos explícitos: líneas 100 %, ramas 96,74 %, funciones 99,55 %. No es cobertura global de React/SQL.
- TypeScript en copia fresca, incluyendo `tests/types/photo-dialog-contract.ts`: rechaza void/string, persistencia falsa en preparación y preparación como resultado persistido.
- 19 grupos de integración completos en PostgreSQL UTF-8, incluidos photo-uploads, outing-forms, outing-editor, autorización y regresiones de correo/estados.
- Contratos estáticos, ocho pruebas de CI, lint y compilación aislada Webpack/HTTP/server-only. La primera invocación HTTP fue bloqueada por el sandbox; se repitió con autorización local. No se repitió Turbopack.

La suite photo-uploads amplía la evidencia con la Server Action real: errores múltiples, archivo ilegible conservado, ausencia de sesión, selección inválida, commit de galería y repetición sin duplicados, rollback ante fallo de auditoría sin invalidación/éxito y reintento correcto, origen sin permiso como error general. El workflow real usa Graph simulado para rechazos, timeouts ambiguos, cambio concurrente, compensación y referencias compartidas; no llama al proveedor real.

## Limitaciones y seguimiento

No se ejecutó una nueva matriz visual CUA de PhotoDialog en esta etapa. Siguen pendientes desktop/celular: preparación de nueva foto, edición de metadatos, galería, límite, archivo retenido ante error, foco en cada campo y regreso contextual tras persistencia. La CUA de ActionModal anterior no demuestra estos recorridos. No se certifican lectores de pantalla ni dispositivos físicos. No presentar las pruebas de frontera puras como pruebas del DOM.

Se detectaron dos ajustes del entorno de prueba, sin modificar reglas del producto: el archivo oficial Node incluye una versión npm distinta y se seleccionó npm 11.7.0; el primer clúster SQL_ASCII falló en la prueba existente de nombres acentuados y se recreó como UTF-8 antes de repetir la suite. Mantener estas condiciones al reproducir.

E3 funcional/automatizada solo se cierra con las suites documentadas; la matriz visual queda explícitamente pendiente. E4/E5, compatibilidad restante E6 y auditoría E7 conservan su seguimiento.
