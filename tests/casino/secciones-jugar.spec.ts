import { test, expect, Page, Frame } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { navegarYSeleccionarCiudad } from '../utils/navigation';
import { login, manejarModalGeolocalizacion, verificarLogin } from '../utils/auth';
import {
  esperarGameFrame,
  cerrarIntroJuego,
  ejecutarSpins,
  SpinsResumen,
} from '../utils/game';
import {
  SECCIONES,
  navegarASeccion,
  verificarSeccionCargada,
  clickearPrimerJuego,
  obtenerInfoPrimerJuego,
  verificarCargaJuego,
  SectionConfig,
} from '../utils/sections';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const USERNAME = process.env.APP_USERNAME!;
const PASSWORD = process.env.PASSWORD!;

// ====== Helpers ======

async function loginYNavegar(page: Page) {
  await navegarYSeleccionarCiudad(page);
  await login(page, USERNAME, PASSWORD);
  await manejarModalGeolocalizacion(page);
  await verificarLogin(page);
}

/**
 * Busca el canvas del juego en todos los frames.
 * Devuelve el frame y las coordenadas absolutas (viewport) del canvas.
 */
async function encontrarCanvas(page: Page): Promise<{ frame: Frame; box: { x: number; y: number; width: number; height: number } } | null> {
  for (const f of page.frames()) {
    if (f === page.mainFrame() || f.url() === 'about:blank') continue;
    try {
      const selector = await f.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const candidates = canvases
          .filter((c) => c.id !== 'loaderCanvas')
          .sort((a, b) => (b.width * b.height) - (a.width * a.height));
        const best = candidates[0] || canvases[0];
        if (!best || best.width <= 100) return null;
        if (best.id) return `#${best.id}`;
        return 'canvas';
      }).catch(() => null);

      if (selector) {
        const canvas = f.locator(`css=${selector}`);
        const box = await canvas.boundingBox();
        if (box) return { frame: f, box };
      }
    } catch { /* frame not ready */ }
  }
  return null;
}

/**
 * Espera hasta que aparezca un canvas de juego (hasta 60s).
 */
async function esperarCanvas(page: Page): Promise<{ frame: Frame; box: { x: number; y: number; width: number; height: number } }> {
  for (let i = 0; i < 30; i++) {
    const result = await encontrarCanvas(page);
    if (result) return result;
    await page.waitForTimeout(2000);
  }
  throw new Error('No se encontro canvas del juego despues de 60s');
}

/**
 * Interaccion generica para juegos de mesa (ruleta, blackjack, bingo).
 * Intenta clickear en areas comunes del canvas y detecta si el juego responde
 * via HTTP o cambios visuales.
 */
