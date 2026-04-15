# Comparativa DOM: PBA sports.bet.ar vs TucanWin

**Fecha:** 2026-04-10 | **Metodo:** Playwright MCP browser automation + evaluate()

---

## Estado actual: ambos sitios tienen 0 `data-testid`

| Metrica                  | PBA (legacy) | TucanWin (nuevo) |
|:-------------------------|:------------:|:----------------:|
| `data-testid`            |      0       |        0         |
| Elementos con ID HTML    |      5       |      **0**       |
| Clases semanticas        |      4       |      **0**       |
| Clases con hash random   |      0       |       3+         |

---

## Comparativa por zona

| Zona                         | PBA sports.bet.ar                                    | Fragilidad  | TucanWin testing                                     | Fragilidad    |
|:-----------------------------|:-----------------------------------------------------|:-----------:|:-----------------------------------------------------|:-------------:|
| **Login - usuario**          | `#LoginUserName` (ID)                                | Baja        | `input` sin ID, sin name — solo placeholder          | **Critica**   |
| **Login - password**         | `#LoginPassword` (ID)                                | Baja        | `input` sin ID, sin name — solo placeholder          | **Critica**   |
| **Login - submit**           | `form[action*="login"] button[type="submit"]`        | Media       | `button "Ingresar"` sin clase, sin type              | Alta          |
| **Login - abrir modal**      | `getByText('Ingresar')` + fallback evaluate          | Alta        | `button "Ingresa"` hash styled-component             | Alta          |
| **Selector de ciudad**       | `getByText('Bs.As')` + scan de todos los botones     | **Critica** | No aplica                                            | —             |
| **Modal geolocalizacion**    | `#modalValidateGeopositionLogin.show` (ID)           | Media       | No aplica                                            | —             |
| **Header**                   | `document.querySelector('header')` tag semantico     | Baja        | `header.site-header` tag + clase                     | Baja          |
| **Balance usuario**          | No analizado                                         | —           | `button` clase `sc-bqyKOM iYrXPY` (hash random)     | **Critica**   |
| **Boton depositar**          | No presente                                          | —           | `button` clase `deposit-button` + hash               | Alta          |
| **Navegacion**               | Links con `href` fijos                               | Media       | Links con `href` fijos + tag `<nav>`                 | Media         |
| **Busqueda - boton**         | `button.header__icon--search` (BEM)                  | Media       | No existe                                            | —             |
| **Busqueda - modal**         | `#search-modal-games` (ID)                           | Baja        | No existe                                            | —             |
| **Busqueda - input**         | `#games-search` (ID)                                 | Baja        | No existe                                            | —             |
| **Busqueda - resultados**    | `li.games-block-recommended__item` (BEM)             | Media       | No existe                                            | —             |
| **Count de juegos**          | `querySelectorAll('span, div')` + regex              | **Critica** | No visible en home                                   | —             |
| **Game card - wrapper**      | `div.juego` (clase semantica)                        | Media       | `div` con Tailwind responsive utilities              | **Critica**   |
| **Game card - imagen**       | `img.alt`                                            | Media       | `img[alt]` con `data-nimg` (Next.js)                 | Media         |
| **Game card - proveedor**    | `.info small` (clase + tag)                          | Alta        | `span` sin clase dentro de overlay hover             | **Critica**   |
| **Game card - nombre**       | Extraido del `img.alt`                               | Media       | `<p>` sin clase debajo de la card                    | **Critica**   |
| **Game card - boton jugar**  | `a` con `textContent === 'Jugar'`                    | Alta        | `button "Jugar"` — N botones iguales en pagina       | **Critica**   |
| **Seccion de juegos**        | URL con `categoryId` param                           | Media       | URL con `category` param                             | Media         |
| **Titulo de seccion**        | `querySelectorAll('span, div')` + regex              | **Critica** | `h2` por texto visible                               | Alta          |
| **Carousel banners**         | Botones "Anterior"/"Siguiente"                       | Alta        | `button "Banner anterior"` / `"Siguiente banner"`    | Alta          |
| **Game iframe**              | `#iframe-games` (ID)                                 | Baja        | `iframe` sin ID, sin name, sin testid                | **Critica**   |
| **Game overlay - cerrar**    | No aplica (navega a /gameplay)                       | —           | `button "Cerrar juego"` solo Tailwind                | Alta          |
| **Game overlay - titulo**    | No aplica                                            | —           | `span.font-medium.text-lg` Tailwind generico         | **Critica**   |
| **Game canvas**              | `querySelectorAll('canvas')` + filtro size           | Media       | Igual — canvas dentro de iframe proveedor            | Media         |
| **Footer**                   | Tag `<footer>` (contentinfo)                         | Baja        | Sin tag `<footer>` — solo `div` Tailwind             | Alta          |
| **Chat widget**              | `iframe` LiveChat                                    | Media       | `button "Chat with us"` LiveChat                     | Media         |

