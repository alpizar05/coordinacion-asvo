# Plantillas para solicitar cambios de código en ASVO

Estas plantillas remiten a [los lineamientos](lineamientos-implementacion.md). Reemplazar los campos entre corchetes; quitar apartados que no apliquen explicándolo. No son una autorización de acceso remoto ni reglas nuevas de Codex.

## Versión breve: cambio acotado

```text
Implementá este cambio acotado en ASVO:

Objetivo/problema: [qué ocurre y qué comportamiento se necesita].
Pantalla/flujo: [ruta, desktop/celular y actores].
Aceptación: [ejemplos concretos de antes/después, error y éxito].
Permisos: [operación, rol, unidad y recurso; o conservar los actuales].
Alcance/exclusiones: [qué cambiar y qué no].
Entorno/publicación: [por defecto local ficticio; sin beta/proveedores/GitHub/despliegue].

Antes de editar, leé AGENTS.md y la documentación del área, incluidos
los lineamientos de implementación. Revisá código y consumidores existentes:
no des por pendiente una refactorización ya realizada.

Reutilizá contratos, componentes, validadores, políticas y contexto existentes.
Conservá las reglas de negocio y los datos/archivos del formulario al fallar.
No mezcles este cambio con reorganizaciones, dependencias o formato masivos.
Si el patrón actual no sirve, explicá la excepción y elegí la alternativa mínima;
consultá solo decisiones que afecten permisos, datos o comportamiento no definido.

Verificá con pruebas proporcionadas al riesgo y datos ficticios locales.
No envíes correos ni subas archivos reales. Informá lo probado y lo pendiente;
actualizá documentación/TODO cuando corresponda sin marcar controles no verificados.
Entregá cambios, evidencia y límites. No publicar salvo instrucción expresa.
```

Para un ajuste visual basta indicar la referencia visual, estados y viewports esperados; no convertirlo en un refactor general ni exigir nuevas pruebas de negocio sin una razón concreta.

## Versión completa: funcionalidad o módulo nuevo

```text
Implementá [nombre de funcionalidad/módulo] en la plataforma ASVO.

1. Objetivo y contexto
- Problema que resuelve: [...].
- Personas usuarias y recorrido principal: [...].
- Resultado esperado y ejemplos verificables: [...].
- Documentación/decisiones de producto aprobadas: [...].

2. Alcance y aceptación
- Incluye: [...].
- Excluye: [...].
- Flujos de alta, consulta, edición y cierre/eliminación, si aplican: [...].
- Casos de éxito, campos inválidos, acceso denegado y resultados vacíos: [...].
- Versiones/concurrencia/reintentos/respuesta perdida que deben contemplarse: [...].
- Qué datos/reglas actuales deben permanecer compatibles: [...].

3. Autorización y datos
- Operaciones × roles × unidades × recursos: [...].
- Datos públicos, privados y sensibles; quién puede ver cada grupo: [...].
- Modelo existente que debe reutilizarse y relaciones nuevas: [...].
- Reglas de snapshot/herencia e impacto de cambios sobre históricos: [...].
- Borrado, revocación o retención aprobados: [...; si no, no inventarlos].
- Si faltan decisiones críticas, identificarlas antes de implementar escrituras
  dependientes; avanzar mientras tanto en análisis independiente.

4. Integraciones y efectos
- Proveedores/servicios necesarios y alcance aprobado: [... o ninguno].
- Auditoría requerida: actor, evento, recurso y motivo [...].
- Notificaciones/destinatarios/momentos aprobados: [... o ninguna].
- Comportamiento ante rechazo, timeout o resultado incierto: [...].
- No modificar permisos efectivos ni usar proveedores reales durante pruebas.

5. Interfaz y navegación
- Rutas y menú/breadcrumb: [...].
- Tablas desktop/listas móviles; filtros/búsqueda/página/pestaña existentes: [...].
- Modal, secciones o pantalla dedicada y motivo: [...].
- Contexto de regreso/origen, enlaces directos y Atrás/Adelante: [...].
- Errores por campo, resumen/foco, secciones ocultas y datos/archivos al reintentar.
- Confirmación de éxito solo tras commit; accesibilidad/teclado y movimiento reducido.

6. Implementación y compatibilidad
Antes de editar:
- Leé AGENTS.md, README, TODO y docs del área; contrastá código/pruebas/historial.
- Presentá un mapa breve de piezas existentes que vas a reutilizar y decisiones
  pendientes, sin detenerte por elecciones rutinarias ya autorizadas.
- No dupliques componentes/contratos ni rehagas bases ya implementadas.

Usá los lineamientos de docs/lineamientos-implementacion.md:
- Acción de servidor pequeña, caso de uso/consulta concreta, reglas puras compartidas.
- FormResult y validación de servidor; permisos/conexión/conflictos como generales.
- Autorización por operación/recurso y chequeos dentro de cada entrada.
- Estado/auditoría/cola atómicos; bloqueos/versiones e idempotencia según riesgo.
- Efectos externos fuera de locks largos; despacho solo después de commit.
- Fotos/correo/contexto de navegación existentes, con sus protecciones actuales.

Si hace falta esquema, proponé una migración numerada nueva y compatible.
No edites migraciones aplicadas ni ejecutes DDL al arrancar/compilar/importar.
No normalices históricos por suposición ni incorpores seeds/correo implícitos.

Una excepción al patrón debe explicar evidencia, alternativa mínima, consumidores
impactados, compatibilidad y prueba. No crear arquitectura genérica sin necesidad.

7. Verificación y entrega
- Unitarias puras para reglas nuevas/cambiadas; límites e históricos pertinentes.
- Integración local desechable: permisos, relaciones, rollback, concurrencia,
  reintento y ausencia de efectos duplicados según los flujos afectados.
- Proveedores simulados; migraciones desde vacío y esquema anterior si corresponde.
- TypeScript, build y lint/formato dentro de su alcance real.
- CUA/navegador para UI/foco/contexto y desktop/móvil; registrar dependencia y
  limitaciones si no se puede ejecutar. No llamarlo CI autónomo si depende de CUA.
- Cobertura con denominador/exclusiones claros; no inferir cobertura global.
- Retirar fixtures/servidores/copias temporales al finalizar.

Actualizar README, documentación del módulo y TODO; completar solo lo verificado.
Informar cambios, pruebas ejecutadas/resultados, incompatibilidades, migraciones,
pasos operativos y decisiones pendientes. No modificar AGENTS.md ni reglas de Codex.

Restricciones de esta solicitud:
[Por defecto: datos ficticios y DB local aislada; sin acceso beta/proveedores reales,
sin correo/cargas reales, sin cambios de permisos, sin publicar/subir/activar workflows].
Cualquier excepción autorizada se describe explícitamente: [...].
```

