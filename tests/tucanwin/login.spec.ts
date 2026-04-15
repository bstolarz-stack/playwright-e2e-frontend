import { test } from '@playwright/test';
import { loginTucanwin } from './utils/auth';

/**
 * E2E: el login del env de testing de TucanWin funciona.
 *
 * El env testing auto-rellena las credenciales al abrir el modal, asi que el
 * helper solo abre el modal y hace click en "Ingresar". La verificacion del
 * exito (balance visible en header) la hace el propio helper via `expect`.
 */
test('tucanwin - login funciona en env de testing', async ({ page }) => {
  await loginTucanwin(page);
});
