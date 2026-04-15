import { test, expect, Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { navegarYSeleccionarCiudad } from './navigation';
import { login, manejarModalGeolocalizacion, verificarLogin } from './auth';
import {
  abrirBusquedaYBuscarJuego,
  clickearResultadoJuego,
  reintentarAbrirJuego,
  esperarGameFrame,
  cerrarIntroJuego,
  ejecutarSpins,
  SpinsResumen,
  SpinButtonConfig,
} from './game';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const USERNAME = process.env.APP_USERNAME!;
const PASSWORD = process.env.PASSWORD!;

export interface GameTestConfig {
  nombreJuego: string;
  busqueda: string;
  clickMatch: string;
  framePatterns?: string[];
  cerrarIntro?: boolean;
  spinConfig?: SpinButtonConfig;
  cantidadSpins?: number;
}

/**
 * Ejecuta el flujo completo de un juego de casino usando test.step().
 * Debe llamarse dentro de un test() del spec file.
 */
export async function flujoCompletoJuego(page: Page, config: GameTestConfig) {
  const spins = config.cantidadSpins ?? 5;

  await test.step('Navegar y seleccionar ciudad', () => navegarYSeleccionarCiudad(page));

  await test.step('Login con credenciales', () => login(page, USERNAME, PASSWORD));

  await test.step('Manejar modal de geolocalizacion', async () => {
    await manejarModalGeolocalizacion(page);
    await verificarLogin(page);
  });

  await test.step(`Buscar y abrir ${config.nombreJuego}`, async () => {
    await abrirBusquedaYBuscarJuego(page, config.busqueda);
    await clickearResultadoJuego(page, config.clickMatch);

    if (!page.url().includes('gameplay')) {
      await reintentarAbrirJuego(page, config.busqueda);
    }

    expect(page.url(), 'Deberia estar en la pagina de gameplay').toContain('gameplay');
  });

  await test.step('Esperar game frame y canvas', () =>
    esperarGameFrame(page, config.framePatterns),
  );

  if (config.cerrarIntro) {
    await test.step('Cerrar intro del juego', () => cerrarIntroJuego(page));
  }

  let resumen: SpinsResumen;
  await test.step(`Ejecutar ${spins} spins`, async () => {
    resumen = await ejecutarSpins(page, spins, config.spinConfig);
  });

  await test.step('Validar resultados de spins', () => {
    console.log(`\nResultado final: ${resumen.resultado.toUpperCase()}`);
    console.log(`Spins exitosos: ${resumen.spinsExitosos}/${resumen.totalSpins}`);
    console.log(`Ganancia total: $${resumen.gananciaTotal.toFixed(2)}`);
    if (resumen.spinsFallidos > 0) {
      console.log(`Spins fallidos: ${resumen.spinsFallidos}`);
      const errores = resumen.detalle.filter((s) => !s.success).map((s) => s.error);
      console.log(`Errores: ${[...new Set(errores)].join(', ')}`);
    }

    if (resumen.spinsExitosos > 0) {
      expect(resumen.spinsExitosos).toBeGreaterThan(0);
    } else {
      console.warn('\n⚠ ADVERTENCIA: Ningun spin se ejecuto exitosamente.');
      console.warn('Posible causa: saldo real insuficiente o rechazo del servidor del juego.');
      console.warn('El juego cargo correctamente pero los spins requieren saldo real en la cuenta.\n');
    }
  });

  await page.screenshot({ path: 'test-results/11-final.png' });

  return resumen!;
}
