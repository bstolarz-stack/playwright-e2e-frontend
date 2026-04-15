# Casino Games E2E Test Plan

## Application Overview

E2E tests para el casino online pba.sports.bet.ar. Se testea la carga de juegos en cada seccion del casino: Tragamonedas, Ruletas, Blackjack, Lanzamientos, Zona Bono, Wanda Collection, Free Spins, Proveedor del mes, Los mas Jugados, Bingo, Juegos de pano. El seed hace login y navega al casino.

## Test Scenarios

### 1. Tragamonedas

**Seed:** `tests/seed.spec.ts`

#### 1.1. Verificar carga de juego Tragamonedas

**File:** `tests/casino/tragamonedas.spec.ts`

**Steps:**
  1. Click en la tab Tragamonedas en el menu de secciones del casino
    - expect: La seccion Tragamonedas se muestra con la grilla de juegos
  2. Click en el primer juego visible (Joker's Jewels)
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue con un canvas visible
    - expect: El juego muestra un canvas con width > 100 dentro de un iframe

### 2. Ruletas

**Seed:** `tests/seed.spec.ts`

#### 2.1. Verificar carga de juego Ruleta

**File:** `tests/casino/ruletas.spec.ts`

**Steps:**
  1. Click en la tab Ruletas en el menu de secciones del casino
    - expect: La seccion Ruletas se muestra con juegos de ruleta
  2. Click en el primer juego de ruleta visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe

### 3. Blackjack

**Seed:** `tests/seed.spec.ts`

#### 3.1. Verificar carga de juego Blackjack

**File:** `tests/casino/blackjack.spec.ts`

**Steps:**
  1. Click en la tab Blackjack en el menu de secciones del casino
    - expect: La seccion Blackjack se muestra con juegos de blackjack
  2. Click en el primer juego de blackjack visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe

### 4. Lanzamientos

**Seed:** `tests/seed.spec.ts`

#### 4.1. Verificar carga de juego Lanzamientos

**File:** `tests/casino/lanzamientos.spec.ts`

**Steps:**
  1. Click en la tab Lanzamientos en el menu de secciones del casino
    - expect: La seccion Lanzamientos se muestra con juegos nuevos
  2. Click en el primer juego visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe

### 5. Zona Bono

**Seed:** `tests/seed.spec.ts`

#### 5.1. Verificar carga de juego Zona Bono

**File:** `tests/casino/zona-bono.spec.ts`

**Steps:**
  1. Click en la tab Zona Bono en el menu de secciones del casino
    - expect: La seccion Zona Bono se muestra con juegos
  2. Click en el primer juego visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe

### 6. Wanda Collection

**Seed:** `tests/seed.spec.ts`

#### 6.1. Verificar carga de juego Wanda Collection

**File:** `tests/casino/wanda-collection.spec.ts`

**Steps:**
  1. Click en la tab Wanda Collection en el menu de secciones del casino
    - expect: La seccion Wanda Collection se muestra con juegos
  2. Click en el primer juego visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe

### 7. Bingo

**Seed:** `tests/seed.spec.ts`

#### 7.1. Verificar carga de juego Bingo

**File:** `tests/casino/bingo.spec.ts`

**Steps:**
  1. Click en la tab Bingo en el menu de secciones del casino
    - expect: La seccion Bingo se muestra con juegos
  2. Click en el primer juego visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe

### 8. Juegos de pano

**Seed:** `tests/seed.spec.ts`

#### 8.1. Verificar carga de juego de pano

**File:** `tests/casino/juegos-de-pano.spec.ts`

**Steps:**
  1. Click en la tab Juegos de pano en el menu de secciones del casino
    - expect: La seccion Juegos de pano se muestra con juegos de mesa
  2. Click en el primer juego visible
    - expect: Se navega a la pagina de gameplay del juego
  3. Esperar a que el iframe del juego cargue
    - expect: El juego muestra contenido cargado dentro de un iframe
