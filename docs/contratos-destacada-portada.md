# E5/C07 — Contratos de destacada de portada

14 de noviembre de 2026. Alcance: saveHomepageFeature, su acción HTTP, consumidores y pruebas. Sin publicación, beta ni proveedores reales. Se conservaron los cambios documentales anteriores de C01/C04/C05/C06.

## Cambio y contrato

El servicio de outing-series devolvía string en fallo y undefined en éxito. Ahora declara Promise<FormResult>, devuelve errores generales y saved true explícito tras sus operaciones SQL. La denegación utiliza la misma política series.feature; no depende del texto del mensaje.

setHomepageFeature conserva la Server Action de formulario y su redirect; declara Promise<never>, que representa ese control de navegación, no un resultado de persistencia. Consume FormResult, invalida `/` y redirige con confirmacion únicamente cuando saved === true. Un fallo esperado o excepción devuelve el redirect con destacadaError, sin confirmación ni invalidación. Los mensajes desconocidos de SQL/configuración no se exponen.

UUID/kind inválidos ya no retornan silenciosamente: vuelven a la lista autorizada de convocatorias con error general y ancla destacada. Esa página admite el mensaje en una alerta persistente, no en la franja temporal de éxito. Los destinos válidos mantienen las mismas rutas de salida/serie, parámetros confirmacion=destacada/automatica o destacadaError y fragmento #destacada. No se aceptan destinos externos ni se interpolan IDs inválidos.

No hay controles editables: son dos botones. No se fabricaron errores por campo, resumen de correcciones, modal, motivo ni foco artificial. Se conserva HomepageFeatureControl y el adaptador staff-actions, que tiene ahora un consumidor de prueba explícito. Las diferencias de contratos entre un servicio y un redirect HTTP son legítimas.

## Reglas conservadas

- Política sobre todas las unidades del conjunto de bloques, con denegación para recurso inexistente. Administración sola no concede Coordinación.
- Elegibilidad: al menos un bloque pública/listed, abierta y con cierre igual o posterior a hoy en Costa Rica; deadline ausente usa inicio. La validación sigue en consulta SQL y bajo for share.
- La selección manual individual/serie sigue usando el singleton, sin alterar el algoritmo de portada. Una selección vencida puede seguir almacenada, pero el catálogo vigente determina si se utiliza; el fallback mantiene su orden por inicio más próximo.
- Destacar nuevamente escribe/audita como antes. Retirar solo borra si la referencia coincide; no encontrarla confirma la vuelta al comportamiento automático sin crear auditoría nueva. Retirar otro candidato no elimina la selección actual. No se agrega estado no-op global ni se cambia esta semántica histórica.
- Escritura y auditoría en una transacción. Excepciones abortan y solo después del commit se invalida. No se cambiaron bloqueos ni se agregaron esperas de proveedor.
- No existe versión del formulario en esta familia: se usa la elegibilidad actual bajo bloqueo. Un cambio de estado/plazo/unidad se valida de nuevo; no se inventa un token version ni una migración. Dos comandos válidos concurrentes pueden confirmar y el singleton conserva una selección; no se promete exactamente una vez ni auditoría única frente a reenvío.
- Sin cambios de cupos, inscripciones/espera, herencia, fotos, correo, notificaciones o permisos reales. No se amplió el contrato global ni se migraron otras familias.

Los redirects existentes no conservaban todos los parámetros de edición/navContext y no se redefinieron aquí. Se conserva su comportamiento; no se presenta esta etapa como una nueva implementación de restauración contextual. No hay datos de formulario o archivos que reiniciar en este control.

## Verificación

Node.js 26.13.1, npm 11.7.0, PostgreSQL 18.7 local desechable UTF-8 y Next.js 16.4.5 Webpack. Archivos oficiales verificados por SHA-256; sin dotenv de aplicación/proveedor. El runner valida loopback, versión y nombre reservado de cada base antes de escribir y retira los fixtures al terminar.

- TypeScript en copia fresca, con pruebas negativas en tests/types/homepage-feature-contract.ts: no void/string del servicio y redirect Promise<never> compatible.
- 101 unitarias existentes y cobertura de 37 módulos explícitos: 100 % líneas, 96,74 % ramas, 99,55 % funciones. No mide React ni los servicios SQL; esta familia no se añadió artificialmente al denominador puro.
- Contratos estáticos, ocho controles CI, lint, formato y compilación/HTTP/server-only aislados.
- Integración local: nueva suite homepage-feature-contracts y los 20 grupos completos pasaron; bases y triggers temporales retirados.

El nuevo grupo homepage-feature-contracts usa acción/servicio, SQL y políticas reales; solo Next/Auth.js/petición se simulan. Prueba formatos inválidos con fallback seguro, ausencia de sesión/admin/unidad ajena/recurso inexistente, todos los estados no elegibles, listed/plazo, selección individual y de serie, permiso sobre todos los bloques, repetición/no-op, fallo sintético de auditoría en destacar y retirar, rollback/reintento, comandos concurrentes y conexión cerrada. Exige sin confirmacion ni revalidación en fallos, y ausencia de cambios parciales/correo/red. Las consultas reales de catálogo comprueban exclusión por vencimiento y orden del fallback; no sustituye una prueba renderizada del hero.

## Pendientes visuales y publicación

No se ejecutó una nueva matriz CUA desktop/celular. Pendiente comprobar alerta/fragmento, estado del botón tras error/reintento, confirmaciones temporales, conservación contextual y hero con selección manual/automática. No se presenta TypeScript, SQL o compilación como evidencia DOM, teclado, lectores de pantalla ni dispositivos físicos.

No se repitió Turbopack. Primera CI remota y verificaciones de infraestructura siguen separadas. Sin migraciones, cambios de proveedores, publicación, despliegue ni subida a GitHub. E5 queda completa a nivel funcional/automatizado con la integración verificada; la matriz visual permanece en E7.
