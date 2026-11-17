# Revisión local de modales y paneles de Coordinación

16 de noviembre de 2026. Cambios acotados de presentación e interacción; sin beta, SQL, proveedores, correo, cargas ni publicación. Se preserva la actualización previa de PhotoDialog.

## Resultado y decisiones

No se reprodujo otra familia completa con botones amarillos/negros como el antiguo PhotoDialog. Los contenedores revisados ya heredan `.coordination-content`: principal verde, secundarias blancas y destructivas rojas. Se conservaron las advertencias amarillas, la navegación pública y las variantes de cada dispositivo. No se cambió la paleta global ni se creó otro sistema de componentes.

| Hallazgo confirmado | Origen y corrección mínima | Alcance |
| --- | --- | --- |
| Gestionar → cancelar/detalle/volver dejaba el foco en body | RegistrationActions comunica el paso seleccionado a RowActionPanel. Un efecto enfoca su encabezado solo si el panel sigue abierto y el foco quedó en body; no reemplaza foco de errores ni mueve el scroll | Consumidor real de inscripciones, desktop/celular. Series no tiene estos pasos y no requiere otro estado |
| Formulario de gestión conservaba borde/padding de fieldset ajenos a los formularios modales | Regla acotada a registration-sheet + coordination-modal-form-fields, con border/padding/margin 0 y min-width 0 | Formularios del panel; campos ajustados al ancho. No cambia controles de páginas públicas |
| Encabezado y X podían desalinearse al envolver contenido | Encabezado de panel sin wrapping, texto flexible, X de 44px y misma escala del cierre modal | Panel móvil. Desktop compacto sigue sin X; detalle ampliado conserva su excepción deliberada |
| Seguir editando desmontaba el aviso sin recuperar foco | CoordinationModal guarda el control que abrió el aviso y lo recupera con preventScroll; encabezado como respaldo | Contenedor compartido, sin recrear formulario/archivo |
| Descartar/seguir editando seguían habilitados si se guardaba con el aviso abierto | Ambos botones ahora respetan pending, igual que cerrar/cancelar/submit | No cambia dirty, catch, inFlight, finally ni el contrato del guardado |

El encabezado compartido es programáticamente enfocable. El diálogo nativo puede tomarlo como foco inicial; se verificó que Tab avanza a controles y que el resumen de errores conserva prioridad. No es una implementación de trampa de foco propia.

## Inventario activo y cobertura

[Inventario AST actual](../tests/coordination-panels/inventory.json), parser TypeScript instalado de Prettier. Cuenta sitios JSX de imports y diálogos nativos, no demuestra que cada rama haya sido abierta. Se revisaron también createPortal, estilos inline, selectores globales, variantes, imports de consumidores y reglas efectivas en navegador. No se retiraron interfaces, adaptadores o código sin uso visual.

| Componente / usos JSX | Consumidores | Decisión y comprobación |
| --- | --- | --- |
| ActionModal 5, CoordinationModal 10 | Fichas, unidades, registro, recordatorios, agrupaciones y editores | Conservar paleta y distribución actuales; corregir descarte/foco compartido. Harness real de formulario largo: errores, pendiente, archivo, descarte y éxito simulado |
| RowActionPanel 2 | RegistrationActions y CollectionsTable | Homologar campos/encabezado y corregir foco de pasos. Ambos consumidores reales abiertos, decisiones ficticias en el primero |
| RegistryModal 2 | Póliza y conciliación | Conservar wrapper; póliza con validación real y datos ficticios, cinco errores independientes. Conciliación completa permanece estática |
| TableFilters 7 | Resumen, salidas, series, solicitudes, voluntariado, inscripciones y selector de serie | Conservar inline desktop y modal móvil; componente y filtros reales de series abiertos |
| MobileDisclosure 3 | Transporte, alimentación, resumen | Conservar details desktop y diálogo móvil; contenido ficticio de logística ejercitado |
| SummaryViewSelector 1 | Resumen | Modal compacto móvil y opciones inline desktop actuales; sin cambio funcional |
| ReportReminder 2 | Resumen e inscripciones | Vista previa real con datos ficticios en ambos tamaños; sin ejecutar envío |
| PhotoDialog 5 | Adjuntar/editor/nueva salida | Ya actualizado: no repetir cambios. Evidencia propia en actualizacion-modal-fotos.md; esta etapa solo afecta su contenedor compartido |
| PrivateLinkForm 2 | Invitación y enlace del 70 | No es un modal autónomo: formulario con contrato especializado. Inspección estática; no se alteró ni ejecutó generación |
| Drawer 3 (toda app) | Menú global/Coordinación y portal público | Variante lateral deliberada, fuera de sustitución general. Inspección estática, no nueva matriz completa del menú |

No equivale a abrir todas las rutas autenticadas de informes, permisos, importación, incidentes, conciliación y editores. Sus componentes/consumidores se inventariaron; los flujos completos mantienen pendientes separados.

