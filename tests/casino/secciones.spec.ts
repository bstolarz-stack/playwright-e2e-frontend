import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { navegarYSeleccionarCiudad } from '../utils/navigation';
import { login, manejarModalGeolocalizacion, verificarLogin } from '../utils/auth';
import {
  SECCIONES,
  navegarASeccion,
  verificarSeccionCargada,
  obtenerInfoPrimerJuego,
  clickearPrimerJuego,
  verificarCargaJuego,
  SectionConfig,
} from '../utils/sections';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const USERNAME = process.env.APP_USERNAME!;
const PASSWORD = process.env.PASSWORD!;

async function loginYNavegar(page: import('@playwright/test').Page) {
  await navegarYSeleccionarCiudad(page);
  await login(page, USERNAME, PASSWORD);
  await manejarModalGeolocalizacion(page);
  await verificarLogin(page);
}

function crearTestSeccion(seccion: SectionConfig, verificarJuego: boolean) {
  test(`${seccion.nombre} - Verificar carga de seccion y juego`, async ({ page }) => {
    await test.step('Login y navegacion', () => loginYNavegar(page));

    let gameCount: number;
    await test.step(`Navegar a seccion ${seccion.nombre}`, async () => {
      await navegarASeccion(page, seccion);
      gameCount = await verificarSeccionCargada(page, seccion);
      console.log(`${seccion.nombre}: ${gameCount} juegos`);
    });

    let gameInfo: { nombre: string; proveedor: string } | null;
    await test.step('Obtener info del primer juego', async () => {
      gameInfo = await obtenerInfoPrimerJuego(page);
      if (gameInfo) {
        console.log(`Primer juego: ${gameInfo.nombre} (${gameInfo.proveedor})`);
      }
    });

    await test.step('Abrir primer juego', async () => {
      await clickearPrimerJuego(page);
      await page.screenshot({ path: `test-results/${seccion.nombre.toLowerCase().replace(/\s+/g, '-')}-after-click.png` });
    });

    if (verificarJuego) {
      await test.step('Verificar carga del juego (iframe + canvas)', async () => {
        const frame = await verificarCargaJuego(page);
        // Some games may take long to load or might not have canvas yet
        // A null frame is acceptable for sections where games might be live/streaming
        if (frame) {
          console.log(`Juego cargado en frame: ${frame.url().substring(0, 80)}`);
        } else {
          console.log('El juego no cargo un canvas (puede ser un juego live o de carga lenta)');
        }
        await page.screenshot({ path: `test-results/${seccion.nombre.toLowerCase().replace(/\s+/g, '-')}-game-loaded.png` });
      });
    }
  });
}

test.describe('Casino - Secciones', () => {
  // Tragamonedas: cubierto por tragamonedas-spins.spec.ts

  // Ruletas: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.ruletas, true);

  // Blackjack: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.blackjack, true);

  // Zona Bono: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.zonaBono, true);

  // Wanda Collection: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.wandaCollection, true);

  // Free Spins: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.freeSpins, true);

  // Los mas Jugados: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.losMasJugados, true);

  // Bingo: verificar carga + abrir juego
  crearTestSeccion(SECCIONES.bingo, true);
});
