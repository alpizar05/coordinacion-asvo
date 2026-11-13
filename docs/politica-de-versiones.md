# Política de versiones de ASVO

Fecha: 13 de noviembre de 2026. Alcance local y CI preparada; no cambia proveedores ni autoriza publicación.

| Componente | Referencia | Tratamiento |
| --- | --- | --- |
| Node.js | 26.13.1 local/CI | Versiones efectivas de padre/hijos y npm comprobadas. Vercel configurado en 26.x; build observado 26.13.1; parche de funciones no comprobado. |
| npm | 11.7.0 | packageManager y CI coherentes; instalación limpia sin scripts validada. |
| PostgreSQL | 18.7 | Integración local desechable; imagen CI oficial por digest. No implica verificar Neon de nuevo ni Ubuntu/contenedor. |
| Next.js | Rama 16.x, parche 16.4.5 | Dependencia exacta en package.json, especificación raíz y paquete resuelto del lockfile coherentes. |
| Compilador | Webpack | Referencia del build Vercel informado por el usuario. Turbopack es comprobación adicional. |

## Soporte y actualizaciones

La [política oficial de Next.js](https://nextjs.org/support-policy) consultada enumera 16.x como Active LTS. El soporte corresponde a la rama mayor, no a un interruptor del proyecto ni a una promesa de mantener cualquier parche antiguo. La [opción --webpack](https://nextjs.org/docs/app/api-reference/cli/next) selecciona el compilador; no activa LTS.

16.4.5 es la versión instalada/resuelta que ya pasó la validación local con Node 26.13.1 y PostgreSQL 18.7. Cambiar ^16.4.5 por 16.4.5 restringe futuras resoluciones, sin actualizar el binario ni paquetes transitivos. No se afirma que sea el parche más reciente disponible. El lockfile sigue siendo obligatorio con npm ci.

Para cada actualización futura:

1. Consultar releases y avisos de seguridad oficiales, soporte de la rama y requisitos de Node/React/Auth.js; registrar el candidato y los cambios relevantes. Atender con prioridad los avisos de seguridad aplicables.
2. Revisar AGENTS y la documentación de la versión instalada/candidata. Mantener los flujos y evitar actualizar dependencias ajenas sin necesidad demostrada.
3. Actualizar el pin exacto y regenerar el lockfile con el npm seleccionado, en entorno aislado sin credenciales beta. Revisar el diff, incluyendo dependencias transitivas; sin force ni legacy-peer-deps.
4. Verificar instalación limpia sin scripts, sharp, tipos, lint/formato, unitarias/cobertura, contratos/CI, integración SQL con proveedores simulados y build/arranque Webpack. Conservar además el build Turbopack. Repetir los recorridos CUA afectados antes de afirmar equivalencia visual.
5. Documentar evidencia, riesgos y pendientes; publicar/desplegar solo con autorización explícita. Una actualización de rama mayor requiere evaluación separada. No habilitar actualizaciones, workflows o despliegues automáticos en esta tarea.

El contrato de CI compara el pin exacto de Next con el paquete resuelto y el instalado, y mantiene las pruebas de build existentes. `npm run build` se conserva; Vercel ya selecciona Webpack mediante su comando informado. No se modificaron engines, configuración del proveedor ni scripts de despliegue.

## Evidencia y límites

Ver [validación Node 26/PostgreSQL 18](validacion-node26-postgres18.md): ambos compiladores ya se verificaron con Next 16.4.5, incluyendo Webpack/HTTP aislado. Esta tarea solo fija la versión que estaba instalada y documenta el mantenimiento; no actualiza Next ni repite la matriz visual. Los contratos CI, lint y formato se comprueban después del pin. Primera CI remota, contenedor Ubuntu y matriz CUA permanecen pendientes.

Comprobación posterior al pin: siete controles CI pasaron con Node 26.13.1/npm 11.7.0; lint y formato del alcance configurado también pasaron. No se repitieron integración SQL ni builds porque no cambió el paquete instalado ni código funcional. El runtime temporal se retiró; el Node global permanece intacto.