async function interaccionGenerica(page: Page, seccionNombre: string): Promise<{
  canvasEncontrado: boolean;
  respuestasDetectadas: number;
  interacciones: string[];
}> {
  const interacciones: string[] = [];
  let respuestasDetectadas = 0;

  // Buscar canvas
  let canvasInfo: Awaited<ReturnType<typeof encontrarCanvas>>;
  try {
    canvasInfo = await esperarCanvas(page);
  } catch {
    return { canvasEncontrado: false, respuestasDetectadas: 0, interacciones: ['No se encontro canvas'] };
  }

  const { box } = canvasInfo;
  console.log(`[${seccionNombre}] Canvas: x=${box.x} y=${box.y} ${box.width}x${box.height}`);

  // Interceptar respuestas HTTP del juego
  const gameResponses: string[] = [];
  const responseHandler = async (response: any) => {
    const url: string = response.url();
    const isGameApi =
      url.includes('/spin') || url.includes('/play') || url.includes('/bet') ||
      url.includes('/round') || url.includes('/game/') || url.includes('gameService') ||
      url.includes('gs2c') || url.includes('/deal') || url.includes('/hit') ||
      url.includes('/stand') || url.includes('/roulette') || url.includes('/bingo') ||
      url.includes('/card') || url.includes('doSpin') || url.includes('/action');
    if (isGameApi) {
      gameResponses.push(url);
      respuestasDetectadas++;
    }
  };
  page.on('response', responseHandler);

  // Posiciones de click segun tipo de juego
  // Los juegos de mesa generalmente tienen:
  // - Area de apuestas en el centro/inferior
  // - Boton de accion (girar/repartir) abajo a la derecha
  const clicks = [
    // Area de apuestas (centro del canvas)
    { desc: 'area-apuesta-centro', xr: 0.50, yr: 0.50 },
    // Ficha/chip selector (abajo izquierda)
    { desc: 'chip-selector', xr: 0.20, yr: 0.85 },
    // Repetir click en area de apuesta (colocar ficha)
    { desc: 'colocar-apuesta', xr: 0.45, yr: 0.55 },
    // Boton de accion (girar/repartir/comprar) - abajo derecha
    { desc: 'boton-accion', xr: 0.75, yr: 0.90 },
    // Boton de accion alternativo - centro abajo
    { desc: 'boton-accion-alt', xr: 0.50, yr: 0.90 },
    // Boton de accion alternativo 2 - derecha centro
    { desc: 'boton-accion-alt2', xr: 0.85, yr: 0.50 },
  ];

  for (const click of clicks) {
    const x = Math.round(box.x + box.width * click.xr);
    const y = Math.round(box.y + box.height * click.yr);
    console.log(`[${seccionNombre}] Click: ${click.desc} -> (${x}, ${y})`);

    await page.mouse.click(x, y);
    await page.waitForTimeout(1500);
    interacciones.push(click.desc);

    await page.screenshot({
      path: `test-results/${seccionNombre.toLowerCase().replace(/\s+/g, '-')}-${click.desc}.png`,
    });
  }

  // Esperar un poco mas por respuestas retrasadas
  await page.waitForTimeout(3000);

  page.off('response', responseHandler);

  if (gameResponses.length > 0) {
    console.log(`[${seccionNombre}] Respuestas de juego detectadas: ${gameResponses.length}`);
    for (const url of gameResponses.slice(0, 5)) {
      console.log(`  -> ${url.substring(0, 120)}`);
    }
  } else {
    console.log(`[${seccionNombre}] No se detectaron respuestas HTTP del juego`);
  }

  return { canvasEncontrado: true, respuestasDetectadas, interacciones };
}

// ====== Tests: Secciones Slot (con spins) ======

const SECCIONES_SLOT: { seccion: SectionConfig; nombre: string }[] = [
  { seccion: SECCIONES.zonaBono, nombre: 'Zona Bono' },
  { seccion: SECCIONES.wandaCollection, nombre: 'Wanda Collection' },
  { seccion: SECCIONES.freeSpins, nombre: 'Free Spins' },
  { seccion: SECCIONES.losMasJugados, nombre: 'Los mas Jugados' },
];

