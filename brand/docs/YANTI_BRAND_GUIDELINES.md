# Yanti — manual esencial de marca

**Master oficial:** B Organic  
**Paleta:** A11 Cyan-Turquoise + Coral  
**Versión:** 1.0  
**Aprobación:** 2026-08-08

## 1. Idea de marca

Yanti facilita acuerdos seguros entre dos personas. El isotipo representa dos partes que se encuentran, se enlazan y continúan conservando su individualidad. Su tono debe sentirse cercano, joven y humano; nunca rígido, bancario o intimidante.

## 2. Master oficial

El master es la reconstrucción plana de **B — Refinamiento orgánico**. Está compuesto por dos cintas cerradas, cyan y coral, con cuatro cruces alternados. El wordmark utiliza una construcción redondeada basada en Nunito ExtraBold y fue convertido a contornos.

La versión plana es la única versión institucional. No se permiten degradados, brillos, sombras, biseles ni transparencias en el master.

## 3. Versiones disponibles

| Necesidad | Archivo recomendado |
|---|---|
| Isotipo color, 32 px o más | `svg/yanti-isotype-color.svg` |
| Isotipo color, 16/24 px | `svg/yanti-isotype-micro-color.svg` |
| Isotipo monocromo | `svg/yanti-isotype-black.svg`, `white` o `carbon` |
| Logo horizontal en fondo claro | `svg/yanti-lockup-horizontal-dark.svg` |
| Logo horizontal en fondo oscuro | `svg/yanti-lockup-horizontal-light.svg` |
| Firma con dominio en claro/oscuro | `svg/yanti-domain-lockup-dark.svg` / `light.svg` |
| App icon | `svg/yanti-app-icon-light.svg` / `dark.svg` |

`dark` y `light` en el nombre del wordmark describen el color del texto, no el modo de la interfaz.

## 4. Color

| Token | HEX | RGB | Uso |
|---|---|---|---|
| Yanti Cyan | `#02C3C3` | 2, 195, 195 | Cinta cyan e identidad |
| Yanti Coral | `#FC6B5D` | 252, 107, 93 | Cinta coral e identidad |
| Yanti Ink | `#292426` | 41, 36, 38 | Wordmark sobre fondo claro |
| Yanti Carbon | `#242833` | 36, 40, 51 | Fondo oscuro principal |
| Yanti Warm White | `#FAF8F3` | 250, 248, 243 | Wordmark inverso y fondo cálido |

Los colores funcionales accesibles y semánticos están definidos en `tokens/yanti-brand-tokens.css` y `.json`. No sustituirlos automáticamente por los colores vivos del logo.

## 5. Modos claro y oscuro

- En modo claro usar wordmark Ink y el isotipo color sobre blanco o Warm White.
- En modo oscuro usar wordmark Warm White y el isotipo color sobre Carbon.
- No invertir el orden de las cintas ni cambiar sus colores según el tema.
- Si el fondo compite con el isotipo, usar placa neutra o versión monocroma.

## 6. Área de protección

Definir `x` como el grosor visual de una cinta del isotipo. Mantener al menos **1x** libre alrededor del isotipo y **1x** alrededor de cualquier lockup. Ningún texto, borde, fotografía o icono debe entrar en esa zona.

## 7. Tamaños mínimos

- Isotipo master: mínimo 32 px digital o 8 mm impreso.
- B-Micro: 16 y 24 px digital; no ampliar por encima de 24 px.
- Lockup horizontal: mínimo 120 px de ancho digital.
- Firma `yanti.app`: mínimo 150 px de ancho digital.

En tamaños inferiores a 16 px usar un favicon de 16 px ya exportado; no reducir el master manualmente.

## 8. App icon y favicon

La versión de app usa B-Micro con margen interno generoso sobre una placa Warm White o Carbon. No llevar las cintas hasta el borde. Los favicons y tamaños PWA ya están exportados en `icons/`; evitar regenerarlos desde capturas rasterizadas.

## 9. Tipografía

La tipografía base de marca es **Nunito**, licenciada bajo SIL Open Font License. El wordmark oficial no debe recomponerse: utilizar siempre los SVG con contornos. Nunito puede usarse en titulares y piezas de comunicación; la tipografía de producto puede definirse por el sistema UX mientras conserve alta legibilidad multidioma.

## 10. Usos incorrectos

No:

- rotar, estirar o inclinar el conjunto;
- intercambiar cyan y coral;
- alterar el orden de los cruces;
- aplicar degradados o efectos tridimensionales;
- escribir `Yanti`, `YANTI` o cambiar la tipografía dentro del logo;
- usar cyan/coral para representar estados de una transacción;
- colocar el logo color sobre fondos saturados sin una placa neutra;
- usar el master completo a 16/24 px en lugar de B-Micro.

## 11. Implementación web

Preferir SVG para encabezados y navegación. Para un enlace a inicio, usar un texto alternativo o `aria-label` útil y no repetir el nombre accesible. Cargar los tokens CSS en ambos temas y validar contraste de cada componente real, no solo de la paleta aislada.

## 12. Gobierno del sistema

Cualquier nueva variante debe derivar del master B, conservar proporciones, cruces y paleta, y registrarse con versión. Los archivos `source/` son referencia histórica; los masters vigentes están en `svg/`. `SHA256SUMS.txt` permite comprobar que el paquete no fue alterado.

