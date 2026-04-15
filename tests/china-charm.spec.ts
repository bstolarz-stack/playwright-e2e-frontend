import { test } from '@playwright/test';
import { flujoCompletoJuego } from './utils/flujo-juego';

test.describe('China Charm - Flujo completo', () => {
  test('Login, buscar China Charm y jugar', async ({ page }) => {
    await flujoCompletoJuego(page, {
      nombreJuego: 'China Charm',
      busqueda: 'China',
      clickMatch: 'China',
    });
  });
});
