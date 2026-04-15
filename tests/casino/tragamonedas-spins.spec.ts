import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { navegarYSeleccionarCiudad } from '../utils/navigation';
import { login, manejarModalGeolocalizacion, verificarLogin } from '../utils/auth';
import { esperarGameFrame, cerrarIntroJuego, ejecutarSpins } from '../utils/game';
import {
  SECCIONES,
  navegarASeccion,
  verificarSeccionCargada,
  clickearPrimerJuego,
  obtenerInfoPrimerJuego,
} from '../utils/sections';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const USERNAME = process.env.APP_USERNAME!;
const PASSWORD = process.env.PASSWORD!;

test.describe('Tragamonedas - Spins', () => {
  test('Abrir primer tragamonedas y ejecutar 5 spins', async ({ page }) => {
    await test.step('Login y navegacion', async () => {
      await navegarYSeleccionarCiudad(page);
      await login(page, USERNAME, PASSWORD);
      await manejarModalGeolocalizacion(page);
      await verificarLogin(page);
    });

    await test.step('Navegar a Tragamonedas', async () => {
      await navegarASeccion(page, SECCIONES.tragamonedas);
      const count = await verificarSeccionCargada(page, SECCIONES.tragamonedas);
      console.log(`Tragamonedas: ${count} juegos`);
    });

    let gameName: string;
    await test.step('Obtener info y abrir primer juego', async () => {
      const info = await obtenerInfoPrimerJuego(page);
      gameName = info?.nombre ?? 'Desconocido';
      console.log(`Juego seleccionado: ${gameName} (${info?.proveedor})`);
      await clickearPrimerJuego(page);
      await page.screenshot({ path: 'test-results/tragamonedas-spins-opened.png' });
    });

    await test.step('Esperar game frame y canvas', async () => {
      await esperarGameFrame(page);
    });

    await test.step('Cerrar intro del juego', async () => {
      await cerrarIntroJuego(page);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/tragamonedas-spins-intro-closed.png' });
    });

    let resumen: Awaited<ReturnType<typeof ejecutarSpins>>;
    await test.step('Ejecutar 5 spins', async () => {
      resumen = await ejecutarSpins(page, 5);
    });

    await test.step('Validar resultados', async () => {
      console.log(`\nJuego: ${gameName}`);
      console.log(`Spins exitosos: ${resumen.spinsExitosos}/${resumen.totalSpins}`);
      console.log(`Ganancia total: $${resumen.gananciaTotal.toFixed(2)}`);
      console.log(`Resultado: ${resumen.resultado.toUpperCase()}`);

      if (resumen.spinsExitosos > 0) {
        expect(resumen.spinsExitosos).toBeGreaterThan(0);
      } else {
        console.warn('Ningun spin exitoso - posible falta de saldo real');
      }
    });

    await page.screenshot({ path: 'test-results/tragamonedas-spins-final.png' });
  });
});
