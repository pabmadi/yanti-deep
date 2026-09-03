# Yanti — Web app local (DEMO-1)

MVP local navegable de **Yanti**, la plataforma de compraventa protegida entre particulares.
Implementa el ciclo completo de una operación + disputa con resolución administrativa,
100% en local, siguiendo los releases R00–R02 de `doc/09_RELEASE_STRATEGY.md`
(sin servicios externos, sin credenciales: pagos, correo y archivos simulados).

## Después de reiniciar la PC (arranque rápido)

**Doble clic en `C:\Yanti-Deep\web\iniciar-demo.bat`** y esperá el mensaje "Ready".
Abrí **http://localhost:3100**.

Ese archivo hace todo: siembra la demo, genera los magic links en el buzón y levanta
el servidor. La primera compilación tarda ~30 s; después responde rápido.

### Manual (si preferís la terminal)

```bash
cd C:\Yanti-Deep\web
node start-demo.mjs        # siembra + magic links + dev server en :3100
```

### Si el navegador dice que no puede conectar

1. Asegurate de que el `.bat` siga abierto y muestre `✓ Ready`.
2. Si cerraste la ventana, la app se apagó: volvé a ejecutar el `.bat`.
3. Si el `.bat` avisa que el puerto está ocupado por un proceso viejo:
   `netstat -ano | findstr :3100` → anotá el PID de la derecha →
   `taskkill /PID <ese-numero> /F` → volvé a ejecutar el `.bat`.

## Requisitos

- Node.js **>= 24** (usa el `node:sqlite` nativo; no requiere compilar binarios).

## Puesta en marcha (primera vez)

```bash
cd web
npm install --include=dev      # la primera vez
```

> Importante: si tu Windows tiene `NODE_ENV=production` global, ejecuta dev con
> `NODE_ENV=development` o la app se comporta como producción.

```bash
# 0) Atajo: todo en un comando (siembra demo + magic links + dev server)
node start-demo.mjs 3100

# ... o paso a paso:
# 1) Inicializar DB con la demo guionizada (4 operaciones en distintos estados)
npx vitest run tests/demo-reset.test.ts

# 2) Generar magic links para las cuentas demo (aparecen en el buzón local)
npx vitest run tests/gen-links.test.ts

# 3) Levantar el servidor de desarrollo
npx next dev -p 3100
```

Abrí **http://localhost:3100**.

## Recorrido de la DEMO-1

Desde `/ingresar` usá **Acceso rápido a la demo** o entrá con el correo:

| Identidad | Correo | Rol |
|---|---|---|
| Ana | `ana@demo.yanti` | Vendedora |
| Leo | `leo@demo.yanti` | Comprador |
| Operaciones | `ops@demo.yanti` | Admin (consola) |

El "correo" es un **buzón local** en `/dev/buzon`: los magic links se "envían" ahí.

1. **Como Ana** (vendedora): ves 4 operaciones demo — la cámara **COMPLETED** (liberada),
   el parlante **REEMBOLSADA** (disputa), el teclado **en camino** y el monitor **pendiente de pago**.
2. Creá una **nueva solicitud** (botón destacado) → se envía al comprador.
3. **Como Leo** (comprador): abrí el teclado en camino y **confirmá la recepción** → se libera el
   dinero al vendedor (COMPLETED). También podés abrir un **reclamo** desde una operación.
4. **Como Operaciones** (admin): consola con pagos por reconciliar, bandeja de disputas,
   detalle con ledger de doble entrada, resolución (liberar / reembolsar / exigir devolución)
   y **auditoría** append-only.

El pago es un **proveedor simulado** (`/pagar/fake`): el retorno del navegador jamás acredita
(`RF-PAG-002`); la acreditación llega por "webhook" simulado + **reconciliación** desde la consola
admin, tal como exige la documentación.

## Comandos útiles

```bash
npm run typecheck          # tsc --noEmit
npm test                   # vitest (flujo completo de dominio, 7 tests)
npx next build             # build de producción
```

Tests que tocan la DB local (correrlos **sin** el dev server activo para evitar locks):

- `tests/demo-reset.test.ts` → resetea y siembra la DEMO-1.
- `tests/gen-links.test.ts` → genera magic links para el buzón.
- `tests/flow.test.ts` → verifica el flujo completo (usa la DB por defecto y la resetea).

## Arquitectura (resumen)

```
src/
  domain/        # Núcleo puro: money (unidades menores), fees, máquinas de estado SM-*, errores ERR-*
  data/          # SQLite (node:sqlite), schema, repositorios, outbox/auditoría/idempotencia
  server/        # Casos de uso (comandos/consultas), auth (magic link), policy, tick de vencimientos
  app/           # Páginas Next.js (dashboard, detalle, disputas, admin, buzón)
  ui/            # tokens de marca, componentes, i18n ES
```

El dominio es independiente de la UI. Todo efecto "externo" sale por outbox; los vencimientos
(expiración, recordatorios, liberación automática) corren en un tick in-process con reloj inyectable.
