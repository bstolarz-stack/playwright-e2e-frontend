# Test Diario de Casino - Agente Autonomo

Eres un agente de testing automatizado para el casino online `pba.sports.bet.ar` (Provincia de Buenos Aires).
Tu objetivo es navegar el casino, descubrir secciones, y testear 1 juego por seccion.

## Credenciales

- Usuario: $ARGUMENTS (se pasa como argumento, formato: usuario:password)
- Si no se pasa argumento, usar: 33284255:Listento*32
- URL base: https://pba.sports.bet.ar

## PASO 1: Configurar Geolocalizacion

ANTES de navegar a cualquier URL, debes mockear la Geolocalizacion del browser.
El sitio requiere coordenadas de Provincia de Buenos Aires (La Plata), NO Ciudad de Buenos Aires.

Ejecuta este JavaScript en el browser:

```javascript
// Mockear Geolocation API con coordenadas de La Plata, PBA
const mockPosition = {
  coords: {
    latitude: -34.9205,
    longitude: -57.9536,
    accuracy: 100,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  },
  timestamp: Date.now()
};
navigator.geolocation.getCurrentPosition = (success) => success(mockPosition);
navigator.geolocation.watchPosition = (success) => { success(mockPosition); return 1; };
```

## PASO 2: Navegar y Seleccionar Ciudad

1. Navegar a `https://sportsbet.com.ar`
2. Esperar a que cargue la pagina
3. Tomar screenshot para verificar
4. Buscar y hacer click en el boton "Bs.As" o "Buenos Aires" para seleccionar la provincia
5. Esperar redireccion a `pba.sports.bet.ar`
6. Si no redirige, navegar directamente a `https://pba.sports.bet.ar`

## PASO 3: Login

1. Buscar y hacer click en el boton "Ingresar" o "INGRESAR"
2. Esperar a que aparezca el formulario de login
3. Completar el campo `#LoginUserName` con el usuario
4. Completar el campo `#LoginPassword` con el password
5. Hacer click en el boton submit del formulario `form[action*="login"] button[type="submit"]`
6. Esperar respuesta del servidor (3-5 segundos)
7. Tomar screenshot

## PASO 4: Modal de Geolocalizacion

Despues del login, puede aparecer un modal de geolocalizacion:
1. Buscar el modal `#modalValidateGeopositionLogin.show`
2. Si aparece, buscar el boton "CONTINUAR" dentro del modal y hacer click
3. Si no hay "CONTINUAR", buscar "OMITIR" y hacer click
4. Esperar 8 segundos para que procese la geolocalizacion
5. Tomar screenshot

## PASO 5: Verificar Login

1. Verificar que el header NO contiene "INGRESAR" (significa que esta logueado)
2. Si aun dice "INGRESAR", intentar cerrar modales y recargar la pagina
3. Tomar screenshot de confirmacion

## PASO 6: Navegar al Casino

1. Navegar a `https://pba.sports.bet.ar/casino/index`
2. Esperar carga completa
3. Tomar screenshot del casino

## PASO 7: Descubrir Secciones

Analiza el screenshot del casino e identifica las tabs/categorias visibles.
Las secciones tipicas son:

| Seccion | Nombre esperado en tab | Test requerido |
|---------|----------------------|----------------|
| Tragamonedas | "Tragamonedas" o "Slots" | 5 spins |
| Ruleta | "Ruleta" o "Roulette" | Solo verificar carga |
| Blackjack | "Blackjack" | Solo verificar carga |
| Lanzamiento | "Lanzamiento" o "Crash" | Solo verificar carga |
| Zona Bono | "Zona Bono" o "Bonus" | Solo verificar carga |
| Wanda Collection | "Wanda" | Solo verificar carga |
| Proveedores | "Proveedores" o "Providers" | Solo verificar carga |
| En vivo | "En vivo" o "Live" | Solo verificar carga |

Para cada seccion que encuentres, registrala y proceede al paso 8.

## PASO 8: Testear Cada Seccion

Para CADA seccion descubierta, ejecuta el siguiente flujo:

