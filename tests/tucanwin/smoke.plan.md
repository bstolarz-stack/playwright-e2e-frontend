# TucanWin Smoke UI Test Plan

## Application Overview

Smoke tests de UI para tucanwin.bet.ar (env de testing: gfront-tucanwin-testing.gampix.dev). Cobertura: home, navegacion, deportes (widget Digitain en iframe), casino, casino vivo, promociones y footer. Se excluyen los tests de registracion porque ya estan implementados en tests/tucanwin/login.spec.ts. Cada suite asume estado fresco (cookies limpias, usuario no logueado).

## Test Scenarios

### 1. home

**Seed:** `tests/tucanwin/seed.spec.ts`

#### 1.1. Home carga con header, banners y footer

**File:** `tests/tucanwin/smoke/home.spec.ts`

**Steps:**
  1. Navegar a la URL base de tucanwin
    - expect: La pagina responde con titulo 'Tucanwin'
    - expect: El header muestra el logo y los botones 'Ingresá' y 'Registrate'
  2. Verificar el carousel de banners principal
    - expect: Hay al menos un banner visible con titulo y CTA
    - expect: Los botones 'Banner anterior' y 'Siguiente banner' son visibles
    - expect: Hay dots de navegacion (al menos 2)
  3. Hacer scroll al footer
    - expect: El footer muestra las secciones JUEGOS, TUCANWIN y AYUDA
    - expect: El footer muestra los logos de medios de pago (BankTransfer, MercadoPago, RapiPago, etc.)
    - expect: El footer muestra los iconos +18, linea gratuita, autoexclusion e IPLyC

#### 1.2. Toggle del menu lateral abre y cierra

**File:** `tests/tucanwin/smoke/home.spec.ts`

**Steps:**
  1. Click en el boton 'Toggle menu' del header
    - expect: Se abre el menu lateral con 'Menu' como titulo
    - expect: El menu muestra los links: Slots, Mundial, Promos, Casino, Home, Casino VIvo, Deportes
  2. Click en el boton 'Cerrar menu'
    - expect: El menu lateral se oculta

#### 1.3. Bottom nav navega entre secciones

**File:** `tests/tucanwin/smoke/home.spec.ts`

**Steps:**
  1. Click en el link 'Casino' del bottom nav
    - expect: La URL cambia a /casino
  2. Click en el link 'Home' del bottom nav
    - expect: La URL vuelve a la raiz (/)
  3. Click en el link 'Hot Deportes' del bottom nav
    - expect: La URL cambia a /sports

#### 1.4. Sliders del home muestran tarjetas de juegos

**File:** `tests/tucanwin/smoke/home.spec.ts`

**Steps:**
  1. Verificar el slider 'LOS MÁS JUGADOS'
    - expect: El heading 'LOS MÁS JUGADOS' es visible
    - expect: Hay al menos 5 tarjetas con imagen y boton 'Jugar'
    - expect: El link 'Ver todos' es visible
  2. Verificar el slider 'JUEGOS DESTACADOS'
    - expect: El heading 'JUEGOS DESTACADOS' es visible
    - expect: Hay al menos 1 tarjeta con imagen y boton 'Jugar'

### 2. deportes-digitain

**Seed:** `tests/tucanwin/seed.spec.ts`

#### 2.1. Pagina de Deportes carga el widget Digitain en un iframe

**File:** `tests/tucanwin/smoke/deportes.spec.ts`

**Steps:**
  1. Navegar a /sports
    - expect: La URL es /sports
    - expect: El titulo de la pagina contiene 'Apuestas Deportivas Online'
    - expect: Existe un iframe que aloja el widget Digitain
  2. Esperar a que el iframe de Digitain quede listo
    - expect: Dentro del iframe es visible el textbox 'Encuentre su partido ...'
    - expect: Las pestañas 'Inicio', 'Visión de conjunto', 'Vista múltiple', 'Calendario' y 'Resultados' son visibles

#### 2.2. Tabs PRE-PARTIDA y EN VIVO de Digitain son interactivos

**File:** `tests/tucanwin/smoke/deportes.spec.ts`

**Steps:**
  1. Dentro del iframe Digitain, verificar el toggle PRE-PARTIDA / EN VIVO
    - expect: Ambos botones son visibles
    - expect: El boton 'EN VIVO' muestra un contador numerico de eventos
  2. Click en 'EN VIVO' dentro del iframe
    - expect: El listado cambia al modo EN VIVO (la seleccion visual del tab cambia)

#### 2.3. Bet Slip vacio es visible al entrar

**File:** `tests/tucanwin/smoke/deportes.spec.ts`

