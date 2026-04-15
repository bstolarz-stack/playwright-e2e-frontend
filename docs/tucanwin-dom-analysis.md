# TucanWin - Analisis DOM y Fragilidad de Selectores

**Sitio analizado:** https://gfront-tucanwin-testing.gampix.dev/
**Fecha:** 2026-04-10
**Juego probado:** Chilli Heat (Pragmatic Play)
**Metodo:** Playwright MCP browser automation + evaluate()

---

## Hallazgo Principal

**El sitio tiene CERO atributos `data-testid` en toda la pagina.**

Todas las interacciones dependen de:
- Clases Tailwind CSS (utility classes) que pueden cambiar con cualquier refactor visual
- Clases de styled-components con hashes aleatorios (`sc-gKseQo tFDPe`)
- Texto visible (fragil ante cambios de copy/i18n)
- Estructura DOM posicional (nth-child, parent traversal)

---

## Mapa de Elementos DOM por Zona

### 1. HEADER (Pre-login)

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Header wrapper | `header` | `site-header px-5` | BAJA - tag semantico | `site-header` |
| Logo TucanWin | `header a[href="/"] img` | (Next.js Image) | BAJA - estructura estable | `header-logo` |
| Hamburger menu | `button "Toggle menu"` | (sin clase semantica) | ALTA - solo por aria text | `menu-toggle` |
| Boton "Ingresa" | `button "Ingresa"` | (styled-component hash) | ALTA - texto puede cambiar | `login-button` |
| Link "Registrate" | `a[href="/registration"]` | (styled-component hash) | MEDIA - URL estable | `register-link` |

### 2. HEADER (Post-login)

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Boton balance | `button` con texto `$` | `sc-bqyKOM iYrXPY` | CRITICA - hash random + texto dinamico | `user-balance` |
| Boton depositar | `button` | `sc-fubCze gFAEuo deposit-button` | ALTA - clase `deposit-button` existe pero hash cambiara | `deposit-button` |

### 3. NAVEGACION PRINCIPAL

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Nav container | `nav` | (semantic tag) | BAJA | `main-nav` |
| Link Home | `a[href="/"]` + texto "Home" | Tailwind utilities | MEDIA | `nav-home` |
| Link Slots | `a[href="/casino/tragamonedas"]` | Tailwind utilities | MEDIA | `nav-slots` |
| Link Casino | `a[href="/casino"]` | Tailwind utilities | MEDIA | `nav-casino` |
| Link Deportes | `a[href="/sports"]` | Tailwind utilities | MEDIA | `nav-deportes` |
| Link Casino Vivo | `a[href="/live-casino"]` | Tailwind utilities | MEDIA | `nav-live-casino` |
| Link E-Sports | `a[href="/esports"]` | Tailwind utilities | MEDIA | `nav-esports` |
| Link Promos | `a[href="/promotions"]` | Tailwind utilities | MEDIA | `nav-promos` |

### 4. BANNER / CAROUSEL

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Banner container | Sin ID ni clase semantica | Tailwind: flex, overflow | CRITICA | `hero-carousel` |
| Banner anterior | `button "Banner anterior"` | Tailwind utilities | ALTA - aria text | `carousel-prev` |
| Banner siguiente | `button "Siguiente banner"` | Tailwind utilities | ALTA - aria text | `carousel-next` |
| Dot indicators | `button "Ir al banner N"` | Tailwind utilities | ALTA - aria text dinamico | `carousel-dot-{n}` |

### 5. SECCIONES DE JUEGOS (Categorias)

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Seccion wrapper | Sin selector unico | `w-full flex flex-col max-w-full overflow-hidden` | CRITICA - Tailwind puro, sin ID | `game-section-{categoryId}` |
| Titulo seccion (h2) | `h2` con texto | `font-medium text-lg` | ALTA - solo por texto | `section-title-{slug}` |
| Link "Ver todos" | `a "Ver todos"` | Tailwind utilities | ALTA - texto | `section-view-all-{slug}` |
| Scroll izquierda | `button "Desplazar a la izquierda"` | (sin clase) | ALTA - aria text | `section-scroll-left-{slug}` |
| Scroll derecha | `button "Desplazar a la derecha"` | (sin clase) | ALTA - aria text | `section-scroll-right-{slug}` |
| Carousel container | Sin selector | `overflow-x-auto w-full isolate [scrollbar-width:none]` | CRITICA | `section-games-{slug}` |

### 6. GAME CARDS (Tarjetas de Juego)

**Estructura real del DOM (Chilli Heat como ejemplo):**

