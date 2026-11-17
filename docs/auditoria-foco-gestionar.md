# Auditoría de foco de Gestionar — consumidores reales

17 de noviembre de 2026. Solo local, datos ficticios y adaptadores simulados. Sin beta, SQL, Graph, correo, cargas, publicación o workflows. Se preserva el diff anterior de fotos, paneles y contraste.

## Balance y corrección

La corrección previa de RowActionPanel ya funciona: RegistrationActions comunica su paso, y solo se enfoca el encabezado cuando el control anterior desaparece y deja el foco en body. No se repitió esa implementación ni se modificaron RowActionPanel, RegistrationActions, EditRegistration, CoordinationModal o CollectionsTable en esta etapa.

**Sí se reprodujo un problema posterior al guardado de una decisión:** después del cierre nativo, el restaurador de listas podía reemplazar el foco válido de Gestionar por el primer enlace de la fila. El caso mobile-action-success lo registra con la fila de origen y sus marcadores presentes, no con hijos sintéticos aislados.

La única corrección funcional nueva está en app/coordinacion/navigation-position.ts, restoreNavigationPosition: después de restaurar la posición, conserva el elemento enfocado si pertenece a la fila elegida, sigue visible, habilitado y fuera de inert. Si no se cumple, conserva el fallback anterior al primer enlace/botón o siguiente fila. No cambia destino, criterios, selección de fila, vecinos, desplazamiento, prioridad de errores, tratamiento de diálogos ni restauración nativa de Atrás/Adelante.

Es una protección compartida: también puede conservar un foco válido ya presente en la fila de otras listas. No obliga a mantenerlo si la fila desaparece o el control queda oculto, deshabilitado o inerte. Este alcance compartido se verifica por función y en el recorrido real de Gestionar; no equivale a repetir toda la matriz de navegación de la plataforma.

## Inventario y transiciones

| Consumidor activo | Transición | Resultado verificado |
| --- | --- | --- |
| RegistrationActions → RowActionPanel | Abrir con Enter | Encabezado enfocado dentro del menú; compacto desktop sin X, panel al pie móvil con X |
| RegistrationActions → ManageRegistrationForm | Menú → Cancelar inscripción | El botón anterior desaparece; foco al encabezado. Se mantiene dentro del panel |
| ManageRegistrationForm | Error por campo / error general | Motivo recibe el foco al terminar la validación; error general enfoca el resumen. No lo sustituye el efecto de paso |
| ManageRegistrationForm | Demora, doble clic, Escape | Panel permanece abierto, controles bloqueados; error recupera controles y datos. No se interpreta una lectura de body durante pending como el foco final |
| ManageRegistrationForm | Volver | Encabezado de Gestionar recibe el foco; opciones se mantienen operables |
| RegistrationActions → RegistrationDetailPanel | Ver inscripción con carga de 1,8s | Foco en encabezado del detalle durante carga y después de recibir los datos; no se roba al llegar los hijos |
| RegistrationActions | Detalle → Volver | Foco dentro del menú, no en la página |
| RegistrationActions → EditRegistration | Editar inscripción, carga demorada | Solo un diálogo abierto; foco en el encabezado de Editar inscripción. El cierre del panel anterior no lo recupera |
| EditRegistration | Campos / error general / demora | Foco estable en Restricciones alimentarias o resumen, según resultado; fechas/observaciones conservadas. No hay archivos en este formulario |
| EditRegistration | Cancelar, descarte y éxito simulado | Cierre/descarte devuelve foco al Gestionar de la persona disponible; éxito mantiene criterios y posición de origen |
| RegistrationActions → ReportReminder | Abrir recordatorio → Cancelar | Nuevo modal recibe foco; al cerrar vuelve al Gestionar de la persona, en ambos tamaños. No se ejecutó envío |
| RegistrationActions | Guardado de decisión y refresco | Antes: primer enlace de fila podía sustituir el disparador. Después: Gestionar conserva foco en desktop/celular, sin perder filtros |
| CollectionsTable, automática | Abrir/cerrar y copiar | No tiene pasos internos. Copia un enlace localhost ficticio, cierra y devuelve foco al Gestionar de esa serie |
| CollectionsTable, automática | Ver serie pública con Enter | Navegación real de Next a una página pública ficticia local; regreso a criterios preparados. No visita beta ni consulta datos |
| CollectionsTable, manual | Abrir y consultar href; Escape | Mismo menú sin pasos; href /colecciones/manuales/UUID correcto. No se navegó la página manual completa |

Los sitios activos de RowActionPanel siguen siendo RegistrationActions y CollectionsTable. RegistrationActions se consume en Solicitudes, detalle de salida y Resumen; se usa aquí el componente real con estado confirmada y adaptadores de datos ficticios. No se ejecutó cada estado histórico, rol o ruta autenticada. Las diferencias de disponibilidad siguen en el servidor y en los consumidores; no se cambiaron ni se modelaron como permisos nuevos.

## Evidencia nueva y separación de límites

