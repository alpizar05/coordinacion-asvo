# E2 — Contratos de enlaces privados del 70

Fecha: 13 de noviembre de 2026. Implementación/verificación local, sin publicar, desplegar ni subir a GitHub. Complementa [C05/C06 del inventario](inventario-contratos-heredados.md) y reutiliza FormResult como en [E1](contratos-informe-70.md). No migra fotografías, decisiones de inscripción, portada destacada ni ActionModal.

## Contratos y consumidores

- [generateStaffBrief/revokeStaffBrief](../lib/staff-communications.ts) declaran resultados FormResult. Ya no devuelven string de error ni void de éxito. Denegación de permiso/recurso y selección desactualizada son errores generales; las excepciones de persistencia siguen abortando la transacción.
- [generateBrief](../app/actions/communications.ts) devuelve BriefLinkResult, alias de `FormResult<'lead',{link:string}>`: el enlace es obligatorio únicamente en éxito. Se comprueban conjuntamente los formatos independientes de recurso y selección: recurso inválido como error general y lead inválido junto al selector. No hay otros campos editables que justifiquen errores inventados. La ausencia de 70 confirmado/asignado en la consulta actual se conserva como conflicto general.
- revokeBrief devuelve FormResult también cuando el UUID es inválido, sin el retorno silencioso anterior. La revocación no tiene campos editables: permisos, inexistencia y conexión se mantienen generales.
- Ambas acciones solo revalidan después del commit y saved === true. Los errores no incluyen link ni destination y no producen redirects. Las excepciones de conexión/persistencia se traducen en mensajes generales seguros; no se exponen consultas, tokens o respuestas de proveedores.
- El [adaptador del resumen](../app/coordinacion/salidas/[id]/resumen/actions.ts) conserva nombres y argumentos y retorna los tipos precisos. Sigue teniendo consumidores verificados en las suites authorization y brief-contracts; no se retira por carecer de consumidores JSX.
- [PrivateLinkForm](../app/coordinacion/private-link-form.tsx) requiere saved estrictamente true y enlace no vacío antes de onGenerated/navigationSaved. Una respuesta sin confirmación/mensajes recibe un error general visible. Conserva selección, estado pendiente, busy, feedback y foco. La rama de invitación comparte este guard, pero su servicio/contrato/reglas no se migraron ni se cambió su formato de identificación.
- [ShareBrief](../app/coordinacion/salidas/[id]/resumen/share-brief.tsx) ya no interpreta una promesa resuelta como revocación: solo marca revoked y muestra ribbon tras saved === true. Ante error conserva el enlace y su visibilidad, permite reintentar y mantiene el mensaje general. Limpia la confirmación anterior al iniciar una revocación y el error anterior tras una generación correcta.

No se agregó un sistema de resultados paralelo ni se amplió FormResult. La comprobación de éxito es explícita, no depende del texto del error. Se mantienen endpoints, nombres/argumentos de acciones y formato de URL privada. Los callers antiguos que ignoran el retorno exitoso siguen pudiendo esperar la promesa; los consumidores activos y adaptadores revisados ya reciben el resultado explícito.

## Reglas conservadas

**Autorización.** Se usan las mismas políticas briefs.generate/briefs.revoke por unidad/recurso y la misma sesión staff; un rol de Administración por sí solo no concede Coordinación. La autorización vuelve a comprobarse con la unidad actual bajo bloqueo de salida. No se cambiaron grants reales ni se extrajeron políticas de sesión en esta etapa.

**Generación.** Solo estados abierta, confirmada o completada; persona con inscripción confirmada en esa salida y assigned70. El token aleatorio se conserva; PostgreSQL guarda su digest. La vigencia sigue siendo el default de siete días. En una misma transacción se revocan los enlaces anteriores de esa persona, se inserta el nuevo y se audita. No se revocan los de otros 70 de la salida. El enlace se prepara antes de la transacción para que una configuración inválida no deje una generación persistida sin poder construir su respuesta.

**Revocación.** Conserva el alcance de todos los enlaces de esa salida, no solo el de una persona. Update y auditoría son atómicos bajo bloqueo; las otras salidas permanecen intactas. Si no había enlaces activos, la petición válida sigue devolviendo éxito y creando la auditoría existente. No se agrega un estado no-op global ni se elimina esa auditoría.

**Concurrencia y reintentos.** El bloqueo actual serializa operaciones de una salida. Dos generaciones válidas para el mismo 70 siguen siendo dos reemplazos válidos: solo el último enlace queda activo. No se introduce una clave de idempotencia ni se promete que generar dos veces conserve el mismo token. El busy del formulario evita doble envío local. Un fallo previo al commit no consume un nuevo enlace ni revoca el anterior, por lo que se puede reintentar. La revocación repetida conserva su semántica auditada. No se promete exactamente una vez frente a pérdida de respuesta después del commit.

**Selección desactualizada.** Esta familia no tiene un parámetro version del editor; no se inventó uno ni una migración. Se volvió a probar el caso equivalente aplicable: el mismo lead previamente mostrado ya no tiene assigned70 o inscripción confirmada, o pertenece a otra salida. La decisión se basa en la consulta actual bajo bloqueo y vuelve como conflicto general.