```
DIV (flex flex-col items-center w-[114px]...)     <-- card wrapper
  DIV (relative pl-[22px])                         <-- image container
    DIV (relative w-[110px] md:w-[170px]...)       <-- image sizer
      IMG alt="Chilli Heat" data-nimg="fill"        <-- game image
    DIV                                            <-- overlay on hover
      SPAN "Pragmatic"                              <-- provider name
      BUTTON "Jugar"                                <-- play button
  P "Chilli Heat"                                  <-- game name text
```

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Card wrapper | nth-child posicional | `flex flex-col items-center w-[114px] md:w-[170px] lg:w-[219px] h-[110px]` | **CRITICA** - solo Tailwind responsive, sin ID | `game-card-{gameCode}` |
| Imagen del juego | `img[alt="Chilli Heat"]` | `data-nimg=fill` (Next.js) | MEDIA - alt text es el mejor selector actual | `game-image-{gameCode}` |
| Nombre proveedor | `span` dentro del overlay | `font-medium text-lg` (Tailwind) | **CRITICA** - span sin clase semantica | `game-provider-{gameCode}` |
| Boton "Jugar" | `button "Jugar"` dentro de card | (sin clase) | **CRITICA** - boton generico, hay N botones "Jugar" en la pagina | `game-play-{gameCode}` |
| Nombre del juego | `p` debajo de la card | (sin clase) | **CRITICA** - `<p>` sin identificador | `game-name-{gameCode}` |
| Ranking number | `div` con texto "5" | (Tailwind positioning) | ALTA | `game-rank-{position}` |

### 7. NOVEDADES (Promos)

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Seccion wrapper | `h2 "Novedades"` parent | `flex flex-col w-full mt-[30px]` | CRITICA | `promos-section` |
| Promo card | Sin selector | Tailwind utilities | CRITICA | `promo-card-{slug}` |
| Promo image | `img[alt]` | Next.js Image | MEDIA | `promo-image-{slug}` |
| Promo CTA link | `a "Juga"` / `a "$20.000 gratis"` | (sin clase) | ALTA - texto variable | `promo-cta-{slug}` |

### 8. MODAL DE LOGIN

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Modal wrapper | (aparece al click "Ingresa") | (sin ID ni clase semantica) | CRITICA | `login-modal` |
| Boton cerrar | `button "Cerrar"` | Tailwind utilities | ALTA | `login-modal-close` |
| Titulo | `h2 "Iniciar sesion"` | (sin clase) | ALTA | `login-title` |
| Input usuario | `textbox "Usuario o E-mail"` | (sin ID ni name) | **CRITICA** - solo placeholder | `login-username-input` |
| Input password | `textbox "Contrasena"` | (sin ID ni name) | **CRITICA** - solo placeholder | `login-password-input` |
| Toggle password | `button` con emoji | (sin clase) | CRITICA | `login-toggle-password` |
| Checkbox recordar | `checkbox "Recordarme"` | (sin ID) | ALTA | `login-remember-me` |
| Link olvide pass | `button "Olvidaste tu contrasena?"` | (sin clase) | ALTA - texto | `login-forgot-password` |
| Boton submit | `button "Ingresar"` | (sin clase) | ALTA - texto | `login-submit` |
| Link registrate | `button "Registrate"` | (sin clase) | ALTA - texto | `login-register-link` |

### 9. GAME OVERLAY (Juego abierto)

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Overlay wrapper | Sin selector | (Tailwind: flex, bg-dark) | CRITICA | `game-overlay` |
| Logo en overlay | `img "TucanWin"` | Next.js Image | MEDIA | `game-overlay-logo` |
| Badge 18+ | `span "18+"` | (Tailwind) | ALTA | `game-age-badge` |
| Reloj | `span` con hora | (Tailwind) | ALTA | `game-clock` |
| Titulo del juego | `span "Chilli Heat"` | `font-medium text-lg` | **CRITICA** - span generico | `game-overlay-title` |
| Boton cerrar juego | `button "Cerrar juego"` | `text-white hover:text-gray-300 transition-colors flex items-center` | ALTA - texto + Tailwind | `game-close-button` |
| Game iframe | `iframe` | `w-full h-full border-0` | **CRITICA** - sin ID, sin name, sin testid | `game-iframe` |
| Iframe src | URL del proveedor (gs2c) | (dinamico por juego) | N/A - siempre sera dinamico | - |

### 10. FOOTER

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Footer wrapper | Sin tag `<footer>` | (Tailwind) | CRITICA - no usa tag semantico | `site-footer` |
| Logo footer | `img "TucanWin"` en footer | Next.js Image | MEDIA | `footer-logo` |
| Link Facebook | `a "Visita...facebook"` | (aria text largo) | ALTA | `footer-facebook` |
| Link Instagram | `a "Visita...instagram"` | (aria text largo) | ALTA | `footer-instagram` |
| Links legales | `a[href="/quienes-somos"]` etc. | (sin clase) | MEDIA - URLs estables | `footer-link-{slug}` |
| Medios de pago | `img[alt="Visa"]` etc. | Next.js Image | MEDIA | `payment-method-{name}` |
| Logos regulatorios | `img[alt="+18"]` etc. | Next.js Image | MEDIA | `regulatory-{name}` |

