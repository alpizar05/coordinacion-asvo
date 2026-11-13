# Seguridad: decisiones e infraestructura pendientes

Propuesta del 13 de noviembre de 2026. **Ninguno de estos plazos es una política aprobada ni se ejecuta como limpieza automática.** No se han consultado permisos reales, cambiado grants, rotado secretos ni contactado Graph/Neon/Vercel.

## Retención propuesta para aprobación de ASVO

| Categoría | Propuesta de conservación mínima operativa | Decisión pendiente |
| --- | --- | --- |
| Restricciones alimentarias y datos médicos de inscripción | Durante preparación/participación; revisar eliminación o anonimización a los 90 días del regreso. Acceso restringido a responsables actuales. | Diferenciar necesidades operativas de evidencia de incidente/seguro y definir responsables. No copiar indiscriminadamente a auditoría. |
| Contactos de emergencia en ficha | Mantener mientras la persona esté activa, revisar actualización cada 12 meses; al cierre de ficha evaluar retirar tras 90 días. | Cómo acreditar inactividad, excepciones por incidente y acceso del 70. |
| Auditoría de operaciones | Proponer 24 meses para hechos mínimos (actor, operación, fecha, recurso); separar motivos sensibles y valores previos de logística. | Justificación institucional, requisitos aplicables, acceso, preservación por investigación y anonimización. |
| Tokens/hashes y recibos | Acceso vence según cada capacidad; proponer limpieza de referencias 30 días después del vencimiento/revocación. | Evidencia necesaria de uso/revocación y compatibilidad con historial; borrado no reactiva enlaces. |
| Correo aceptado y bandeja demo | Proponer retirar cuerpos/URLs privadas 30 días después de aceptación, manteniendo metadatos mínimos del intento. | Revisar soporte, duplicados, buzón de Exchange y backups. Aceptado no significa entregado. |
| Correos pendientes/inciertos | Preservar hasta resolución explícita; después aplicar plazo aprobado. | Responsable de revisión y plazo de escalamiento; no borrar evidencia de incertidumbre ni reenviar por antigüedad. |
| Intentos antiabuso | Proponer 7 días para contadores HMAC; conservar agregados anónimos solo si se necesita evaluación. | Periodo de investigación, rotación de clave y efecto sobre correlación. |
| Logs de aplicación/acceso | Proponer 7–30 días según uso, con tokens, URLs privadas y datos personales redactados. | Capacidades del plan del proveedor, soporte y acceso; los logs de borde pueden capturar rutas antes de la app. |
| Fotos, informes y participaciones históricas | Política separada; revisar autorización de uso de imagen y conservar trayectoria con el mínimo de datos personales. | Base institucional, retiro de imagen, archivo histórico y solicitudes de la persona. |
| Respaldos/exportaciones | Caducidad alineada con cada categoría; acceso separado y restauraciones que vuelvan a aplicar supresiones aprobadas. | Plan Neon, SharePoint, ubicaciones, periodicidad y prueba de restauración. |

La política aprobada debe definir responsable, finalidad, plazo, excepciones/retención por incidente, revisión, autorización de ejecución y forma de verificar una eliminación. Requiere evaluar las obligaciones aplicables a ASVO con sus responsables; los plazos anteriores son propuestas operativas, no asesoría jurídica. No se deben convertir directamente en cron.

## Privilegios mínimos de PostgreSQL — documentación, no grants ejecutados

Separar, cuando se prepare infraestructura, al menos identidad de migración y aplicación:

- Aplicación: CONNECT a la base, USAGE al esquema, SELECT/INSERT/UPDATE/DELETE solo en tablas necesarias para sus casos de uso; USAGE en secuencias de identidades cuando corresponda. SELECT FOR UPDATE/SHARE necesita también UPDATE en PostgreSQL. EXECUTE solo sobre funciones utilizadas, revisando privilegios de PUBLIC, search_path y que funciones/vistas mantengan semántica de invocador.
- Aplicación sin SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE, ownership de esquema/tablas, CREATE de objetos, GRANT OPTION ni TRUNCATE. El código de aplicación no migra al arrancar/importar/compilar. Estos son objetivos a comprobar, no afirmaciones sobre la cuenta Neon actual.
- La auditoría necesita INSERT/SELECT; evitar UPDATE/DELETE para la cuenta de aplicación donde los flujos lo permitan. La cola, intentos y referencias de fotos necesitan UPDATE para reservas/estados; no dar únicamente INSERT. Cualquier reducción debe probar todo el SQL antes de aplicarse.
- Migración: identidad propietaria o con derechos DDL específicos sobre objetos mantenidos, acceso a `schema_migrations`/`app_migrations` y bloqueo asesor; usarla solo en mantenimiento. No requiere superusuario por defecto. Los ejecutores de pruebas necesitan crear/eliminar sus bases **solo en PostgreSQL local desechable**, nunca con la identidad de aplicación.
- Configurar privilegios por tabla/secuencia y privilegios predeterminados para objetos futuros según su propietario real. No dar permisos amplios a todo objeto futuro por comodidad. RLS no se incorpora en esta etapa; las políticas de unidad de aplicación siguen siendo necesarias aunque se use RLS después.

Ver [privilegios PostgreSQL](https://www.postgresql.org/docs/current/ddl-priv.html). Pendientes: inventariar grants efectivos, rol propietario, SSL/certificado, pooling, backups y restauración; preparar un script revisable y pruebas con la identidad restringida. **No ejecutar cambios sobre beta como parte de esta revisión.**

## Microsoft Graph y autenticación — sin cambios efectivos

- Archivos: permiso de aplicación `Sites.Selected`, consentimiento y concesión explícita de escritura **únicamente al sitio del proyecto**. La aplicación usa la biblioteca/carpeta configuradas; esa selección no restringe por sí sola al nivel de carpeta si el permiso real abarca todo el sitio. No solicitar Sites.ReadWrite.All/Files.ReadWrite.All para resolver un error de acceso.
- Correo: mantener `Application Mail.Send` de Exchange Application RBAC con un resource scope al buzón autorizado de beta. El remitente no necesita Mail.Read, acceso a todos los buzones ni operaciones sobre borradores. Una asignación Entra amplia paralela puede ampliar permisos: comprobar autorizaciones efectivas, porque RBAC y permisos Entra pueden ser aditivos. En producción se revisará el buzón institucional definitivo mediante una tarea autorizada distinta.
- Entra: aplicación de un directorio, redirect URI web exacta del callback, ID/token de sesión validado y roles internos por `oid` en PostgreSQL. Mantener permisos delegados del login según lo que use el proveedor existente; no agregar acceso a directorio, grupos o correo para la autenticación. No probar credenciales contra Microsoft en esta etapa.
- Secretos solo en entorno de servidor, sin prefijo NEXT_PUBLIC, repositorio, snapshots ni logs. Documentar propietario, vencimiento y procedimiento de rotación/verificación; **no se han rotado ni consultado valores**. Deshabilitar demo en cualquier despliegue remoto.

Referencias oficiales: [permisos seleccionados](https://learn.microsoft.com/en-us/graph/permissions-selected-overview), [RBAC de aplicaciones Exchange](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), [referencia de permisos Graph](https://learn.microsoft.com/en-us/graph/permissions-reference).

## Comprobación posterior de infraestructura

1. Validar configuración offline en el entorno de destino y coordinar migración 0004/despliegue; los controles fallan cerrados si hay variables inválidas. Revisar Preview separado de Production.
2. Verificar login/logout/callback real, cookies HTTPS, tenant esperado y permisos internos con usuarios autorizados; no reutilizar credenciales ficticias de pruebas.
3. Comprobar que Vercel/proxy sobrescriban `x-vercel-forwarded-for`; configurar límite de borde proporcional, especialmente GET de fotos y ataques distribuidos. Medir cuotas sin bloquear redes compartidas.
4. Verificar headers finales del CDN, cache de contenido privado, noindex y redacción de tokens en logs/observabilidad/analytics. No incorporar URLs privadas al seguimiento de errores.
5. Comprobar concesión efectiva de SharePoint y alcance del buzón, sin ampliar permisos para diagnosticar fallos. Revisar PostgreSQL con una cuenta restringida y prueba de restauración aislada.
6. Aprobar retención y después diseñar preview, autorización explícita, exclusiones y pruebas de limpieza; no programarla con los plazos propuestos sin esa decisión.
7. Evaluar CSP estricta con nonces y coste de render dinámico; la CSP parcial actual no certifica protección completa contra XSS.
