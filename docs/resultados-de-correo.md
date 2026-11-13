# Intentos de correo, aceptación e incertidumbre

## Garantía y vocabulario

Microsoft Graph `sendMail` devuelve `202 Accepted` sin un cuerpo con identificador del mensaje. Esto expresa aceptación para procesamiento, **no entrega** al destinatario. Ver [contrato de sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0). La aplicación no promete entrega exactamente una vez.

Se conserva el nombre `sent_at` por compatibilidad: representa aceptación registrada, no prueba de recepción. El contador `sent` del worker/cron conserva el mismo contrato; cuenta aceptaciones confirmadas durante esa ejecución, no entrega. Reparar una proyección previa no incrementa ese contador. `failed` cuenta fallos de los intentos procesados en esa ejecución, no la cantidad total de correos pendientes de revisión.

No se cambian plantillas, destinatarios, generación/deduplicación transaccional de notificaciones, cron, autorización del cron ni permisos de Graph. Continúa usándose únicamente `sendMail`, con `Mail.Send`. No se crean borradores ni se leen buzones mediante nuevos permisos.

## Flujo durable

`registration_mail_outbox.delivery_state` indica `pending`, `reserved`, `sending`, `accepted`, `uncertain` o `cancelled`. Cada reserva crea una fila independiente en `registration_mail_attempts` antes de hablar con Graph.

| Evidencia | Intento | Cola y recuperación |
| --- | --- | --- |
| Error antes de iniciar sendMail, incluida autenticación inválida | `rejected` | Pendiente; reintento seguro con demora mínima de cinco minutos |
| Respuesta explícita 4xx, excepto 408 | `rejected` | Pendiente; 429 respeta Retry-After, con mínimo cinco minutos y máximo 24 horas |
| Respuesta 202 | `accepted` | Primero se confirma la evidencia; después se proyecta `sent_at` |
| Timeout, excepción de transporte, 408, 5xx o respuesta inesperada | `uncertain` | Revisión; no reenvío automático |
| Reserva abandonada antes de marcar el despacho | `rejected` | Reintento posterior; no hubo sendMail iniciado por ese intento |
| Reserva abandonada después de marcar el despacho | `uncertain` | Revisión conservadora, incluso si el proceso cayó antes de llamar a Graph |
| Destinatario `.test` o recordatorio ya no vigente | `cancelled` | Sin autenticación ni envío |

La aceptación se confirma en una transacción distinta de la proyección de `sent_at`. Si falla esta última, el siguiente worker completa el marcador desde la evidencia y no llama a Graph. Si se pierde el acuse de COMMIT de la evidencia, su estado aceptado no se degrada. Si toda escritura posterior al 202 falla, la marca de despacho que ya existía impide un reenvío; el vencimiento deriva a revisión.

Las transacciones son cortas y no mantienen filas bloqueadas durante autenticación o envío. El worker exige una conexión raíz, no una transacción ajena: un intento todavía no confirmado en PostgreSQL no sirve como garantía durable frente a una caída del proceso. Los productores confirman la notificación y después invocan el worker.

Cada intento tiene reserva de cinco minutos y UUID propio. El worker conserva el máximo de 30 reservas por ejecución y la ventana de 22 segundos requerida antes de iniciar otra operación Graph; conserva los timeouts de 8 segundos de autenticación y 12 de envío. La recuperación no envía mensajes. Dos workers no reclaman a la vez la misma fila; un mensaje anterior sin resolver bloquea los posteriores **de su inscripción**, aunque otro worker salte su bloqueo. Otras inscripciones pueden continuar.

## Referencias y privacidad

La bitácora registra UUID de intento/`client-request-id`, `request-id` de Graph si es UUID, número, estado, código operativo fijo, estado HTTP y tiempos. El UUID del intento se añade como cabecera `x-asvo-mail-attempt` del mensaje. Son referencias de correlación, **no claves de idempotencia de Graph** ni identificadores de entrega.

No se copian destinatarios, cuerpo, HTML, asunto o enlaces privados a la bitácora o a su inventario. No se registran tokens, secretos, cuerpos de error de Microsoft ni excepciones sin filtrar. El contenido necesario para el envío sigue en el outbox existente. Los logs `[mail-outcome]` contienen solo ID de correo, UUID de intento y resultado; `[mail-review]` informa cuántas reservas se derivaron a revisión.

## Consulta y resolución explícita

```sh
# Usa .env.local; solo lectura, sin Graph ni recuperación implícita:
npm run mail:review
# Con variables ya inyectadas por un operador autorizado:
node scripts/mail-review.mjs
```

El inventario muestra hasta 100 resultados que requieren revisión/recuperación, sin contenidos personales. También muestra aceptaciones pendientes de proyección y reservas vencidas; ejecutar el worker normal recupera esos casos automáticamente. Los inciertos requieren una decisión humana. No se agregó una pantalla administrativa ni avisos nuevos; el cron puede finalizar sin nuevos fallos aunque aún haya mensajes inciertos. Revisar periódicamente el inventario es una tarea operativa explícita.

