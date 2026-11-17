# Etapa 3: feedback de ActionModal

16 de noviembre de 2026. Base 2a1dc5f993e0187c3677915ab48d56d3fed6b986. Implementación local de la [auditoría de utilidades](auditoria-utilidades-formularios.md), sin publicación.

## Cambio y garantía

Seguía pendiente la comprobación duplicada de la rama de fallo. El único cambio de producción sustituye esa expresión por `feedback.showErrors(result.fieldErrors,result.error)`, después de checkedFormResult y dentro de `result.saved !== true`.

checkedFormResult rechaza respuestas ausentes, malformadas, errores vacíos y éxitos contradictorios con un error general útil. Un fallo aceptado exige error general no blanco o al menos un mensaje de campo no blanco; ambos pueden coexistir. useFormFeedback.showErrors admite undefined con sus defaults existentes. Por ello no hace falta repetir en el consumidor la búsqueda de errores ni otro fallback. Un error general vacío/blanco con campos válidos sigue mostrando esos campos; no se cambia la normalización.

FormResult, checkedFormResult y useFormFeedback **no se modificaron**. Se agregó una unitaria de la garantía sobre 35 combinaciones de errores generales/campos ausentes, vacíos, blancos, útiles y malformados. Complementa los casos negativos existentes, sin sustituirlos. Los fixtures de tipos existentes ya rechazan void, strings, Promise<unknown>, saved truthy y callbacks síncronas y comprueban productores reales/wrappers; se ejecutaron sin ampliaciones redundantes.

La comparación del diff de producción confirma que no cambian catch, inFlight, pending/finally, dirty, apertura local/controlada, fieldset, archivos, foco/ARIA, cierre, éxito, router.refresh/push ni navegación. fieldErrorMessages conserva su import porque se usa en la validación del cliente. Sin any, casts nuevos, helpers, estilos, acciones, permisos, SQL, notificaciones o migraciones nuevos. PhotoDialog y las comprobaciones de link/id/status/destinos no se tocaron. La frontera no valida esos payloads especializados por analogía.

## Verificación automática

Node 26.13.1 y npm 11.7.0 oficiales temporales, entornos limpios sin dotenv ni credenciales de aplicación. Pasaron:

- `npm run ci:typecheck`: Next typegen y TypeScript en copia limpia, incluidos contratos negativos y productores de ActionModal.
- `npm run test:unit:coverage`: **108 pruebas**, cero fallos. 39 módulos declarados: líneas 100 %, ramas 96,77 %, funciones 99,56 %. No es cobertura global ni de React.
- `npm run test:contracts`: inventarios de fronteras/autorización, compatibilidad y contratos Auth.js/correo simulados.
- `npm run lint`: 355 archivos en la comprobación final; `npm run format:check` en su alcance configurado y `git diff --check`.
- `npm run test:security:build`: Webpack aislado, HTTP/cabeceras/Auth.js/cron no autorizado e import DB desde cliente rechazado. Sin base de aplicación ni proveedores.

No se necesitó PostgreSQL ni se ejecutó integración SQL: el cambio es de presentación de una respuesta ya validada, no de operación o persistencia.

## CUA ejecutada

Se amplió el harness existente tests/action-modal/fixture.mjs y fixture-page.jsx con respuestas adicionales (general+campos, vacía, null y campo malformado) y una variante de navegación. ActionModal, CoordinationModal, feedback y CSS son reales; las acciones son funciones ficticias JS que actualizan un contador, sin SQL ni efectos externos. No se modificaron ni retiraron snapshots anteriores.

La copia temporal incluye una ruta permitida bajo Coordinación, layout de prueba sin autenticación, proveedor/restorer y NavigationResults reales sobre una lista ficticia larga. Esta variante comprueba conservación de criterios/posición, **no certifica las consultas, permisos o listados de negocio completos**. El contador de guardados observa navigationSaved, no commits.

[Registro de 62 observaciones](../tests/action-modal/browser-results-stage3.json), [captura desktop](../tests/action-modal/evidence/stage3-desktop.png) y [captura móvil](../tests/action-modal/evidence/stage3-mobile.png).

| Modo / viewport | Evidencia |
| --- | --- |
| Local, desktop 1440 × 900 | General+campos, varios mensajes, corrección independiente, campos ocultos, general, undefined, vacía, null, malformada, string, truthy, contradictoria y rechazo. Datos y archivo conservados; sin evento de éxito |
| Controlado, desktop | General+campos, resumen hacia campo oculto y misma matriz de fallos generales/estructurales. Apertura externa y conservación de datos/archivo |
| Local, móvil 390 × 844 | General+campos, revelado/foco, general, undefined, malformada, contradicción y rechazo; conservación de archivo y segundo dato |
| Controlado, móvil | General+campos, campo oculto y matriz de fallos generales/estructurales. Intentar cerrar con cambios pide confirmación; Seguir editando conserva datos |