### 8a. Abrir la seccion
1. Hacer click en la tab/categoria de la seccion
2. Esperar a que carguen los juegos (2-3 segundos)
3. Tomar screenshot

### 8b. Seleccionar y abrir el primer juego
1. Identificar el primer juego visible en la grilla
2. Anotar el nombre del juego
3. Hacer click en el juego
4. Esperar a que se abra la pagina de gameplay (URL debe contener "gameplay")
5. Si no abre, intentar con el segundo juego
6. Tomar screenshot

### 8c. Verificar carga del juego
1. Esperar hasta 60 segundos a que aparezca un iframe con un canvas de juego
2. Buscar en los frames de la pagina: recorrer todos los frames excepto mainFrame y about:blank
3. En cada frame, ejecutar JavaScript para verificar si hay un canvas con width > 100:
   ```javascript
   const c = document.querySelector('canvas');
   c !== null && c.width > 100;
   ```
4. Si se encuentra un canvas, el juego cargo correctamente
5. Tomar screenshot
6. Registrar resultado: PASS o FAIL con el motivo

### 8d. Para TRAGAMONEDAS solamente: Ejecutar 5 Spins

Si la seccion es "Tragamonedas", ejecutar los siguientes pasos adicionales:

#### Cerrar pantalla de intro
Muchos juegos (especialmente Pragmatic Play) muestran una pantalla de intro/features antes del juego real.
El balance mostrara "N/A" o null si aun estas en la intro.

1. Encontrar el canvas del juego y obtener su boundingBox
2. Hacer click en multiples posiciones para cerrar la intro:
   - 68% X, 43% Y (boton play principal)
   - 72% X, 47% Y (posicion alternativa)
   - 65% X, 50% Y (posicion baja)
   - 50% X, 50% Y (centro)
3. Esperar 1 segundo entre cada click
4. Repetir el click en 68% X, 43% Y una vez mas
5. Tomar screenshot

#### Ejecutar los 5 spins
Para cada spin (1 a 5):

1. Encontrar el canvas del juego y obtener su boundingBox
2. Calcular la posicion del boton de spin: 50% X, 90% Y del canvas (parte inferior central)
   - Para Pragmatic Play: 67% X, 88% Y
3. Hacer click en esa posicion
4. Esperar 3 segundos para la animacion del spin
5. Tomar screenshot
6. Registrar si el spin fue exitoso (no hubo error visible)

Si hay 3 errores consecutivos, abortar los spins restantes.

### 8e. Volver al casino
1. Navegar de vuelta a `https://pba.sports.bet.ar/casino/index`
2. Esperar carga (2 segundos)

## PASO 9: Timeout por juego

Si un juego tarda mas de 3 minutos en cargar o completar su test:
1. Tomar screenshot del estado actual
2. Registrar como FAIL con motivo "Timeout"
3. Navegar de vuelta al casino y continuar con la siguiente seccion

## PASO 10: Generar Resultado

Al finalizar todos los tests, genera un JSON con el siguiente formato EXACTO:

```json
{
  "date": "2026-04-07",
  "status": "PASS",
  "totalSections": 8,
  "passedSections": 7,
  "failedSections": 1,
  "sections": [
    {
      "name": "Tragamonedas",
      "game": "Fruit Party",
      "status": "PASS",
      "loadTime": 5.2,
      "spins": {
        "total": 5,
        "successful": 3,
        "failed": 2,
        "details": "3/5 spins exitosos"
      },
      "error": null
    },
    {
      "name": "Ruleta",
      "game": "Auto-Roulette",
      "status": "PASS",
      "loadTime": 3.1,
      "spins": null,
      "error": null
    },
    {
      "name": "Lanzamiento",
      "game": "Aviator",
      "status": "FAIL",
      "loadTime": null,
      "spins": null,
      "error": "Timeout loading game"
    }
  ]
}
```

IMPORTANTE: Tu respuesta final DEBE ser UNICAMENTE el JSON de resultados, sin texto adicional.
El JSON debe ser valido y parseable.
