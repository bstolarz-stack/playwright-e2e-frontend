import { test, expect } from '@playwright/test';
import {
  getGamesByCategory,
  getHomeGameSections,
  getEnabledGamesByHomeSection,
} from './utils/api';

/**
 * Smoke contra el backend de TucanWin (env de testing).
 * No usa el navegador — corre directamente contra la API.
 */

test('API tucanwin - home expone al menos 1 seccion gameCategory', async () => {
  const sections = await getHomeGameSections();
  expect(sections.length).toBeGreaterThan(0);
  for (const s of sections) {
    expect(s.categoryId).toBeGreaterThan(0);
    expect(s.categoryName.length).toBeGreaterThan(0);
  }
});

test('API tucanwin - cada seccion del home tiene al menos 1 juego habilitado', async () => {
  const sections = await getHomeGameSections();
  for (const s of sections) {
    const games = await getGamesByCategory(s.categoryId, { pageSize: 5 });
    expect(games.length, `categoria ${s.categoryId} (${s.categoryName})`).toBeGreaterThan(0);
    const first = games[0];
    expect(first.gameCode.length).toBeGreaterThan(0);
    expect(first.providerName.length).toBeGreaterThan(0);
  }
});

test('API tucanwin - getEnabledGamesByHomeSection devuelve mapa por categoryId', async () => {
  const map = await getEnabledGamesByHomeSection();
  const keys = Object.keys(map);
  expect(keys.length).toBeGreaterThan(0);
  for (const k of keys) {
    const entry = map[Number(k)];
    expect(entry.section.categoryId).toBe(Number(k));
    expect(entry.games.length).toBeGreaterThan(0);
  }
});