En los cuatro modos se probó doble clic con respuesta demorada, controles deshabilitados, recuperación y reintento válido. Contador: local desktop llamada 13 demorada y 14 válida; controlado desktop 24 → 25 demorada y 26 válida; local móvil 32 → 33 demorada y 34 válida; controlado móvil 44 → 45 demorada y 46 válida. Solo los cuatro resultados válidos emitieron guardado UI y cerraron. La confirmación controlada se observó como «Guardado controlado confirmado.».

Los cuatro éxitos conservaron URL (estado/pestana) y desplazamiento observado antes de guardar: 1995,5 / 2183 / 2085 / 2142,5px respectivamente. Ante errores, foco en el primer campo o resumen general, sin restauración que lo sustituya. Resumen navegable abre la sección oculta; corregir el segundo dato conserva errores del primero. aria-invalid/describedby apuntan a IDs existentes. Modal de 576px desktop y 358px móvil, sin overflow horizontal.

Tab/Shift+Tab/Escape ejercitados en ambos viewports y modos; cierre limpio devuelve foco al botón. En el límite nativo, IAB puede dar BODY/chrome como foco; el siguiente Tab volvió a Cerrar y el árbol AX mantuvo solamente el diálogo. No es certificación de trampa personalizada ni de anuncio hablado. La observación de Escape durante el intento demorado no certifica su timing: el registro contiene un aviso de descarte además de controles deshabilitados; no se deduce que Escape haya quedado bloqueado. El comportamiento de CoordinationModal no se modifica en esta etapa.

## Límites y limpieza

El archivo ficticio preparado.txt se seleccionó mediante file chooser y el valor del input permaneció tras errores y reintentos en los cuatro modos. No se inspeccionaron bytes ni se realizó una carga real. No hay pruebas nuevas de fotos.

Las respuestas del harness son simuladas. Una respuesta rechazada/malformada solo demuestra que la UI no confirma éxito: una operación real podría haber hecho commit antes de perder su respuesta. No se promete ausencia de efectos, idempotencia global o entrega exactamente una vez. Las pruebas postcommit de Agregar/Editar son evidencia separada de su propia etapa.

CUA requiere sesión interactiva; no se presenta como CI autónomo. Lectores de pantalla hablados, dispositivos físicos, otros motores, listados completos y recorridos multinivel permanecen pendientes. La rama destination no cambió y no se ejecutó una nueva navegación con destino desde este harness. CI remota, R2/compatibilidad, R3/sesión, R5/idempotencia, infraestructura y retención siguen independientes.

Servidor/copia UI y runtime temporales retirados; evidencia ficticia y pruebas reproducibles conservadas en el proyecto. Sin beta, proveedores, correos, cargas reales, workflows, publicación ni GitHub.

## Auditoría posterior: evidencia nueva

16 de noviembre de 2026. Se leyeron AGENTS, guía instalada de Next, auditoría de utilidades, implementación y diff completo. **Sin hallazgos funcionales adicionales ni correcciones de código de producción necesarias.** Esta revisión añade documentación y evidencia separada; los resultados anteriores de esta página son históricos de la implementación, no se sustituyen por los nuevos.

### Equivalencia comprobada

La comparación textual exacta con la base 2a1dc5f verifica que ActionModal solo cambia la expresión de feedback. Es el único archivo modificado bajo app/lib. Conserva íntegramente la llamada previa a checkedFormResult, la discriminación saved, catch, inFlight, pending/finally, dirty, apertura local/externa, fieldset, confirmación y navegación. FormResult, checkedFormResult, useFormFeedback, PhotoDialog, payloads especializados, estilos, acciones y servicios no cambian. No se añaden any, casts ni contratos.

La garantía es de la **frontera runtime**, no de toda instancia tipada como FormResult: el tipo permite el estado inicial vacío; checkedFormResult lo rechaza al enviarlo. Todo fallo retornado normalmente por el validador tiene error general no blanco o mensajes de campos útiles. Las excepciones inesperadas de la acción o del procesamiento continúan en catch. Por ello consumir directamente sus dos propiedades conserva el feedback; undefined usa los defaults ya existentes de showErrors.

