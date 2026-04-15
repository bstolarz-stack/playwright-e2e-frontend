import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { navegarYSeleccionarCiudad } from './utils/navigation';
import { login, manejarModalGeolocalizacion, verificarLogin } from './utils/auth';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const USERNAME = process.env.APP_USERNAME!;
const PASSWORD = process.env.PASSWORD!;

test.describe('Casino seed', () => {
  test('Login y navegar al casino', async ({ page }) => {
    await navegarYSeleccionarCiudad(page);
    await login(page, USERNAME, PASSWORD);
    await manejarModalGeolocalizacion(page);
    await verificarLogin(page);
    await page.goto('https://pba.sports.bet.ar/casino/index', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(3000);
  });
});