test.describe('Secciones Slot - Jugar', () => {
  for (const { seccion, nombre } of SECCIONES_SLOT) {
    test(`${nombre} - Abrir juego y ejecutar 3 spins`, async ({ page }) => {
      await test.step('Login y navegacion', () => loginYNavegar(page));

      let gameInfo: { nombre: string; proveedor: string } | null = null;
      await test.step(`Navegar a ${nombre}`, async () => {
        await navegarASeccion(page, seccion);
        const count = await verificarSeccionCargada(page, seccion);
        console.log(`${nombre}: ${count} juegos`);
      });

      await test.step('Obtener info y abrir primer juego', async () => {
        gameInfo = await obtenerInfoPrimerJuego(page);
        console.log(`Juego: ${gameInfo?.nombre ?? 'Desconocido'} (${gameInfo?.proveedor ?? '?'})`);
        await clickearPrimerJuego(page);
        await page.screenshot({
          path: `test-results/${nombre.toLowerCase().replace(/\s+/g, '-')}-opened.png`,
        });
      });

      await test.step('Esperar game frame', async () => {
        await esperarGameFrame(page);
      });

      await test.step('Cerrar intro del juego', async () => {
        await cerrarIntroJuego(page);
        await page.waitForTimeout(2000);
      });

      let resumen: SpinsResumen;
      await test.step('Ejecutar 3 spins', async () => {
        resumen = await ejecutarSpins(page, 3);
      });

      await test.step('Validar resultados', async () => {
        console.log(`\nJuego: ${gameInfo?.nombre ?? 'Desconocido'} (${nombre})`);
        console.log(`Spins exitosos: ${resumen.spinsExitosos}/${resumen.totalSpins}`);
        console.log(`Ganancia total: $${resumen.gananciaTotal.toFixed(2)}`);
        console.log(`Resultado: ${resumen.resultado.toUpperCase()}`);

        // Verificar que al menos un spin produjo datos reales del juego
        // (respuesta HTTP/WS con balance o ganancia, no solo "visual")
        const spinsConDatos = resumen.detalle.filter(
          (s) => s.success && (s.winAmount != null || s.balanceAfter != null)
        );
        console.log(`Spins con datos reales: ${spinsConDatos.length}/${resumen.spinsExitosos}`);

        expect(
          spinsConDatos.length,
          `Ningun spin produjo datos reales del juego (balance/ganancia). ` +
          `Los spins no se estan ejecutando realmente. ` +
          `Verificar: 1) intro del juego cerrada, 2) coordenadas del boton spin correctas, ` +
          `3) juego completamente cargado.`
        ).toBeGreaterThan(0);
      });

      await page.screenshot({
        path: `test-results/${nombre.toLowerCase().replace(/\s+/g, '-')}-final.png`,
      });
    });
  }
});

// ====== Tests: Secciones Mesa/Live (interaccion generica) ======

const SECCIONES_MESA: { seccion: SectionConfig; nombre: string }[] = [
  { seccion: SECCIONES.ruletas, nombre: 'Ruletas' },
  { seccion: SECCIONES.blackjack, nombre: 'Blackjack' },
];

test.describe('Secciones Mesa - Jugar', () => {
  for (const { seccion, nombre } of SECCIONES_MESA) {
    test(`${nombre} - Abrir juego e intentar interactuar`, async ({ page }) => {
      await test.step('Login y navegacion', () => loginYNavegar(page));

      let gameInfo: { nombre: string; proveedor: string } | null = null;
      await test.step(`Navegar a ${nombre}`, async () => {
        await navegarASeccion(page, seccion);
        const count = await verificarSeccionCargada(page, seccion);
        console.log(`${nombre}: ${count} juegos`);
      });

      await test.step('Obtener info y abrir primer juego', async () => {
        gameInfo = await obtenerInfoPrimerJuego(page);
        console.log(`Juego: ${gameInfo?.nombre ?? 'Desconocido'} (${gameInfo?.proveedor ?? '?'})`);
        await clickearPrimerJuego(page);
      });

      await test.step('Esperar carga del juego', async () => {
        const frame = await verificarCargaJuego(page);
        if (frame) {
          console.log(`Juego cargado en frame: ${frame.url().substring(0, 100)}`);
        } else {
          console.log('Frame de juego no detectado (puede ser juego live)');
        }
        await page.screenshot({
          path: `test-results/${nombre.toLowerCase().replace(/\s+/g, '-')}-loaded.png`,
        });
      });

      let resultado: Awaited<ReturnType<typeof interaccionGenerica>>;
      await test.step('Interactuar con el juego', async () => {
        resultado = await interaccionGenerica(page, nombre);
      });

      await test.step('Validar interaccion', async () => {
        console.log(`\nJuego: ${gameInfo?.nombre ?? 'Desconocido'} (${nombre})`);
        console.log(`Canvas encontrado: ${resultado.canvasEncontrado}`);
        console.log(`Respuestas del juego: ${resultado.respuestasDetectadas}`);
        console.log(`Interacciones: ${resultado.interacciones.join(', ')}`);

        // El juego debe al menos haber cargado el canvas
        expect(resultado.canvasEncontrado, 'El juego deberia mostrar un canvas').toBeTruthy();
      });

      await page.screenshot({
        path: `test-results/${nombre.toLowerCase().replace(/\s+/g, '-')}-final.png`,
      });
    });
  }
});

