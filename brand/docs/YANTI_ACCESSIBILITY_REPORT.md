# Yanti — informe de accesibilidad cromática

**Versión:** 1.0  
**Fecha:** 2026-08-08  
**Objetivo:** WCAG 2.2 AA para la interfaz de producto.

## Conclusión

La combinación A11 cyan-turquoise + coral funciona bien como identidad visual en claro y oscuro. Sin embargo, sus colores puros no alcanzan contraste AA como texto normal sobre blanco. Por eso se separan los **colores de marca** de los **colores funcionales accesibles**.

## Contrastes verificados

| Uso | Primer plano | Fondo | Ratio | Resultado |
|---|---:|---:|---:|---|
| Texto principal claro | `#292426` | `#FAF8F3` | 14.39:1 | AAA |
| Texto inverso | `#FAF8F3` | `#242833` | 13.87:1 | AAA |
| Cyan de marca sobre blanco | `#02C3C3` | `#FFFFFF` | 2.19:1 | Solo identidad/gráfica |
| Coral de marca sobre blanco | `#FC6B5D` | `#FFFFFF` | 2.84:1 | Solo identidad/gráfica |
| Cyan de marca sobre carbón | `#02C3C3` | `#242833` | 6.73:1 | AA/AAA según tamaño |
| Coral de marca sobre carbón | `#FC6B5D` | `#242833` | 5.19:1 | AA |
| Acción primaria clara | `#006B70` | `#FFFFFF` | 6.29:1 | AA |
| Acción coral clara | `#9E352F` | `#FFFFFF` | 6.99:1 | AAA |
| Éxito | `#157A4F` | `#FFFFFF` | 5.35:1 | AA |
| Advertencia | `#8A5A00` | `#FFFFFF` | 5.93:1 | AA |
| Error | `#B42318` | `#FFFFFF` | 6.57:1 | AA |
| Información | `#2457C5` | `#FFFFFF` | 6.47:1 | AA |

## Reglas obligatorias

1. No usar `#02C3C3` ni `#FC6B5D` como texto normal sobre blanco o `#FAF8F3`.
2. No comunicar éxito, advertencia, error o estado de una operación solo mediante cyan/coral. Agregar icono y etiqueta textual.
3. Mantener foco visible con un anillo mínimo de 2 px y separación suficiente del componente.
4. Usar el isotipo monocromo cuando la reproducción a color pierda legibilidad.
5. El logo se considera contenido de marca, pero sus aplicaciones interactivas deben tener nombre accesible (`aria-label="Yanti — inicio"`) y foco visible.
6. Para 16 y 24 px usar exclusivamente B-Micro.

## Daltonismo y escala de grises

El símbolo conserva su lectura por la geometría entrelazada y no depende de que el usuario identifique cada cinta por nombre de color. Aun así, los colores de marca nunca deben representar dos estados opuestos. La variante monocroma es la alternativa para contextos de baja fidelidad, impresión simple y fondos problemáticos.