No es necesario ejecutar todas las suites por una modificación irrelevante para ellas: justificar las comprobaciones elegidas. Las invariantes afectadas sí deben verificarse; «los tests existentes pasan» no reemplaza demostrar el comportamiento nuevo.

## Ejemplo completo reducido: módulo Lugares, primera etapa

**Ejemplo para preparar una solicitud; no se implementa aquí y no aprueba por sí solo las decisiones de producto siguientes.** Los campos pendientes deben confirmarse antes de usarlo como una orden de implementación.

```text
Implementá la primera etapa del módulo Lugares de ASVO, una vez confirmadas
las decisiones señaladas abajo.

Objetivo:
Mantener fichas reutilizables de ASP, sectores, escuelas y otros lugares,
y permitir asociar una convocatoria a un lugar sin reescribir sus históricos.

Alcance inicial propuesto:
- Lista en Coordinación con búsqueda, ficha de detalle y alta/edición autorizadas.
- Nombre, tipo de lugar, descripción y relación opcional de sector/lugar padre.
- Elegir un lugar al crear una convocatoria; conservar texto libre anterior
  y no migrar lugares históricos por coincidencia de nombre.
- Galería existente como referencia, si se aprueba en esta primera etapa.

Decisiones que ASVO debe confirmar antes de implementar:
- Qué roles/unidades mantienen lugares y cuáles solo consultan/asocian.
- Qué campos son públicos y si ubicación/contactos tienen restricciones.
- Si los cambios del catálogo afectan convocatorias futuras, existentes o ninguna.
- Si una convocatoria guarda snapshot de los datos elegidos o herencia viva explícita.
- Si fotografías y funcionarios se incluyen ahora o en etapas posteriores.
- Qué significa desactivar un lugar y qué impide eliminarlo si está referenciado.
No inferir permisos del nombre de la pestaña ni inventar estas reglas.

Exclusiones propuestas:
No mapas, geocodificación, importación masiva, nuevo proveedor, reportes,
notificaciones ni borrado automático. No implementar todavía funcionarios.

Aceptación una vez aprobadas las reglas:
- Usuario sin permiso no puede crear/editar mediante llamada directa.
- Datos inválidos se señalan juntos, el modal conserva valores y no anuncia éxito.
- Asociación a lugar inactivo/no autorizado se rechaza en servidor.
- Editar un lugar no altera convocatorias históricas fuera del alcance aprobado.
- Dos ediciones concurrentes no se pisan silenciosamente.
- Reintentar un alta cuya respuesta se perdió no duplica el lugar ni su auditoría.
- Lista/ficha conservan criterios y regreso con el contexto compartido;
  entradas directas mantienen navegación habitual.
- Tabla desktop y lista compacta móvil, teclado/foco y estados vacíos consistentes.

Revisá primero catálogo/location, herencia, PhotoDialog/galería, ActionModal,
FormResult, matriz de autorización y navegación existentes. Presentá las piezas
reutilizadas y agregá solo los casos/consultas/operaciones concretos necesarios.
Si se incluyen fotos nuevas, usá el pipeline de carga/compensación existente;
no inventes un uploader ni un sistema global de assets en este módulo.

Usá una migración nueva para relaciones/campos aprobados, manteniendo los textos
históricos. Probar vacío/actualización y personas/roles ficticios con DB local
independiente. No usar Graph, beta, datos reales ni enviar correos.

Actualizar docs/README/TODO con evidencia y límites. No publicar, activar CI,
cambiar permisos reales, AGENTS.md o reglas de Codex.
```

El módulo de funcionarios puede seguir después con relaciones explícitas a Lugares; no corresponde anticipar todos sus campos ni permisos en el primer catálogo.