1. Consultar ID de correo y UUID del intento observado. Esperar al vencimiento de su reserva antes de resolverlo.
2. Con las herramientas que el operador ya tenga autorizadas, revisar el buzón remitente usado por ese despliegue, sus enviados/cabeceras y, cuando corresponda, el seguimiento de mensajes de Exchange. Consultar la [guía de seguimiento de mensajes](https://learn.microsoft.com/en-us/exchange/monitoring/trace-an-email-message/message-trace-modern-eac). La aplicación no adquiere permiso de lectura por este procedimiento.
3. Buscar evidencia positiva vinculada al intento. Un mensaje ausente en una consulta, el paso del tiempo o un timeout **no prueban que no fue aceptado**. Un `request-id` por sí solo tampoco prueba entrega. La revisión es una declaración del operador, no una comprobación automática de Microsoft.
4. Elegir una decisión con el intento exacto. No modificar `retry_at` o `sent_at` manualmente para eludir la revisión.

Ejemplo ficticio de aceptación comprobada; `evidence` es el UUID de la referencia de seguimiento/expediente donde el operador conserva la evidencia, no un token ni una URL privada:

```sh
npm run mail:review -- --mail=123 --attempt=11111111-1111-4111-8111-111111111111 --decision=accepted --actor=operador-01 --reason=acceptance_evidence --evidence=22222222-2222-4222-8222-222222222222 --apply
```

Marca aceptación con fuente `review`, desbloqueando los avisos siguientes. No se afirma entrega al destinatario.

Si no se puede comprobar el resultado y es necesario reintentar, se debe reconocer explícitamente el riesgo de duplicado:

```sh
npm run mail:review -- --mail=123 --attempt=11111111-1111-4111-8111-111111111111 --decision=retry --actor=operador-01 --reason=duplicate_risk_acknowledged --apply
```

Autoriza una nueva reserva del **mismo mensaje**, sin crear otra notificación ni enviar desde el comando de revisión. El worker habitual revalida `.test` y recordatorios; no se saltan esas protecciones. Un intento anterior aún podría haber sido aceptado. Incluso esperando el vencimiento, no hay transacción distribuida con Graph y un reintento manual podría duplicar el correo.

Alternativa para no reenviar y liberar la secuencia:

```sh
npm run mail:review -- --mail=123 --attempt=11111111-1111-4111-8111-111111111111 --decision=cancel --actor=operador-01 --reason=cancel_after_review --apply
```

Las resoluciones requieren acceso operativo autorizado a PostgreSQL. No son Server Actions públicas ni conceden permisos a Coordinación. Se registra operador, decisión, código de motivo, evidencia y fecha. Repetir exactamente una resolución es inocuo; otra resolución para ese intento o una decisión sobre un intento desactualizado se rechaza. No se elimina la evidencia histórica de un intento incierto al autorizar reintento.

## Migración 0003 y publicación futura

`0003_mail_attempt_outcomes.sql` es aditiva y transaccional. Conserva contenido, destinatarios, enlaces, intentos históricos y fechas. Los mensajes con `sent_at` quedan aceptados; los cancelados permanecen cancelados. Los pendientes sin intentos siguen pendientes. Los pendientes con intentos anteriores se ponen en revisión con código `legacy_untracked`, porque el esquema anterior no permite distinguir aceptación, rechazo y timeout. La migración no llama a Graph, genera avisos ni despacha la cola. Se verifica repetición sin duplicados mediante el ejecutor numerado.

**Antes de publicar:** planificar una ventana sin workers antiguos (incluidos despachos inmediatos, procesos `--watch` y cron), revisar plan, aplicar 0003 y desplegar el worker nuevo antes de reanudar. Un worker antiguo no entiende la cuarentena y podría reenviar. Tampoco hacer rollback del worker antiguo con mensajes inciertos activos sin detener previamente esos despachos y revisar la cola. La migración no se ejecuta durante build/inicio. No se modificó la beta en esta etapa.

## Pruebas

- `npm run test:unit:coverage`: clasificación conservadora, referencias permitidas, demora y revisión explícita. La cobertura de reglas puras no representa cobertura global de la plataforma.
- `npm run test:integration -- --only=mail-outcomes`: base local desechable y adaptador Graph real con transporte falso. Fallo de `sent_at` tras aceptación, acuse de COMMIT perdido, fallo total al persistir resultado, timeout, 503 ambiguo, 429 y autenticación, reservas vencidas, dos workers, orden, revisiones simultáneas/repetidas, `.test`, presupuesto y límite de 30.
- `schema-migrations`: base existente con intentos históricos, conservación de datos, cuarentena sin envíos y repetición sin duplicados.
- Contratos sin DB para `.test`, rechazo de worker dentro de transacción y token inválido; regresión de plantilla y cron, sin modificaciones a esos contratos.

No hay correos reales, consultas a Exchange/Graph reales ni datos de beta en las pruebas. El runner retira bases y fixtures al terminar.

Resultado de verificación de esta etapa: TypeScript y compilación correctos; 83 unitarias y 16 grupos de integración correctos, más los tres contratos/inventario. Cobertura del subconjunto explícito de 32 módulos puros: líneas 100 %, ramas 96,48 %, funciones 99,48 %. No es cobertura de la plataforma ni del worker SQL. Migración y fixtures se aplicaron exclusivamente en bases locales desechables, luego retiradas. En la publicación posterior autorizada se verificó Neon sin correos pendientes ni reservas vigentes y sin workers manuales, se aplicó 0003 y se publicó el worker nuevo. La migración no despachó correos.
