import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';

const CREDENTIALS = { username: '33284255', password: 'Listento*32' };
let screenshotCount = 0;

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page: Page, name: string) {
  screenshotCount++;
  const f = `screenshots/${String(screenshotCount).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: f, fullPage: false });
  console.log(`📸 ${f}`);
}

async function main() {
  console.log('🚀 China Charm Automation');
  if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots', { recursive: true });

  const browser: Browser = await chromium.launch({
    headless: false, // false para ver el navegador en tu máquina
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'es-AR',
    geolocation: { latitude: -34.6037, longitude: -58.3816 },
    permissions: ['geolocation'],
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    // ====== FLUJO ORIGINAL: sportsbet.com.ar → Ciudad → Login ======
    console.log('━━━ PASO 1: Seleccionar ciudad ━━━');
    await page.goto('https://sportsbet.com.ar', { waitUntil: 'networkidle', timeout: 60000 });
    await delay(3000);

    // Seleccionar "Prov. Bs.As" en el popup
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"], .btn');
      for (const btn of btns) {
        if (btn.textContent?.includes('Bs.As')) {
          (btn as HTMLElement).click();
          return;
        }
      }
    });
    await delay(3000);
    await shot(page, 'city-selected');
    console.log('URL after city:', page.url());

    // Navegar al portal si no redirigió
    if (!page.url().includes('pba.sports.bet.ar')) {
      await page.goto('https://pba.sports.bet.ar/casino/index', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(3000);
    }

    // ====== LOGIN ======
    console.log('━━━ PASO 2: Login ━━━');

    // Click INGRESAR
    await page.evaluate(() => {
      const els = document.querySelectorAll('a, button');
      for (const el of els) {
        if (el.textContent?.trim() === 'Ingresar' || el.textContent?.trim() === 'INGRESAR') {
          (el as HTMLElement).click();
          return;
        }
      }
    });
    await delay(3000);

    // Llenar credenciales
    await page.fill('#LoginUserName', CREDENTIALS.username);
    await page.fill('#LoginPassword', CREDENTIALS.password);
    await shot(page, 'credentials');

    // Submit y monitorear respuesta
    await Promise.all([
      page.waitForResponse(r => r.url().includes('login'), { timeout: 15000 }).catch(() => null),
      page.click('form[action*="login"] button[type="submit"]'),
    ]);
    await delay(3000);
    await shot(page, 'after-submit');

    // Manejar modal de geolocalización si aparece
    const geoResult = await page.evaluate(() => {
      const modal = document.getElementById('modalValidateGeopositionLogin');
      if (!modal || !modal.classList.contains('show')) return 'no geo modal';

      // Intentar CONTINUAR primero (tenemos geo mock de Buenos Aires)
      const buttons = modal.querySelectorAll('button, a');
      for (const btn of buttons) {
        if (btn.textContent?.trim().toUpperCase() === 'CONTINUAR') {
          (btn as HTMLElement).click();
          return 'clicked CONTINUAR';
        }
      }
      for (const btn of buttons) {
        if (btn.textContent?.trim().toUpperCase() === 'OMITIR') {
          (btn as HTMLElement).click();
          return 'clicked OMITIR';
        }
      }
      return 'modal found but no button clicked';
    });
    console.log('Geo modal result:', geoResult);

    if (geoResult.includes('CONTINUAR')) {
      // Esperar que la validación de geolocalización se complete
      await delay(5000);
      await shot(page, 'after-geo-continuar');
    }

    // Esperar y verificar
    await delay(3000);

    // Verificar login
    let loggedIn = await page.evaluate(() => {
      const header = document.querySelector('header')?.innerText || '';
      return !header.includes('INGRESAR');
    });
    console.log('Logged in:', loggedIn);
    await shot(page, 'login-check');

    if (!loggedIn) {
      // Intentar cerrar modales y recargar
      await page.evaluate(() => {
        document.querySelectorAll('.modal.show').forEach(m => {
          m.classList.remove('show');
          (m as HTMLElement).style.display = 'none';
        });
        document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        document.body.classList.remove('modal-open');
      });
      await delay(1000);

      // Reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await delay(3000);

      loggedIn = await page.evaluate(() => {
        const header = document.querySelector('header')?.innerText || '';
        return !header.includes('INGRESAR');
      });
      console.log('Logged in after reload:', loggedIn);
      await shot(page, 'after-reload');
    }

    // ====== BUSCAR Y ABRIR CHINA CHARM ======
    console.log('━━━ PASO 3: Buscar China Charm ━━━');

    // Abrir búsqueda
    await page.evaluate(() => {
      const btn = document.querySelector('button.header__icon--search') as HTMLElement;
      if (btn) btn.click();
    });
    await delay(1000);

    // Forzar apertura del modal de búsqueda
    await page.evaluate(() => {
      const modal = document.getElementById('search-modal-games');
      if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
      }
    });
    await delay(500);

    // Buscar "China"
    await page.evaluate(() => {
      const input = document.getElementById('games-search') as HTMLInputElement;
      if (input) {
        input.value = 'China';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('keyup', { bubbles: true }));
      }
    });
    await delay(3000);
    await shot(page, 'search-results');

    // Click en el resultado China Charms (LI con onclick)
    const navP = page.waitForNavigation({ timeout: 15000 }).catch(() => null);
    const clickResult = await page.evaluate(() => {
      const modal = document.getElementById('search-modal-games');
      if (!modal) return 'no modal';

      // Buscar LI con onclick que contenga China Charms
      const item = modal.querySelector('li.games-block-recommended__item') as HTMLElement;
      if (item && item.textContent?.includes('China')) {
        item.click();
        return `Clicked: ${item.textContent?.trim().substring(0, 40)}`;
      }
      return 'item not found';
    });
    console.log('Click result:', clickResult);
    await navP;
    await delay(5000);

    console.log('URL:', page.url());
    await shot(page, 'after-click');

    // Si no estamos en gameplay, el login falló. Intentar obtener la URL del juego
    // y navegar directamente
    if (!page.url().includes('gameplay')) {
      console.log('⚠️ No en gameplay. Intentando interceptar la URL del juego...');

      // Buscar la URL del juego viendo el onclick handler del LI
      const gameOnClick = await page.evaluate(() => {
        // Volver a la página del casino
        return null; // No podemos obtener el onclick si navegamos
      });

      // Navegar de vuelta al casino
      await page.goto('https://pba.sports.bet.ar/casino/index', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(3000);

      // Hacer la búsqueda de nuevo
      await page.evaluate(() => {
        const btn = document.querySelector('button.header__icon--search') as HTMLElement;
        if (btn) btn.click();
      });
      await delay(1000);
      await page.evaluate(() => {
        const modal = document.getElementById('search-modal-games');
        if (modal) { modal.style.display = 'block'; modal.classList.add('show'); }
        const input = document.getElementById('games-search') as HTMLInputElement;
        if (input) {
          input.value = 'China';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('keyup', { bubbles: true }));
        }
      });
      await delay(3000);

      // Obtener el onclick del LI para saber qué función llama
      const onclickInfo = await page.evaluate(() => {
        const modal = document.getElementById('search-modal-games');
        if (!modal) return null;
        const item = modal.querySelector('li.games-block-recommended__item') as HTMLElement;
        if (!item) return null;
        return {
          onclick: item.getAttribute('onclick'),
          outerHTML: item.outerHTML.substring(0, 500),
          dataAttrs: Array.from(item.attributes).map(a => `${a.name}=${a.value}`),
        };
      });
      console.log('Game item onclick:', JSON.stringify(onclickInfo, null, 2));
    }

    // ====== SI ESTAMOS EN GAMEPLAY ======
    if (page.url().includes('gameplay')) {
      console.log('━━━ GAMEPLAY ━━━');

      // Esperar frame del juego
      let gameFrame = null;
      for (let i = 0; i < 50; i++) {
        gameFrame = page.frames().find(f =>
          f.url().includes('caletaholdings') || f.url().includes('chinacharms')
        );
        if (gameFrame) { console.log(`✅ Game frame (${i}s)`); break; }
        await delay(1000);
        if (i % 10 === 0) console.log(`  Waiting... (${i}s)`);
      }

      if (gameFrame) {
        for (let i = 0; i < 20; i++) {
          try {
            const ok = await gameFrame.evaluate(() => {
              const c = document.querySelector('canvas');
              return c && c.width > 100;
            });
            if (ok) { console.log('✅ Canvas ready'); break; }
          } catch { /* skip */ }
          await delay(1000);
        }
        await delay(5000);
        await shot(page, 'game-ready');

        // ====== SPIN ======
        console.log('━━━ SPIN ━━━');

        const mainBox = await page.evaluate(() => {
          const iframe = document.getElementById('iframe-games') as HTMLIFrameElement;
          if (!iframe) return null;
          const r = iframe.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });

        const gpFrame = page.frames().find(f => f.url().includes('gameplay') || f.url().includes('fh8labs'));
        let innerBox = null;
        if (gpFrame) {
          innerBox = await gpFrame.evaluate(() => {
            for (const iframe of document.querySelectorAll('iframe')) {
              const r = iframe.getBoundingClientRect();
              if (r.width > 100) return { x: r.x, y: r.y, w: r.width, h: r.height };
            }
            return null;
          }).catch(() => null);
        }

        let gX = mainBox?.x || 0, gY = mainBox?.y || 0;
        let gW = mainBox?.w || 1920, gH = mainBox?.h || 1080;
        if (innerBox) { gX += innerBox.x; gY += innerBox.y; gW = innerBox.w; gH = innerBox.h; }

        const spinX = Math.round(gX + gW / 2);
        const spinY = Math.round(gY + gH * 0.86);
        console.log(`🎯 SPIN: (${spinX}, ${spinY})`);

        for (let i = 1; i <= 5; i++) {
          console.log(`🎰 Spin #${i}...`);
          await page.mouse.click(spinX, spinY);
          await delay(1500);
          await shot(page, `spin-${i}-click`);
          await delay(4500);
          await shot(page, `spin-${i}-done`);
        }
      }
    }

    await shot(page, 'final');
    console.log('✅ Done');

  } catch (error) {
    console.error('❌ Error:', error);
    await shot(page, 'error');
  } finally {
    await browser.close();
    console.log('🏁 Closed.');
  }
}

main().catch(console.error);