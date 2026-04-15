import { test } from '@playwright/test';
import { flujoCompletoJuego } from './utils/flujo-juego';

test.describe('Fruit Party - Flujo completo', () => {
  test('Login, buscar Fruit Party y jugar', async ({ page }) => {
    await flujoCompletoJuego(page, {
      nombreJuego: 'Fruit Party',
      busqueda: 'Fruit Party',
      clickMatch: 'Fruit',
      framePatterns: ['pragmaticplay', 'ppgames', 'casinomodule', 'gs.pragmatic'],
      cerrarIntro: true,
      spinConfig: { xRatio: 0.67, yRatio: 0.88 },
    });
  });
});
