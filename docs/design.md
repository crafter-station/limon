# Limon — Design

**Status:** Accepted (grill session, 2026-07-16)  
**Scope:** Marca y UI del producto Limon (landing, `/generating`). Las páginas públicas `/[slug]` heredan principios, no la misma personalidad.

---

## 1. Usuarios

| | |
|---|---|
| **Primario** | Dueños / encargados de restaurantes **medianos** |
| **Edad** | ~30–40 |
| **Contexto** | Poco o nada de equipo de diseño/marketing; se auto-atienden |
| **Trabajo** | Pegar un link de Google Maps → obtener una web usable |
| **Secundario** | Comensales en `/[slug]` (no diseñan Limon; consumen el resultado) |

### Implicaciones de diseño

- Un solo trabajo visible por pantalla; cero jerga de agencia o SaaS.
- El formulario debe ser obvio en el primer viewport (móvil incluido).
- Confianza por claridad y cercanía, no por densidad de features ni “wow” infinito.
- Copy en **español (LATAM), de tú**, concreto y corto.

---

## 2. Decisiones cerradas (árbol)

Respuestas del usuario + recomendaciones adoptadas para el resto del árbol.

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | Usuario primario | Dueños 30–40, restaurantes medianos, sin equipo de apoyo |
| 2 | Personalidad Limon | **Vecino útil** + toque **chef con oficio** |
| 3 | Mercado / idioma | Español LATAM; POC con sesgo Perú / región andina |
| 4 | Dos superficies | **Marca Limon** (tool) ≠ **marca del restaurante** (páginas generadas) |
| 5 | Dispositivo | **Mobile-first** en landing y form; desktop refuerza el storytelling |
| 6 | Promesa emocional | “En minutos, sin diseñador, a partir de lo que ya tienes en Maps” |
| 7 | Tipografía (tool) | **Caprasimo** (display) + **Karla** (UI/body) |
| 8 | Color (tool) | Campo verde + crema/warm + tinta carbón; CTA rojo Maps |
| 9 | Motion | 2–3 momentos intencionales; nunca bloquean el form; `prefers-reduced-motion` |
| 10 | Hero | Una composición: marca, 1 headline, 1 línea, form/CTA, 1 ancla visual |
| 11 | Densidad | Baja; una sección = un propósito |
| 12 | Imagen | Metáfora de producto (local 3D / pin Maps / camino), no collage stock |
| 13 | Cards | Por defecto no; solo si contienen interacción (form, input group) |
| 14 | Páginas generadas | Sistema editorial propio (serif display, limón/hoja); no clonar la landing |

---

## 3. Personalidad de marca

**Limon (tool)** = el vecino que te arma la web con oficio gastronómico.

| Sí | No |
|----|----|
| Cercano, claro, útil | Frío “dashboard SaaS” |
| Orgullo de local / oficio | Corporativo genérico |
| Ácido con mesura (acentos limón) | Payaso / meme / emoji spam |
| Tú, verbos de acción | Ustedes formales, buzzwords |

**Tono de voz**

- Corto: headline + una frase de apoyo.
- Verbos: *Arma, Pega, Prueba, Listo*.
- Errores: humanos y accionables (“Revisa que el link sea de Google Maps”).
- Evitar: “revoluciona”, “AI-powered”, “ecosistema”, “solución integral”.

Ejemplos alineados:

- Headline: *Ya estás en el mapa*
- Apoyo: *Ahora ponte online.*
- CTA: *Arma mi web*
- Helper: *¿Sin link a la mano? Prueba con Las Palmeras*

---

## 4. Dos sistemas visuales

### A. Producto Limon (`/`, `/generating`)

Inspiración estructural (no clone de assets): MindMarket — campo de color pleno, nav pills, preloader de trazo, camino en scroll.

- Atmósfera: verde vivo + warm cream; tipografía expressiva en la marca.
- Job: convertir un link en una generación, con calma y claridad.

### B. Sitios generados (`/[slug]`)

- Atmósfera: editorial de restaurante (hoja oscura, limón, zest).
- Display: serif con carácter (hoy `font-display` / Georgia); UI en sans legible.
- Job: que el comensal entienda el local, menú, reviews, cómo llegar.
- La marca Limon aparece solo como atribución discreta al pie, no como hero del restaurante.

---

## 5. Tipografía

### Tool (landing)

| Rol | Familia | Uso |
|-----|---------|-----|
| Display / marca | **Caprasimo** | Logo wordmark, H1 hero, momentos de carácter |
| UI / body | **Karla** | Nav, form, body, botones |

**Escala orientativa (landing)**

| Token | Tamaño | Notas |
|-------|--------|-------|
| Display | `clamp(3.25rem, 8.5vw, 7.25rem)` | Leading ~0.98, tracking leve negativo |
| Support | 1.25–1.5rem | Semibold, tinta al ~75% |
| Body / form | 1rem | Inputs y mensajes de error |
| Caption / helper | 0.875rem | Links secundarios, labels |

**Reglas**

- Máximo **2 familias** en el tool.
- No Inter / Roboto / Arial como cara de marca (Roboto solo si un attribution de Maps lo exige).
- Caprasimo no se italiciza.
- Contraste por peso (400/600/700) antes que por tamaño excesivo en UI.

### Generadas

- Display serif grande para nombre del local y secciones.
- Sans para meta, horarios, CTAs, items de menú.
- Labels mono uppercase solo como acento escaso (no como sistema completo).

---

## 6. Color

### Tool — tokens canónicos