---

## Ejemplos de fragilidad en TucanWin

### 1. Abrir un juego — nth posicional

```typescript
// Playwright generó esto para clickear Chilli Heat
await page.getByRole('button', { name: 'Jugar' }).nth(4)
```

Hay ~20 botones "Jugar" identicos. Si agregan un juego antes en el ranking, `.nth(4)` clickea otro juego. El test pasa pero testea el juego equivocado.

```typescript
// Con data-testid
await page.getByTestId('game-play-vs25chilli').click()
```

### 2. Login input — sin ID, sin name

```html
<input placeholder="Ingresa tu usuario o email" type="text"
       class="w-full bg-transparent outline-none text-white placeholder-gray-400">
```

El unico selector es el placeholder. Si el copy cambia a "Tu DNI o correo" se rompe. En PBA existe `#LoginUserName`.

```typescript
// Con data-testid
await page.getByTestId('login-username-input').fill('32309581')
```

### 3. Balance — hash de styled-components

```html
<button class="sc-bqyKOM iYrXPY">$ 6.934,00</button>
```

`iYrXPY` se regenera en cada build. Sin ID, sin data-testid. La unica opcion es buscar un boton que contenga `$`.

```typescript
// Con data-testid
const balance = await page.getByTestId('user-balance').textContent()
```

---

## `data-testid` minimos para desbloquear E2E

| Prioridad | data-testid                | Elemento                       | Impacto                       |
|:---------:|:---------------------------|:-------------------------------|:------------------------------|
|     1     | `login-username-input`     | Input de usuario               | Bloquea login                 |
|     1     | `login-password-input`     | Input de contrasena            | Bloquea login                 |
|     1     | `login-submit`             | Boton de login                 | Bloquea login                 |
|     1     | `game-card-{gameCode}`     | Wrapper de cada game card      | Bloquea seleccion de juego    |
|     1     | `game-play-{gameCode}`     | Boton "Jugar" por juego        | Bloquea apertura de juego     |
|     1     | `game-iframe`              | iframe del juego abierto       | Bloquea interaccion con juego |
|     1     | `game-close-button`        | Cerrar juego                   | Bloquea navegacion post-juego |
|     1     | `user-balance`             | Balance del usuario            | Bloquea verificacion de saldo |
|     2     | `game-section-{categoryId}`| Wrapper seccion de juegos      | Mejora estabilidad            |
|     2     | `login-modal`              | Modal de login                 | Mejora estabilidad            |
|     2     | `game-overlay`             | Overlay del juego              | Mejora estabilidad            |
|     2     | `game-overlay-title`       | Nombre del juego en overlay    | Mejora verificacion           |
|     2     | `deposit-button`           | Boton depositar                | Mejora flujo de deposito      |
|     3     | `hero-carousel`            | Carousel de banners            | Testing completo              |
|     3     | `nav-{section}`            | Links de navegacion            | Testing completo              |
|     3     | `footer-link-{slug}`       | Links del footer               | Testing completo              |

---

## Tecnologias detectadas

| Aspecto           | PBA                              | TucanWin                          |
|:------------------|:---------------------------------|:----------------------------------|
| **Framework**     | Server-rendered (jQuery/vanilla) | Next.js                           |
| **CSS**           | Clases BEM + custom              | Tailwind CSS utilities            |
| **Componentes**   | HTML plano                       | styled-components (hashes)        |
| **Imagenes**      | `<img>` estandar                 | Next.js Image (`data-nimg`)       |
| **Game provider** | gs2c / prrplt4                   | gs2c (misma infra)                |

## Conclusion

TucanWin es un paso atras en testability respecto a PBA. El frontend nuevo usa tecnologias modernas (Next.js, Tailwind, styled-components) pero ninguna de ellas produce selectores estables. Los 8 `data-testid` de prioridad 1 son indispensables para cualquier automatizacion E2E.