**Steps:**
  1. Dentro del iframe Digitain, ubicar el panel BET SLIP
    - expect: Se ve el texto 'BET SLIP'
    - expect: Se ve el mensaje 'The Bet Slip is empty' o 'Please select events to place a bet'

#### 2.4. Search dentro del iframe Digitain acepta input

**File:** `tests/tucanwin/smoke/deportes.spec.ts`

**Steps:**
  1. En el textbox 'Encuentre su partido ...' del iframe, escribir un termino corto (ej. 'Boca')
    - expect: El textbox refleja el texto tipeado

### 3. casino

**Seed:** `tests/tucanwin/seed.spec.ts`

#### 3.1. Pagina de Casino muestra grid y contador de juegos

**File:** `tests/tucanwin/smoke/casino.spec.ts`

**Steps:**
  1. Navegar a /casino
    - expect: La URL es /casino
    - expect: El heading 'Todos los juegos (N juegos)' es visible y N > 0
    - expect: El grid muestra al menos 20 tarjetas de juego (cada una con imagen)
    - expect: El boton 'Ver más' es visible

#### 3.2. Categorias de Casino son visibles y clickeables

**File:** `tests/tucanwin/smoke/casino.spec.ts`

**Steps:**
  1. Verificar la barra de categorias de Casino
    - expect: Estan visibles las categorias: Drops And Wins, Casino en Vivo, Juegos de Paño, Tragamonedas, Ruletas, Blackjack
  2. Click en la categoria 'Tragamonedas'
    - expect: El heading del grid cambia a 'Tragamonedas (N juegos)' o equivalente y N > 0

#### 3.3. Boton 'Ver más' carga juegos adicionales

**File:** `tests/tucanwin/smoke/casino.spec.ts`

**Steps:**
  1. Capturar el contador 'Mostrando X de Y juegos'
    - expect: X es 20 inicialmente
  2. Click en 'Ver más'
    - expect: El contador 'Mostrando X de Y juegos' aumenta respecto al estado inicial

#### 3.4. Boton 'Buscar juegos' abre el input de busqueda

**File:** `tests/tucanwin/smoke/casino.spec.ts`

**Steps:**
  1. Click en el boton 'Buscar juegos'
    - expect: Se muestra un input de busqueda enfocado
  2. Tipear el nombre de un juego conocido (ej. 'Sweet Bonanza')
    - expect: El grid filtra y muestra al menos una tarjeta cuyo titulo contiene 'Sweet Bonanza'

#### 3.5. Boton 'Proveedores' abre el listado de providers

**File:** `tests/tucanwin/smoke/casino.spec.ts`

**Steps:**
  1. Click en el boton 'Buscar por proveedor'
    - expect: Se despliega un listado/panel con multiples proveedores (PragmaticPlay, Ruby, etc.)

### 4. casino-vivo

**Seed:** `tests/tucanwin/seed.spec.ts`

#### 4.1. Pagina de Casino Vivo carga sin errores

**File:** `tests/tucanwin/smoke/casino-vivo.spec.ts`

**Steps:**
  1. Navegar a /live-casino
    - expect: La URL contiene 'live-casino' o 'casino-vivo'
    - expect: Hay contenido renderizado (al menos un grid o un iframe de live)

### 5. promociones-y-footer

**Seed:** `tests/tucanwin/seed.spec.ts`

#### 5.1. Pagina /promotions muestra las promociones disponibles

**File:** `tests/tucanwin/smoke/promociones.spec.ts`

**Steps:**
  1. Navegar a /promotions
    - expect: El heading 'Promociones' (h1) es visible
    - expect: El contador 'Mostrando X de Y promociones' es visible y Y > 0
    - expect: El grid muestra X tarjetas de promociones

#### 5.2. Links legales del footer cargan paginas validas

**File:** `tests/tucanwin/smoke/footer.spec.ts`

**Steps:**
  1. Desde el home, click en el link 'Juego Responsable' del footer
    - expect: La URL es /juego-responsable
    - expect: La pagina renderiza contenido (no 404)
  2. Volver al home y click en 'Bases y Condiciones'
    - expect: La URL es /bases-y-condiciones
    - expect: La pagina renderiza contenido
  3. Volver al home y click en 'Quienes Somos'
    - expect: La URL es /quienes-somos
    - expect: La pagina renderiza contenido
  4. Volver al home y click en 'Centro de ayuda'
    - expect: La URL es /centro-ayuda
    - expect: La pagina renderiza contenido
  5. Volver al home y click en 'Preguntas Frecuentes'
    - expect: La URL es /preguntas-frecuentes
    - expect: La pagina renderiza contenido
  6. Volver al home y click en 'Contáctenos'
    - expect: La URL es /ayuda/contacto
    - expect: La pagina renderiza contenido