// ====== Test: Bingo (mecanica propia) ======

test.describe('Bingo - Jugar', () => {
  test('Bingo - Abrir juego e intentar interactuar', async ({ page }) => {
    await test.step('Login y navegacion', () => loginYNavegar(page));

    let gameInfo: { nombre: string; proveedor: string } | null = null;
    await test.step('Navegar a Bingo', async () => {
      await navegarASeccion(page, SECCIONES.bingo);
      const count = await verificarSeccionCargada(page, SECCIONES.bingo);
      console.log(`Bingo: ${count} juegos`);
    });

    await test.step('Obtener info y abrir primer juego', async () => {
      gameInfo = await obtenerInfoPrimerJuego(page);
      console.log(`Juego: ${gameInfo?.nombre ?? 'Desconocido'} (${gameInfo?.proveedor ?? '?'})`);
      await clickearPrimerJuego(page);
    });

    let gameFrame: Frame | null = null;
    await test.step('Esperar carga del juego', async () => {
      const frame = await verificarCargaJuego(page);
      if (frame) {
        gameFrame = frame;
        console.log(`Juego cargado en frame: ${frame.url().substring(0, 100)}`);
      }
      await page.screenshot({ path: 'test-results/bingo-loaded.png' });
    });

    await test.step('Validar carga del juego', async () => {
      // Bingo games (Caleta Holdings) use HTML/DOM instead of canvas.
      // Verify that either a canvas OR a game iframe loaded successfully.
      let canvasFound = false;
      let gameFrameLoaded = false;

      // Check canvas
      const canvasResult = await encontrarCanvas(page).catch(() => null);
      if (canvasResult) {
        canvasFound = true;
        console.log('Bingo: Canvas encontrado');
      }

      // Check game iframe (non-blank, non-main frame)
      if (!canvasFound) {
        for (const f of page.frames()) {
          if (f === page.mainFrame() || f.url() === 'about:blank') continue;
          const url = f.url();
          if (url.includes('bingo') || url.includes('caleta') || url.includes('game')) {
            gameFrameLoaded = true;
            console.log(`Bingo: Game frame loaded: ${url.substring(0, 120)}`);
            break;
          }
        }
        // If no bingo-specific frame, check for any non-trivial iframe
        if (!gameFrameLoaded) {
          const nonTrivialFrames = page.frames().filter(
            (f) => f !== page.mainFrame() && f.url() !== 'about:blank' && f.url().length > 20
          );
          if (nonTrivialFrames.length > 0) {
            gameFrameLoaded = true;
            console.log(`Bingo: Game loaded in iframe: ${nonTrivialFrames[0].url().substring(0, 120)}`);
          }
        }
      }

      console.log(`\nJuego: ${gameInfo?.nombre ?? 'Desconocido'} (Bingo)`);
      console.log(`Canvas: ${canvasFound}, Game frame: ${gameFrameLoaded}`);

      expect(
        canvasFound || gameFrameLoaded,
        'El juego de bingo deberia cargar (canvas o iframe)'
      ).toBeTruthy();
    });

    // Try generic interaction if canvas was found
    const canvasResult = await encontrarCanvas(page).catch(() => null);
    if (canvasResult) {
      let resultado: Awaited<ReturnType<typeof interaccionGenerica>>;
      await test.step('Interactuar con el juego', async () => {
        resultado = await interaccionGenerica(page, 'Bingo');
      });

      await test.step('Validar interaccion', async () => {
        console.log(`Respuestas del juego: ${resultado.respuestasDetectadas}`);
        console.log(`Interacciones: ${resultado.interacciones.join(', ')}`);
      });
    } else {
      console.log('Bingo: Skipping canvas interaction (HTML-based game)');
    }

    await page.screenshot({ path: 'test-results/bingo-final.png' });
  });
});