[62 observaciones con URL, viewport, foco, diálogo, controles y AX](../tests/manage-focus/results.json). No son 62 flujos completos independientes: hay capturas de antes del cambio, estados transitorios y verificaciones finales. [Verificador offline](../tests/manage-focus/verify-results.mjs) comprueba campos estables, traspaso de modal, cierre, copia, filtros y foco posterior al refresco.

CUA IAB con 1440×900 y 390×844. Componentes reales: RegistrationActions, ManageRegistrationForm, EditRegistration, StaffParticipationFields, RegistrationDetailPanel, RegistrationDetails, historial, ReportReminder, CollectionsTable y contenedores compartidos. Las respuestas de sus adaptadores son ficticias; el formulario y su validación cliente no fueron sustituidos. Se conservan los proveedores reales de contexto/confirmación con sujeto ficticio y los marcadores de fila/lista del harness.

- [Edición desktop con foco en el error](../tests/manage-focus/evidence/desktop-edit-error.png).
- [Edición móvil, evidencia final](../tests/manage-focus/evidence/mobile-edit-error-final.png).
- [Carga de edición desktop](../tests/manage-focus/evidence/desktop-edit-loading.png) / [móvil](../tests/manage-focus/evidence/mobile-edit-loading.png).
- [Gestión móvil pendiente](../tests/manage-focus/evidence/mobile-pending.png).

Las lecturas inmediatas *fields/*field-error/*general pueden preceder la respuesta y los dos animation frames de feedback. Se repitieron con selectores :focus/aria-invalid y resumen enfocado; usar los casos *-stable y after-fix-* para la conclusión final. Las asociaciones aria-describedby verificadas apuntan a nodos existentes.

El primer harness omitía la fila de origen: algunas lecturas de éxito enfocaban una serie no relacionada; no se usan como evidencia de producto. Se incorporaron los marcadores reales de fila/lista antes de reproducir el defecto del restaurador y verificar su corrección. Otra incidencia inicial del harness conservaba page.tsx junto a page.jsx: la página real se detuvo en validación local de configuración, sin credenciales ni llamadas externas. Se retiró solo de la copia y se reinició tras invalidar el manifest. Estas incidencias se documentan separadas de los hallazgos funcionales.

Los parámetros serieBuscar=Ficticia, serieTipo=automaticas y pestana=inscripciones permanecen después del cierre/guardado verificado. Al probar la variante manual se cambió Tipo explícitamente y luego se restauró; no fue un cambio silencioso. Se registran scrollY y el foco del origen. La prueba de función comprueba que conservar foco no elimina la restauración del desplazamiento. No se afirma cobertura completa de todos los recorridos multinivel por esta muestra.

## Comprobaciones reproducibles

Node oficial 26.13.1 (SHA256 aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735) y npm 11.7.0. Nuevas comprobaciones después de la corrección:

- npm run ci:typecheck: correcto.
- npm run test:unit: 108 correctas, incluida la suite pura aislada de navegación.
- npm run test:contracts: correcto.
- npm run lint: correcto para aplicación, scripts y pruebas.
- npm run test:security:build: compilación Webpack/HTTP y aislamiento de servidor correctos, sin base/proveedores.
- node --import ./tests/manage-focus/register.mjs --test tests/manage-focus/restore-focus.test.mjs: siete pruebas correctas de la función real con adaptador DOM mínimo. Conservación del disparador y scroll; foco externo; fila eliminada/siguiente disponible; control oculto, deshabilitado o inert; restauración sin foco.
- node tests/manage-focus/verify-results.mjs: evidencia local verificada.

Las siete pruebas DOM están separadas de las unitarias puras y no se presentan como navegador real, cobertura global ni un reemplazo de CUA. No requieren red, base o credenciales. No se agregó una abstracción de dominio para probar el guard. No hubo integración SQL nueva: no se modificaron permisos, estados, cupos, versiones, transacciones, auditoría, cola o notificaciones.

`node tests/manage-focus/fixture.mjs` prepara la copia temporal y sirve http://localhost:3043/coordinacion/convocatorias con los criterios de la prueba. Esperar data-manage-focus-ready=yes. El layout de autenticación y los adaptadores se sustituyen solo dentro de esa copia; el guard de red existente y la base imposible de loopback permanecen activos. El enlace público apunta a otra página ficticia de la copia. SIGINT/SIGTERM retira servidor y directorio. No es una suite de CI autónoma: CUA sigue siendo una dependencia.

## Pendientes

No se utilizaron lectores de pantalla hablados, otros motores, dispositivos físicos, teclado virtual, zoom exhaustivo o forced-colors. No se retiró el disparador durante una acción real en CUA: los fallbacks de control/fila desaparecidos se verificaron con la función y su adaptador DOM. La matriz completa de otros listados, los modos de permiso, todos los estados y las rutas de negocio permanecen pendientes. Se conserva la evidencia histórica del 16/11 por separado.

No se probó persistencia de negocio ni ausencia global de efectos tras commit: aquí solo hay respuestas UI simuladas. Los campos de inscripción no contienen archivos; no se extrapola esta prueba a PhotoDialog. No se cambió ningún contrato, regla o integración. Copias, fixtures de ejecución y runtime temporales retirados. Sin publicación, GitHub o beta.
