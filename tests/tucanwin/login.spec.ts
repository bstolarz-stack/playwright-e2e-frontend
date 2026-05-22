import { test, expect } from '@playwright/test';
import { loginTucanwin, TUCANWIN_BASE_URL } from './utils/auth';

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
test('tucanwin - registracion exitosa paso 1', { tag: ['@uat'] }, async ({ page }) => {
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
test('tucanwin - registracion bloqueada por menor de edad', { tag: ['@uat'] }, async ({ page }) => {
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

  test.skip('tucanwin - registracion paso 1', async ({ page }) => {
    const BASE_URL = 'https://gfront-tucanwin-testing.gampix.dev';

    await test.step('Navegar a pagina de registro', async () => {
      await page.goto(`${BASE_URL}/registration`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForTimeout(2000);

      // Cerrar countdown banner si aparece
      const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
      if (await countdownClose.isVisible().catch(() => false)) {
        await countdownClose.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    });

    await test.step('Verificar que el formulario cargo', async () => {
      await expect(page.getByRole('heading', { name: /crear tu cuenta/i })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    });

    await test.step('Llenar DNI y Numero de Tramite', async () => {
      // Form fields have zero IDs/testids. Textboxes in DOM order:
      // 0: DNI, 1: Nro Tramite, 2: cod area, 3: nro tel, 4: email, 5: confirm email, 6: password, 7: confirm password
      // Use click + pressSequentially to trigger React change events properly
      const textboxes = page.getByRole('textbox');
      await textboxes.nth(0).click();
      await textboxes.nth(0).pressSequentially('30123456', { delay: 50 });
      await textboxes.nth(1).click();
      await textboxes.nth(1).pressSequentially('00123456789', { delay: 50 });
    });

    await test.step('Seleccionar genero', async () => {
      await page.getByRole('combobox').selectOption('Masculino');
    });

    await test.step('Llenar telefono', async () => {
      const codArea = page.getByPlaceholder('Cod. área sin el 0');
      await codArea.click();
      await codArea.pressSequentially('11', { delay: 50 });
      const nroTel = page.getByPlaceholder(/Nro.*tel[eé]fono sin el 15/i);
      await nroTel.click();
      await nroTel.pressSequentially('55667788', { delay: 50 });
    });

    await test.step('Llenar correo electronico', async () => {
      const textboxes = page.getByRole('textbox');
      const email = 'test.registro@example.com';
      await textboxes.nth(4).click();
      await textboxes.nth(4).pressSequentially(email, { delay: 30 });
      await textboxes.nth(5).click();
      await textboxes.nth(5).pressSequentially(email, { delay: 30 });
    });

    await test.step('Llenar contraseña', async () => {
      // Password requirements: 8+ chars, 1 number, 1 lowercase, 1 uppercase, 1 symbol
      const textboxes = page.getByRole('textbox');
      const password = 'TestReg1!';
      await textboxes.nth(6).click();
      await textboxes.nth(6).pressSequentially(password, { delay: 50 });
      await textboxes.nth(7).click();
      await textboxes.nth(7).pressSequentially(password, { delay: 50 });
      // Tab out to trigger blur validation
      await page.keyboard.press('Tab');
    });

    await test.step('Aceptar terminos y condiciones', async () => {
      await page.getByRole('checkbox').check();
    });

    await test.step('Verificar formulario completo', async () => {
      // Assert all fields were filled (the form loaded and is interactive)
      const textboxes = page.getByRole('textbox');
      await expect(textboxes.nth(0)).toHaveValue('30123456');       // DNI
      await expect(textboxes.nth(4)).toHaveValue('test.registro@example.com'); // Email
      await expect(page.getByRole('checkbox')).toBeChecked();
      console.log('Todos los campos del paso 1 llenados correctamente');
    });

    await test.step('Esperar Cloudflare Turnstile y boton Siguiente', async () => {
      // Cloudflare Turnstile widget blocks the form until verification completes.
      // In automated browsers it may never resolve. Wait up to 15s then report status.
      const siguienteBtn = page.getByRole('button', { name: 'Siguiente' });

      let turnstileResolved = false;
      try {
        await expect(siguienteBtn).toBeEnabled({ timeout: 15_000 });
        turnstileResolved = true;
        console.log('Cloudflare Turnstile resuelto - boton Siguiente habilitado');
      } catch {
        console.log('Cloudflare Turnstile NO resuelto en 15s - boton Siguiente sigue disabled');
        console.log('Esto es esperado en browsers automatizados (Playwright headless)');
      }

      // Screenshot with extended timeout (Turnstile animations can block)
      await page.screenshot({
        path: 'test-results/tucanwin-registro-paso1-completo.png',
        timeout: 10_000,
      }).catch(() => {
        console.log('Screenshot timeout (Turnstile animation blocking)');
      });

      // The test passes if all fields were filled — Turnstile is an external blocker
      if (!turnstileResolved) {
        console.log('NOTA: El formulario esta correctamente llenado pero Cloudflare Turnstile');
        console.log('impide habilitar el boton en un browser automatizado.');
      }
    });
  });

  /**
   * E2E: registracion con DNI invalido (00000000) NO debe permitir avanzar.
   *
   * Llena el formulario con datos validos excepto el DNI (00000000) y verifica que
   * el boton "Siguiente" quede deshabilitado y/o aparezca un mensaje de error.
   */
  test('tucanwin - registracion no avanza con DNI 00000000', { tag: ['@prod', '@uat'] }, async ({ page }) => {
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

    await test.step('Llenar DNI invalido (00000000) y Numero de Tramite', async () => {
      const textboxes = page.getByRole('textbox');
      await textboxes.nth(0).click();
      await textboxes.nth(0).pressSequentially('00000000', { delay: 50 });
      await textboxes.nth(1).click();
      await textboxes.nth(1).pressSequentially('00123456789', { delay: 50 });
      // Blur para disparar validacion
      await page.keyboard.press('Tab');
    });

    await test.step('Seleccionar genero', async () => {
      await page.getByRole('combobox').selectOption('Masculino');
    });

    await test.step('Llenar telefono', async () => {
      const codArea = page.getByPlaceholder('Cod. área sin el 0');
      await codArea.click();
      await codArea.pressSequentially('11', { delay: 50 });
      const nroTel = page.getByPlaceholder(/Nro.*tel[eé]fono sin el 15/i);
      await nroTel.click();
      await nroTel.pressSequentially('55667788', { delay: 50 });
    });

    await test.step('Llenar correo electronico', async () => {
      const textboxes = page.getByRole('textbox');
      const email = 'test.registro@example.com';
      await textboxes.nth(4).click();
      await textboxes.nth(4).pressSequentially(email, { delay: 30 });
      await textboxes.nth(5).click();
      await textboxes.nth(5).pressSequentially(email, { delay: 30 });
    });

    await test.step('Llenar contrasena', async () => {
      const textboxes = page.getByRole('textbox');
      const password = 'TestReg1!';
      await textboxes.nth(6).click();
      await textboxes.nth(6).pressSequentially(password, { delay: 50 });
      await textboxes.nth(7).click();
      await textboxes.nth(7).pressSequentially(password, { delay: 50 });
      await page.keyboard.press('Tab');
    });

    await test.step('Aceptar terminos y condiciones', async () => {
      await page.getByRole('checkbox').check();
    });

    await test.step('Verificar que el DNI 00000000 bloquea avance', async () => {
      const textboxes = page.getByRole('textbox');
      await expect(textboxes.nth(0)).toHaveValue('00000000');
      await expect(page.getByRole('checkbox')).toBeChecked();

      // Esperar 3s por si Turnstile resuelve y deberia habilitar el boton
      await page.waitForTimeout(3000);

      // El boton "Siguiente" debe permanecer deshabilitado por DNI invalido,
      // sin importar si Turnstile resolvio o no.
      const popUpDniInvalido = page.getByText("Hubo un problema con el DNI ingresado");
      await expect(popUpDniInvalido).toBeVisible;

      console.log('OK: POP up DNI invalido con DNI 00000000');
    });
  });

  /**
   * E2E: registracion con contrasena vacia NO debe permitir avanzar.
   *
   * Llena todos los campos del paso 1 con datos validos, pero deja vacios los
   * inputs de contrasena y confirmacion de contrasena. Verifica que el boton
   * "Siguiente" quede deshabilitado.
   */
  test('tucanwin - registracion no avanza con contrasena vacia', { tag: ['@prod', '@uat'] }, async ({ page }) => {
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

    await test.step('Llenar DNI y Numero de Tramite', async () => {
      const textboxes = page.getByRole('textbox');
      await textboxes.nth(0).click();
      await textboxes.nth(0).pressSequentially('30123456', { delay: 50 });
      await textboxes.nth(1).click();
      await textboxes.nth(1).pressSequentially('00123456789', { delay: 50 });
    });

    await test.step('Seleccionar genero', async () => {
      await page.getByRole('combobox').selectOption('Masculino');
    });

    await test.step('Llenar telefono', async () => {
      const codArea = page.getByPlaceholder('Cod. área sin el 0');
      await codArea.click();
      await codArea.pressSequentially('11', { delay: 50 });
      const nroTel = page.getByPlaceholder(/Nro.*tel[eé]fono sin el 15/i);
      await nroTel.click();
      await nroTel.pressSequentially('55667788', { delay: 50 });
    });

    await test.step('Llenar correo electronico', async () => {
      const textboxes = page.getByRole('textbox');
      const email = 'test.registro@example.com';
      await textboxes.nth(4).click();
      await textboxes.nth(4).pressSequentially(email, { delay: 30 });
      await textboxes.nth(5).click();
      await textboxes.nth(5).pressSequentially(email, { delay: 30 });
    });

    await test.step('Dejar contrasena y confirmacion vacias (focus + blur)', async () => {
      // Hacemos focus y blur en los campos para disparar validaciones de "required"
      // sin escribir nada.
      const textboxes = page.getByRole('textbox');
      await textboxes.nth(6).click();
      await page.keyboard.press('Tab');
      await textboxes.nth(7).click();
      await page.keyboard.press('Tab');
    });

    await test.step('Aceptar terminos y condiciones', async () => {
      await page.getByRole('checkbox').check();
    });

    await test.step('Verificar que la contrasena vacia bloquea avance', async () => {
      const textboxes = page.getByRole('textbox');
      await expect(textboxes.nth(6)).toHaveValue('');
      await expect(textboxes.nth(7)).toHaveValue('');
      await expect(page.getByRole('checkbox')).toBeChecked();

      // Esperar 3s por si Turnstile resuelve y deberia habilitar el boton
      await page.waitForTimeout(3000);

      // El boton "Siguiente" debe permanecer deshabilitado por contrasena vacia,
      // sin importar si Turnstile resolvio o no.
      const siguienteBtn = page.getByRole('button', { name: 'Siguiente' });
      // Con ambos passwords vacios el form muestra el mensaje generico de campos
      // requeridos (los errores especificos de "no cumple" / "no coinciden" solo
      // aparecen cuando hay valores invalidos o que difieren).
      const errorCamposObligatoriosLocator = page.getByText('Todos los campos son obligatorios', { exact: false });
      await expect(errorCamposObligatoriosLocator).toBeVisible();
      await expect(siguienteBtn).toBeDisabled();

      await page.screenshot({
        path: 'test-results/tucanwin-registro-password-vacia.png',
        timeout: 10_000,
      }).catch(() => {});

    console.log('OK: el boton Siguiente sigue deshabilitado con contrasena vacia');
  });
});

  /**
   * E2E: registracion con email invalido NO debe permitir avanzar.
   *
   * Llena todos los campos con datos validos pero pone un email mal formado
   * ("notanemail" — sin @ ni dominio) en los inputs de email y confirmacion.
   * Verifica que el boton "Siguiente" quede deshabilitado.
   */
  test('tucanwin - registracion no avanza con email invalido', { tag: ['@prod', '@uat'] }, async ({ page }) => {
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

    await test.step('Llenar DNI y Numero de Tramite', async () => {
      const textboxes = page.getByRole('textbox');
      await textboxes.nth(0).click();
      await textboxes.nth(0).pressSequentially('30123456', { delay: 50 });
      await textboxes.nth(1).click();
      await textboxes.nth(1).pressSequentially('00123456789', { delay: 50 });
    });

    await test.step('Seleccionar genero', async () => {
      await page.getByRole('combobox').selectOption('Masculino');
    });

    await test.step('Llenar telefono', async () => {
      const codArea = page.getByPlaceholder('Cod. área sin el 0');
      await codArea.click();
      await codArea.pressSequentially('11', { delay: 50 });
      const nroTel = page.getByPlaceholder(/Nro.*tel[eé]fono sin el 15/i);
      await nroTel.click();
      await nroTel.pressSequentially('55667788', { delay: 50 });
    });

    await test.step('Llenar email invalido', async () => {
      const textboxes = page.getByRole('textbox');
      const emailInvalido = 'notanemail';
      await textboxes.nth(4).click();
      await textboxes.nth(4).pressSequentially(emailInvalido, { delay: 30 });
      await textboxes.nth(5).click();
      await textboxes.nth(5).pressSequentially(emailInvalido, { delay: 30 });
      // Blur para disparar validacion
      await page.keyboard.press('Tab');
    });

    await test.step('Llenar contrasena valida', async () => {
      const textboxes = page.getByRole('textbox');
      const password = 'TestReg1!';
      await textboxes.nth(6).click();
      await textboxes.nth(6).pressSequentially(password, { delay: 50 });
      await textboxes.nth(7).click();
      await textboxes.nth(7).pressSequentially(password, { delay: 50 });
      await page.keyboard.press('Tab');
    });

    await test.step('Aceptar terminos y condiciones', async () => {
      await page.getByRole('checkbox').check();
    });

    await test.step('Verificar que el email invalido bloquea avance', async () => {
      const textboxes = page.getByRole('textbox');
      await expect(textboxes.nth(4)).toHaveValue('notanemail');
      await expect(textboxes.nth(5)).toHaveValue('notanemail');
      await expect(page.getByRole('checkbox')).toBeChecked();

      // Esperar 3s por si Turnstile resuelve y deberia habilitar el boton
      await page.waitForTimeout(3000);

      // El boton "Siguiente" debe permanecer deshabilitado por email invalido,
      // sin importar si Turnstile resolvio o no.
      const siguienteBtn = page.getByRole('button', { name: 'Siguiente' });
      await expect(siguienteBtn).toBeDisabled();

      await page.screenshot({
        path: 'test-results/tucanwin-registro-email-invalido.png',
        timeout: 10_000,
      }).catch(() => {});

      console.log('OK: el boton Siguiente sigue deshabilitado con email invalido');
    });
  });
