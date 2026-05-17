import { test, expect } from '@playwright/test';
import { loginTucanwin, TUCANWIN_BASE_URL } from './utils/auth';

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

/**
 * E2E: registracion exitosa del paso 1.
 *
 * Llena todos los campos con datos validos (DNI 30123456 que RENAPER reconoce
 * como "DIEGO ALEJAN" en el env de testing), envia el formulario y verifica
 * que aparezca el modal pidiendo validar el email.
 *
 * En el env de testing Cloudflare Turnstile esta bypassed.
 *
 * Selectores descubiertos via MCP de Playwright (input[name="..."]):
 *   documentNumber, identificationNumber, email, confirmEmail, password, confirmPassword.
 */
test('tucanwin - registracion exitosa paso 1', async ({ page }) => {
  await test.step('Navegar a pagina de registro', async () => {
    await page.goto(`${TUCANWIN_BASE_URL}/registration`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(2000);

    const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
    if (await countdownClose.isVisible().catch(() => false)) {
      await countdownClose.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  });

  await test.step('Verificar que el formulario cargo', async () => {
    await expect(page.getByRole('heading', { name: /crear tu cuenta/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  await test.step('Llenar formulario con datos validos', async () => {
    await page.locator('input[name="documentNumber"]').fill('30123456');
    await page.locator('input[name="identificationNumber"]').fill('00123456789');
    await page.getByRole('combobox').selectOption('Masculino');
    await page.getByPlaceholder('Cod. área sin el 0').fill('11');
    await page.getByPlaceholder(/Nro.*tel[eé]fono sin el 15/i).fill('55667788');
    await page.locator('input[name="email"]').fill('test.registro@example.com');
    await page.locator('input[name="confirmEmail"]').fill('test.registro@example.com');
    await page.locator('input[name="password"]').fill('TestReg1!');
    await page.locator('input[name="confirmPassword"]').fill('TestReg1!');
    await page.getByRole('checkbox').check();
  });

  await test.step('Click Siguiente y verificar modal de validacion de email', async () => {
    const siguienteBtn = page.getByRole('button', { name: 'Siguiente' });
    await expect(siguienteBtn).toBeEnabled();
    await siguienteBtn.click();

    // El env de testing acepta el envio (sin Turnstile) y muestra el modal
    // "¡Hola <NOMBRE>!" con la instruccion de validar el email.
    await expect(
      page.getByText('Te enviamos un email para validar tu correo', { exact: false }),
    ).toBeVisible({ timeout: 15_000 });

    console.log('OK: registracion paso 1 enviada — modal de validacion de email visible');
  });
});

/**
 * E2E: registracion bloqueada por menor de edad.
 *
 * Usa un DNI que RENAPER (mock del env de testing) devuelve como menor de
 * edad. Despues de "Siguiente" el form muestra el modal:
 *   "¡Lo sentimos! No podés completar el registro"
 *   "Los datos ingresados corresponden a un menor de edad..."
 * y el flujo NO avanza al paso 2.
 */
test('tucanwin - registracion bloqueada por menor de edad', async ({ page }) => {
  await test.step('Navegar a pagina de registro', async () => {
    await page.goto(`${TUCANWIN_BASE_URL}/registration`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(2000);

    const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
    if (await countdownClose.isVisible().catch(() => false)) {
      await countdownClose.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  });

  await test.step('Llenar formulario con DNI de menor de edad', async () => {
    // DNI 55000000 corresponde a un menor de edad en el mock de RENAPER del
    // env de testing.
    await page.locator('input[name="documentNumber"]').fill('55000000');
    await page.locator('input[name="identificationNumber"]').fill('00123456789');
    await page.getByRole('combobox').selectOption('Masculino');
    await page.getByPlaceholder('Cod. área sin el 0').fill('11');
    await page.getByPlaceholder(/Nro.*tel[eé]fono sin el 15/i).fill('55667788');
    await page.locator('input[name="email"]').fill('menor@example.com');
    await page.locator('input[name="confirmEmail"]').fill('menor@example.com');
    await page.locator('input[name="password"]').fill('TestReg1!');
    await page.locator('input[name="confirmPassword"]').fill('TestReg1!');
    await page.getByRole('checkbox').check();
  });

  await test.step('Click Siguiente y verificar bloqueo por menor de edad', async () => {
    const siguienteBtn = page.getByRole('button', { name: 'Siguiente' });
    await expect(siguienteBtn).toBeEnabled();
    await siguienteBtn.click();

    // Modal de error: el flujo NO avanza al paso 2.
    await expect(
      page.getByRole('heading', { name: /no pod[eé]s completar el registro/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('corresponden a un menor de edad', { exact: false }),
    ).toBeVisible();

    console.log('OK: registracion bloqueada por menor de edad');
  });
});
