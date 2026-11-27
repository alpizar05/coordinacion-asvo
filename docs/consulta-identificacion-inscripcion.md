# Consulta inmediata de identificación en la inscripción pública

26/11/2026. Implementación exclusivamente local, sin publicación ni cambios en beta.

## Comportamiento

Al completar nueve dígitos se espera 250 ms para evitar consultas durante correcciones rápidas. Debajo del campo se anuncia «Buscando identificación…», luego el nombre con una marca verde o «No encontramos esta identificación en el registro de personas voluntarias. Revisá los 9 dígitos». Los errores de conexión o límite tienen un mensaje distinto: no se afirman identificaciones inexistentes cuando falla el servicio.

Al cambiar la cédula se oculta el resultado anterior. La limpieza del efecto invalida respuestas tardías y cancela consultas todavía no iniciadas. El campo mantiene teclado numérico, máximo nueve dígitos y pegado que elimina caracteres no numéricos. Los datos recordados también activan la consulta; el nombre no se agrega a localStorage/sessionStorage. La consulta no mueve el foco ni abre un modal. Los mensajes usan una región polite/atomic vinculada por aria-describedby, y el campo recibe aria-invalid cuando no existe la identificación, sin sustituir errores de envío.

La consulta no impide enviar: la inscripción mantiene su validación autoritativa, sus mensajes de póliza y persona inexistente, modal de recepción, cupos/espera, auditoría y notificaciones. No acredita elegibilidad ni cobertura por mostrar un nombre.

## Frontera de servidor y privacidad

`lookupRegistrationIdentity` en app/public-actions.ts delega a lib/registration-identity.ts (server-only). Valida tipos, UUID y nueve dígitos. Revalida convocatoria abierta y fecha límite, o invitación vigente; una invitación solo permite consultar la persona invitada. Conserva la regla existente de acceso por enlace directo a convocatorias no listadas. Devuelve exclusivamente el nombre completo: no correo, identificación adicional, UUID de persona, datos de póliza ni información médica.

Presupuestos propios de consulta en attempts: 300 por red confiable y 30 por identificación por ventana de 15 minutos. Sin IP confiable se aplica el presupuesto compartido por convocatoria. Solo se confía en la dirección del ingreso Vercel ya validada por el proyecto. Claves HMAC, separadas de los intentos de inscripción: no se consume el presupuesto de enviar. Esto limita abuso, no garantiza impedir enumeración distribuida. La exposición pública del nombre fue expresamente solicitada; cualquier ampliación de datos exige revisar ese alcance.

## Verificación ejecutada

- Node 26.13.1/npm 11.7.0 mediante scripts/local-env.zsh.
- 108 unitarias existentes correctas.
- Prueba del consumidor real con hooks/IO simulados: ocho/nueve dígitos, espera, respuestas fuera de orden, nombre, inexistente, rechazo, eliminación del resultado al modificar y pegado. Comprueba contrato de teclado/descripción ARIA; no equivale a DOM real ni lector hablado.
- Integración public-registration en PostgreSQL 18.7 nuevo y desechable: formato malformado/File, nombre, inexistente, ausencia de póliza sin ocultar nombre, salida cancelada/vencida, invitación válida/ajena/vencida, presupuesto propio y ausencia de nuevas inscripciones, mensajes, auditoría y enlaces. Regresión del grupo completo: revisión/espera, edición/cancelación/promoción y duplicados; red externa bloqueada, rollback y eliminación de la base.
- TypeScript/typegen, lint, contratos (74 acciones/handlers) y compilación aislada con HTTP/cabeceras correctos. El build no usa Graph ni base de aplicación.
- PDP real ficticia servida por Next en localhost:3047, HTTP 200, campo numérico y región aria-live presentes. No es verificación visual ni prueba de interacción browser.

El primer initdb fue bloqueado por sandbox; se repitió autorizado. El fixture necesitó corregir flexible=false y el token de prueba al formato vigente de 43 caracteres; no se relajaron las reglas de producción para pasar pruebas.

CUA no pudo iniciar por error de sesión «unknown or expired node_repl continuation». Quedan pendientes inspección visual desktop/celular, interacción nativa/teclado, lectores hablados y dispositivos físicos. No se afirman verificados por el harness ni por HTTP.

## Reproducción aislada

```sh
source scripts/local-env.zsh
node --import ./tests/registration-identity/register.mjs --test tests/registration-identity/consumer.test.mjs
node tests/registration-identity/fixture.mjs
```

El fixture inicia un clúster propio 18.7 en 55530 y ejecuta el grupo protegido public-registration en otra base temporal; después sirve una copia ficticia en 3047. No lee .env ni credenciales de proveedores. Al detenerlo con SIGINT/SIGTERM retira aplicación, clúster y active.json. Las respuestas del consumidor se simulan; los casos SQL prueban el servicio con reglas reales.

## Ajuste de espaciado — 27/11/2026

Campo, ayuda y resultado se agrupan en un contenedor con separación de .35rem y párrafos sin márgenes. Se evita sumar el gap de 1rem del fieldset y los márgenes nativos de cada párrafo. El cambio queda limitado a este campo; mantiene región accesible, mensajes y separación del resto del formulario. Verificación estática y prueba del consumidor, sin nueva comprobación visual CUA. Sin publicación.