Las pruebas unitarias existentes permanecen completas y se agregó únicamente la comprobación de 35 combinaciones. Los cambios del harness amplían opciones/ruta y envuelven su JSX; conservan los casos originales y wrappers. No hay pruebas/snapshots eliminados ni contratos negativos debilitados. El fixture de tipos de ActionModal coincide con la base. No se simularon reglas SQL para afirmar equivalencia de negocio: la evidencia es que esas reglas no cambian, no una nueva ejecución SQL.

### Comprobaciones repetidas

Node 26.13.1/npm 11.7.0 temporales oficiales, sin dotenv ni credenciales; SHA256 del archivo de Node: `aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735`.

- ci:typecheck: copia limpia, typegen y fixtures de tipos aprobados.
- test:unit:coverage: 108 aprobadas, cero fallos; los mismos 39 módulos y cobertura 100 % líneas / 96,77 % ramas / 99,56 % funciones. Sin extrapolar a React.
- test:contracts: inventarios de autorización/fronteras/compatibilidad y contratos externos simulados aprobados.
- lint: 356 archivos en la revisión final; format:check en su alcance configurado y diff --check aprobados.
- test:security:build: Webpack aislado y comprobaciones HTTP/cabeceras/Auth.js/cron/server-only aprobadas; sin base de aplicación ni proveedores.

No se requirió PostgreSQL ni se ejecutó integración SQL. No se ejecutó CI remota.

### CUA nueva, no reutilizada como ejecución

[75 observaciones nuevas](../tests/action-modal/browser-results-stage3-audit.json), [captura desktop](../tests/action-modal/evidence/stage3-audit-desktop.png), [captura móvil](../tests/action-modal/evidence/stage3-audit-mobile.png). Se ejecutó nuevamente el harness con ActionModal real y acciones ficticias, proveedor de navegación real y lista sintética. Archivo nuevo auditoria.txt, exclusivamente ficticio. La evidencia anterior browser-results-stage3.json y sus capturas permanecen intactas.

En **cada combinación** local/controlado × desktop 1440 × 900/móvil 390 × 844 se repitieron both, fields, hidden, general, missing, empty, null, malformed, legacy, truthy, contradictory y throw: modal abierto, feedback útil, datos/archivo conservados, sin incremento del contador de éxito. General y varios errores de campo coexisten. Se comprobó además resumen hacia el segundo campo oculto; corregir ese campo conserva el error del primero. Los IDs referenciados por aria-describedby existen y los controles inválidos mantienen aria-invalid. Sin desbordamiento horizontal.

Los cuatro dobles clics demorados sumaron una sola invocación: local desktop 13 → 14; controlado desktop 27 → 28; local móvil 42 → 43; controlado móvil 57 → 58. Controles pendientes deshabilitados y recuperados después. El reintento saved fue respectivamente 15/29/44/59; solo esos cuatro resultados cerraron y confirmaron. No se produjo un reenvío automático.

URL y desplazamiento se conservaron en cada éxito: 2138 / 2183 / 2085 / 2142,5px. Los errores enfocaron campo o resumen, sin sustituir el foco por restauración. Modo controlado: cerrar con cambios pide descarte y Seguir editando conserva datos. Cierre limpio devuelve foco al disparador.

Tab/Shift+Tab/Escape se repitieron en los cuatro modos. En el límite, IAB devuelve BODY/chrome; el siguiente Tab volvió a Cerrar en todos. Se conserva ese límite explícito: no es certificación de trampa personalizada o lector de pantalla. Un intento de abrir otro modal inmediatamente después del primer éxito se reobservó al terminar la restauración antes de continuar; no se tomó la acción intentada como prueba de apertura hasta verificar el diálogo correcto.

### Límites y seguimiento conservados

La selección del archivo se verificó por el valor retenido del input, no por sus bytes. Las acciones son respuestas UI simuladas: no hubo commits, envío ni almacenamiento externo. Que la UI rechace una respuesta no garantiza ausencia de commit en una operación real; esta auditoría no reproduce fallos postcommit ni promete idempotencia global.

No se ejecutaron navegación destination nueva, consultas/listados de negocio completos, recorridos multinivel, lectores hablados, dispositivos físicos o otros motores. El timing de Escape pendiente no se certificó de nuevo. Permanecen los pendientes institucionales, de infraestructura, CI remota, R2/R3/R5 y matriz visual real. No se marcan completos mediante este harness. Copia UI, servidor, archivo y runtime temporales retirados; sin publicación, beta, cargas, correos ni workflows.