## Evidencia de navegador

CUA IAB: 1440×900 y 390×844. Componentes reales en copias Next desechables, con respuestas de servidor/callbacks ficticias y guard de red. Sin credenciales ni base disponible. El modo anterior usa HEAD 3e0a187 para CoordinationModal/RowActionPanel/CSS; conserva el mismo harness.

- [Panel desktop antes](../tests/coordination-panels/evidence/before-desktop.png) / [después](../tests/coordination-panels/evidence/after-desktop.png).
- [Panel móvil antes](../tests/coordination-panels/evidence/before-mobile.png) / [después](../tests/coordination-panels/evidence/after-mobile.png).
- [Series móvil](../tests/coordination-panels/evidence/series-mobile.png), [recordatorio móvil](../tests/coordination-panels/evidence/reminder-mobile.png), [descarte bloqueado](../tests/coordination-panels/evidence/pending-mobile.png).
- [13 mediciones finales corregidas, con AX](../tests/coordination-panels/verified-results.json).
- [Registro inicial y lecturas independientes](../tests/coordination-panels/browser-results.json).

Se detectó un error en el helper de mediciones inicial: capturaba la pestaña anterior. Sus lecturas DOM posteriores a los cuatro casos baseline fueron descartadas explícitamente, no se usan como prueba. Las capturas y lecturas independientes de archivo, ARIA y rectángulos pertenecían a la pestaña correcta. Se repitieron mediciones críticas con el handle explícito, guardando URL, viewport y AX. También se corrigieron en el harness una variante RegistryModal inválida, un callback de revelado faltante y el nombre del doble loadEditableRegistration; no son correcciones de producto.

Resultados verificados:

- Menú desktop de 304px sin X; panel al pie móvil con X, sin overflow horizontal observado. Los pasos reciben H2 como foco cuando el control anterior desaparece; error posterior recibe el campo Motivo. Volver, Escape y retorno al disparador conservados.
- Campos y secundarias blancos, principal verde, destructiva roja. La referencia pública mantuvo exactamente fondo amarillo #ebe544 y texto/borde oscuros en lecturas independientes antes/después.
- Error general y múltiples errores por campo juntos; datos y selección de archivo fixture.txt conservados. ARIA-describedby apunta a elementos existentes. Rechazo inesperado muestra error sin cerrar ni éxito.
- Campo oculto revelado mediante el contrato revealField del harness. Su borde inferior quedó visible antes del footer en móvil (695,10 < 743,09px) y desktop (736,95 < 784,81px).
- Doble clic demorado del formulario compartido incrementó de 1 a 2 las invocaciones, no a 3. Todos los botones, incluidos los dos del descarte, deshabilitados; al fallar se recuperaron controles y datos. En gestión de inscripción se observó pending y el guard existente; no hay contador específico nuevo que pruebe idempotencia de servidor.
- Éxitos UI simulados cierran y muestran franja; no demuestran commit ni entrega de mensajes. No se modificaron restauración de contexto, criterios ni consultas; no se repitió la matriz completa lista → detalle → regreso.

## Pruebas y reproducción

Node 26.13.1 oficial (archivo SHA256 aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735), npm 11.7.0. ci:typecheck correcto; 108 unitarias correctas; test:contracts correcto; lint y format:check correctos en sus alcances configurados; test:security:build correcto (Webpack producción/HTTP y aislamiento de servidor). El primer intento HTTP fue bloqueado por el sandbox; se repitió autorizado en copia aislada. No se ejecutó SQL: no hay cambios de reglas o persistencia. Los archivos de aplicación modificados son CoordinationModal, RowActionPanel, su paso en RegistrationActions y CSS acotado; no se modificaron servicios, contratos, acciones, auditoría ni notificaciones.

`node tests/coordination-panels/fixture.mjs` en 3039, `--before` en 3040; esperar data-panels-ready=yes antes de actuar. Requiere CUA, no es CI autónoma. SIGINT/SIGTERM retira la copia. Los dobles sustituyen únicamente los adaptadores de la copia: inscripciones, unidades y recordatorios. La base imposible de loopback y el guard externo permanecen activos.

Límites: una familia de navegador, sin lectores hablados, dispositivos físicos, teclado virtual, zoom exhaustivo, hover/active sostenidos ni matriz completa de permisos/rutas. UX03 (contraste de bordes), CI remota, infraestructura, retención y matriz CUA completa permanecen pendientes. Esta revisión cierra UX04 solo para los pasos reales de inscripción ejercitados; no certifica accesibilidad global ni modifica el resto del producto.

Seguimiento del 17/11: la [auditoría de foco de Gestionar](auditoria-foco-gestionar.md) amplía la cobertura con edición y recordatorios y corrige el reemplazo de foco válido después del guardado. UX03 también tiene [evaluación posterior separada](contraste-controles-coordinacion.md). Las limitaciones anteriores describen la revisión del 16/11.