**Otros efectos.** Generar/revocar enlaces no envía correo ni crea recordatorios. Cola, plantillas, cupos, espera, pólizas, estados e informes no se modificaron. El grupo nuevo verifica que no aparezcan filas de correo/demo por estas operaciones.

## Verificación ejecutada

Entorno temporal Node **26.13.1**, npm **11.7.0** y PostgreSQL **18.7**, consultado antes de crear fixtures. Distribuciones oficiales con los SHA256 registrados en [la validación de runtime](validacion-node26-postgres18.md); compilación local PostgreSQL sin instalación global. Clúster nuevo y loopback 127.0.0.1:55491. Sin dotenv privados, base habitual ni credenciales beta.

| Comprobación | Resultado |
| --- | --- |
| npm run ci:typecheck | Next typegen/TypeScript en copia limpia, sin .env ni .next previos. |
| npm run test:unit:coverage | 96 casos; 36 módulos puros explícitos: 100 % líneas, 96,60 % ramas, 99,54 % funciones. No mide SQL/React ni implica cobertura nueva unitaria de estos servicios. |
| npm run test:contracts | Cinco inventarios/contratos, 73 acciones/handlers en 24 archivos; compatibilidad y fronteras preservadas. |
| npm run test:ci | Siete checks, incluido registro de brief-contracts en el manifiesto; workflow sigue manual. |
| npm run test:integration:ci -- --only=brief-contracts | Nueva suite específica con DB desechable y acciones/servicios/políticas reales. |
| npm run test:integration:ci | 19 grupos completos; incluye regresión de E1, permisos, cupos, cola, fotos y migraciones. |
| npm run test:security:build | Webpack/arranque HTTP aislados, headers/Auth.js/cron no autorizado y rechazo server-only; sin proveedores/base de aplicación. |
| lint / format:check / diff | Alcance configurado comprobado; sin estilos nuevos y enlaces locales verificados. |
| npm run security:secrets | Sin hallazgos ni fallos sobre 380 archivos publicables e historial local disponible; informe saneado. |

[scripts/test-brief-contracts.mjs](../scripts/test-brief-contracts.mjs), registrado en el runner existente, no sustituye reglas de negocio. Solo simula Next/Auth.js/transporte; SQL, políticas y acciones se ejecutan realmente. Verifica:

1. Formatos de recurso/lead inválidos, errores simultáneos general+campo, UUID válido inexistente y selector vacío.
2. Sin sesión, admin sin Coordinación, unidad ajena, persona de otra salida, no asignada o en espera, y estados no permitidos. Sin cambios de enlaces/auditoría ni revalidación.
3. Payload de enlace válido, acceso privado y vigencia cercana a siete días; reemplazo por persona sin afectar al segundo 70.
4. Selección desactualizada tras retirar assigned70, sin reemplazar el enlace anterior.
5. Fallo sintético de auditoría después de las escrituras de generación/revocación: rollback completo de enlaces y auditoría; el enlace anterior sigue válido. Reintento correcto después de retirar el fallo.
6. Dos generaciones concurrentes: ambas confirman su operación y solo la última conserva acceso, sin enlaces activos duplicados para ese 70.
7. Revocación de toda la salida, acceso de otra salida intacto, repetición sin enlaces activos y auditoría del no-op conservada.
8. Conexión de aplicación cerrada: error general sin link, destino o revalidación; una conexión observadora a la misma DB reservada comprueba ausencia de cambios.
9. Cero correo adicional y cero fetch externo. Los snapshots comparan filas reales; no basta con igualar respuestas entre dos delegaciones.

## UX y límites pendientes

No se ejecutó una nueva matriz visual CUA desktop/celular. Por lectura del flujo se conserva el formulario montado, la selección, busy/pending, resumen de errores/foco y navegación existente; no se presenta esa inspección como prueba visual. No se añadieron resets, router.push/refresh, almacenamiento de tokens o cambios de filtros/pestaña/posición. En generación sigue usándose el hook de feedback que prioriza el foco del error; revocar sigue siendo un botón sin campos.

Pendiente CUA: selección inválida con foco, conflicto general conservando selección y contexto, enlace previo visible después de fallar generación/revocación, reintento correcto, ribbon solo en éxito, teclado y móvil. También siguen pendientes CI remota, contenedor Linux e infraestructura/proveedores. Turbopack adicional no se repitió aquí; su verificación existente se conserva, Webpack es la referencia usada en esta etapa.

No hay migraciones nuevas ni cambios de proveedor. El runner retira sus DBs y triggers sintéticos. Limpieza final comprobada: consulta SQL de versión 18.7 y cero bases de fixtures; servidor detenido, clúster/binarios/fuentes/logs temporales retirados y copias de tipos/build eliminadas por sus ejecutores. E2 queda implementada y verificada a nivel funcional/automatizado local; el pendiente visual no cierra E7 ni autoriza publicar.
