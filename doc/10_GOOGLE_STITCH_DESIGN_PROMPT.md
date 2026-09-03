# 10 — Paquete de diseño para Google Stitch

**Estado:** Listo para uso  
**Versión:** 1.0.0  
**Fecha:** 2026-08-08  
**Responsable:** Diseño de producto  
**Decisión de marca:** `DP-001A`

## 1. Fuente operativa

El material que debe alimentarse a Google Stitch está organizado en:

```text
stitch-input/
```

Esa carpeta es autónoma y no requiere comprimir archivos ni cargar la documentación interna completa. Incluye:

- instrucciones de uso;
- prompt maestro listo para copiar;
- `DESIGN.md` compatible con el formato de Stitch;
- contexto funcional mínimo y seguro;
- inventario de pantallas por lotes;
- contenido, estados y microcopy;
- checklist de aceptación;
- prompts de seguimiento;
- referencias visuales de la marca aprobada.

La entrada vigente es `stitch-input/01_PROMPT_MASTER_STITCH.txt`. Este documento no debe copiarse entero en Stitch.

## 2. Cambio respecto de la versión anterior

La versión 0.1 trataba nombre e identidad como provisionales. Esa instrucción queda anulada por `DP-001A`:

- producto: **Yanti**;
- dominio: **yanti.app**;
- master: **B Organic**;
- paleta: **A11 Cyan-Turquoise + Coral**;
- modos claro y oscuro incluidos desde el sistema base;
- assets oficiales ubicados en `brand/`.

Stitch no está autorizado a explorar ni rediseñar nombre, isotipo, wordmark, paleta o cruces. El paquete usa imágenes raster como contexto para Stitch; los masters de implementación continúan siendo los SVG de `brand/svg/`.

## 3. Estrategia

Stitch permite trabajar con lenguaje natural e imágenes, agregar texto/código/archivos de diseño al canvas y usar `DESIGN.md` como sistema portable. Por eso la estrategia vigente es:

1. cargar primero `DESIGN.md`;
2. agregar documentos de contexto acotados;
3. agregar las cinco imágenes de referencia;
4. pegar el prompt maestro;
5. aprobar el sistema y seis pantallas de referencia;
6. continuar por lotes con revisión entre cada uno;
7. exportar a Figma/desarrollo solo como candidato sujeto a revisión.

Fuentes oficiales:

- [Google Labs — Stitch AI-native design canvas](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/)
- [Google Labs — real-time design updates](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/)
- [Google Labs — DESIGN.md](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/)
- [Google Labs — DESIGN.md specification](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)
- [Google Developers — Introducing Stitch](https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/)

## 4. Guardrails

- Usar solo datos sintéticos.
- No subir documentación interna completa, PII, evidencia real, credenciales o datos productivos.
- No aceptar accesibilidad por apariencia: revisar WCAG 2.2 AA manualmente.
- No aceptar código exportado como producción sin revisión.
- No permitir que Stitch invente políticas, porcentajes, plazos, países o monedas.
- Mantener participantes y administración separados.
- No autorizar pagos, emails o despliegues reales; el trabajo corresponde a releases locales.

## 5. Resultado esperado

Un candidato de diseño consistente con la marca oficial, responsive, ES/pt-BR, claro/oscuro, accesible y suficientemente documentado para implementar primero en local. No resuelve decisiones legales, financieras o de lanzamiento aún pendientes.

## Registro de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 0.1.0 | 2026-08-07 | Brief original con identidad provisional. |
| 1.0.0 | 2026-08-08 | Marca Yanti aprobada; paquete autónomo, DESIGN.md, referencias visuales y proceso por lotes. |