### 11. CHAT WIDGET

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Chat button | `button "Chat with us"` | (third-party widget) | MEDIA - third party, no controlable | `chat-widget` |

### 12. COUNTDOWN BANNER (Mundial)

| Elemento | Selector actual necesario | Clases reales | Fragilidad | `data-testid` sugerido |
|----------|--------------------------|---------------|------------|------------------------|
| Countdown wrapper | Sin selector | (Tailwind) | CRITICA | `countdown-banner` |
| Boton cerrar | `button "Cerrar countdown"` | (sin clase) | ALTA | `countdown-close` |
| Dias/Horas/Min/Seg | `span` con numeros | (Tailwind) | CRITICA - posicional | `countdown-days`, `countdown-hours`, etc. |

---

## Resumen de Fragilidad

| Nivel | Cantidad | Descripcion |
|-------|----------|-------------|
| **CRITICA** | ~18 | Sin ID, sin clase semantica, sin data attrs. Solo Tailwind utilities o styled-component hashes. Un refactor CSS rompe todo. |
| **ALTA** | ~15 | Depende de texto visible, aria labels, o placeholder text. Cambios de copy/i18n rompen selectores. |
| **MEDIA** | ~12 | Usa `href`, `alt`, o tags semanticos (`nav`, `header`). Mas estable pero no ideal. |
| **BAJA** | ~3 | Tags HTML semanticos unicos (`header`, `nav`, `main`). Poco probable que cambien. |

## Tecnologias Detectadas

- **Framework:** Next.js (evidencia: `data-nimg`, `_next/static/chunks/`)
- **CSS:** Tailwind CSS (utility classes en todos los elementos)
- **Components:** styled-components (clases `sc-*` con hashes en header buttons)
- **Images:** Next.js Image optimization (`data-nimg="fill"`)
- **Game provider:** Pragmatic Play via gs2c (`tucanwin.prerelease-env.biz/gs2c/playGame.do`)
- **Analytics:** Google Tag Manager (`GTM-5MG4S44T`)
- **Chat:** LiveChat widget

## Comparacion con pba.sports.bet.ar

| Aspecto | pba.sports.bet.ar | TucanWin testing |
|---------|-------------------|------------------|
| `data-testid` | 0 | 0 |
| IDs en elementos | Algunos (`#LoginUserName`, `#iframe-games`, `#search-modal-games`) | **Ninguno** |
| Clases semanticas | Algunas (`.juego`, `.info`, `.header__icon--search`) | **Ninguna** - todo Tailwind |
| Game card selector | `div.juego` (clase semantica) | `div` con Tailwind responsive classes |
| Login form IDs | `#LoginUserName`, `#LoginPassword` | **Sin ID, sin name** - solo placeholder |
| Game iframe | `#iframe-games` | `iframe` sin ID |
| Search | `#games-search`, `#search-modal-games` | No visible |

**TucanWin es significativamente mas fragil que pba.sports.bet.ar** para automatizacion E2E. El sitio PBA al menos tiene IDs en formularios y clases semanticas en game cards. TucanWin no tiene nada de eso.

## Recomendacion para Devs

Los `data-testid` minimos indispensables para E2E testing serian:

### Prioridad 1 (Bloquean toda automatizacion)
1. `login-username-input` - Input de usuario
2. `login-password-input` - Input de contraseña
3. `login-submit` - Boton de login
4. `game-card-{gameCode}` - Wrapper de cada game card (con el gameCode como sufijo dinamico)
5. `game-play-{gameCode}` - Boton "Jugar" de cada card
6. `game-iframe` - iframe del juego
7. `game-close-button` - Cerrar juego
8. `user-balance` - Balance del usuario

### Prioridad 2 (Mejoran estabilidad)
9. `game-section-{categoryId}` - Wrapper de cada seccion de juegos
10. `section-title-{slug}` - Titulo de seccion
11. `login-modal` - Modal de login
12. `game-overlay` - Overlay del juego abierto
13. `game-overlay-title` - Nombre del juego en overlay
14. `nav-{section}` - Links de navegacion
15. `deposit-button` - Boton de depositar

### Prioridad 3 (Testing completo)
16. `hero-carousel` - Carousel de banners
17. `carousel-prev/next` - Controles del carousel
18. `promo-card-{slug}` - Cards de promociones
19. `footer-link-{slug}` - Links del footer
20. `countdown-banner` - Banner de countdown