| Token | Hex | Rol |
|-------|-----|-----|
| `--mm-green-deep` | `#8ed462` | Hero full-bleed, acento de marca |
| `--mm-green` | `#b8e88c` | Acentos suaves / estados |
| `--mm-warm` | `#e0dbce` | Fondo de página bajo el hero |
| `--mm-cream` | `#f5f1e4` | Paneles suaves |
| `--mm-ink` | `#2c2e2a` | Texto principal |
| `--mm-white` | `#ffffff` | Pills, superficie del form |
| `--mm-maps-red` | `#ea4335` | CTA primario (familiaridad Maps) |
| `--danger` | `#b63b20` | Errores |

**Reglas**

- Hero = campo plano de verde; no gradiente púrpura ni glow genérico.
- CTA primario = rojo Maps (acción); secundarios = blanco / tinta.
- Sombras suaves (`rgba` tinta baja); nada de neubrutalismo hard-offset salvo decisión futura explícita.
- Evitar el cliché “crema + serif + terracota” como look completo del tool; el warm es soporte, el verde es la marca.

### Generadas — familia limón/hoja (existente)

| Token | Hex | Rol |
|-------|-----|-----|
| `--leaf` / ink | `#14261c` / `#17231a` | Fondos oscuros, texto fuerte |
| `--lemon` | `#d4f000` / `#d7ef58` | Acento editorial |
| `--zest` | `#ff5a1f` | Energía / labels |
| Cream paper | `#f2efe4` | Superficies claras |

No unificar ciegamente ambas paletas: el dueño debe sentir “entré a Limon” y luego “esta es la web de mi local”.

---

## 7. Layout y composición

### Hero (primer viewport)

Permitido:

1. Marca (wordmark Limon a tamaño hero-signal en nav o wordmark)
2. Un headline
3. Una frase de apoyo
4. Un grupo CTA (form paste + submit)
5. Un ancla visual dominante (tira 3D / atmósfera)

Prohibido en el primer viewport: stats, schedules, feature grids, badges flotantes, chips promo, cards de precios, testimonios.

### Secciones siguientes

- Una idea por bloque (ej. “cómo funciona” en 3 pasos).
- Storytelling por **camino en scroll** está permitido si no secuestra el form ni rompe el scroll nativo en móvil de forma hostil.
- Full-bleed de color o imagen; evitar media en card con radio pesado en el hero.

### Form

- Input + CTA como única interacción primaria.
- Target táctil ≥ 44px (`min-h-13`).
- Estado pending visible (“Armando tu web…”).
- Error inline, focusable, lenguaje plano.

---

## 8. Motion

| Momento | Intención | Notas |
|---------|-----------|-------|
| Preloader (trazo) | Presencia de marca al cargar | Corto; luego revelar la página |
| Entrada hero (`.limon-enter`) | Jerarquía suave | ~480ms, ease custom; stagger leve |
| Scroll path / 3D parallax | Contar el producto | Transform/opacity; sin layout thrash |
| Press (`.limon-press`) | Feedback táctil | `scale(0.97)` en active |

**Curvas:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.

**Reduced motion:** sin scrub de path, sin spin infinito distractor, entradas instantáneas, scroll `auto`.

Motion no compite con el form: si el dueño puede pegar el link en 10s, el diseño cumplió.

---

## 9. Componentes (tool)

- **Nav pill flotante:** blanco, logo Caprasimo + tagline corta opcional, CTA “Arma mi web”.
- **Form pill/card de interacción:** superficie blanca redondeada; es el único “card” justificado del hero.
- **Botón primario:** rojo Maps, pill, bold, flecha sutil en hover.
- **Botón/nav secundario:** blanco, tinta, sombra suave.
- **Preloader:** stroke de marca en verde sobre crema/blanco.
- **Focus:** anillo tinta 2px + offset; nunca quitar outline sin reemplazo.

---

## 10. Accesibilidad (barra mínima)

- `lang="es"`.
- Contraste AA en texto sobre verde y sobre crema.
- Labels con `sr-only` si el placeholder no basta como único nombre.
- `aria-busy` / `aria-live` en submit y errores.
- Hit areas grandes; `touch-action: manipulation`.
- Respeto estricto a `prefers-reduced-motion`.

---

## 11. Anti-patrones (explícitos)

- Dashboard en el hero; métricas; “esta semana”.
- Overlays tipo badge/sticker sobre el media.
- Cards decorativas sin interacción.
- Inter / Roboto / system UI como tipografía de marca.
- Temas púrpura-indigo, glow neon, pills de feature spam.
- Copy en inglés en la landing principal.
- Misma skin SaaS-verde en la página del restaurante (borra la identidad del local).
- Pedir más de un dato obligatorio además del link de Maps en el happy path.

---

## 12. Cómo se ve el éxito

Un dueño de ~35 años, solo en el local con el teléfono:

1. Entiende en 3 segundos que Limon le arma una web desde Maps.
2. Pega el link y envía sin ayuda.
3. Espera en `/generating` sin ansiedad (estado claro).
4. Abre `/[slug]` y reconoce *su* restaurante, no un template genérico de IA.
5. La landing de Limon se siente cercana y con oficio; la web del local se siente del local.

---

## 13. Referencias de implementación

| Artefacto | Ruta |
|-----------|------|
| Tokens CSS | `src/app/globals.css` |
| Fonts | `src/app/layout.tsx` (Caprasimo, Karla) |
| Landing | `src/app/_landing/` |
| Página generada | `src/app/[slug]/page.tsx` |
| Ref estructural (no clone) | `.firecrawl/mindmarket-DESIGN.md` |

---

## Changelog

- **2026-07-16** — Primera versión desde entrevista de estilo (usuario: dueños 30–40 sin equipo; resto del árbol con opciones recomendadas).
