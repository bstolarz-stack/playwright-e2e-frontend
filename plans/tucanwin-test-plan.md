# TucanWin - Plan de Tests E2E + Modulo API

**Sitio:** https://gfront-tucanwin-testing.gampix.dev/
**Backend:** https://gapi-tucanwin-testing.gampix.dev/api
**Fecha:** 2026-04-13
**Stack:** Playwright + TypeScript
**Carpeta:** `tests/tucanwin/`

---

## Alcance (rev. 2026-04-13)

> El alcance previo (abrir 1 juego por seccion + ciclo de spin en RubyPlay) **queda descartado**.
> Nuevo alcance acordado:

1. **E2E Login**: un unico spec que verifique que el login del env de testing funciona.
2. **Modulo API**: helper TypeScript que llama al backend de TucanWin y devuelve los **juegos habilitados**. Sin Playwright, usa `fetch` nativo. Pensado para ser reusado por specs futuros, scripts, healer, etc.

---

## 1. E2E Login (existente, sin cambios)

### `tests/tucanwin/utils/auth.ts`
Ya existe. Hace:
- `goto(TUCANWIN_BASE_URL)`
- Cierra countdown si esta visible
- Click `Ingresá` → wait 500ms → click `Ingresar` (modal auto-rellena las credenciales)
- Verifica balance visible en header

### `tests/tucanwin/seed.spec.ts`
Ya existe. Hace `loginTucanwin(page)` y deja la pagina abierta.
Renombrar a `login.spec.ts` para reflejar la intencion (es el unico spec real).

---

## 2. Modulo API - juegos habilitados

### Endpoint real (verificado por inspeccion de network)

**Backend base URL** (env de testing):
```
https://gapi-tucanwin-testing.gampix.dev/api
```

**Endpoints relevantes**:

| Metodo | Path | Uso |
|--------|------|-----|
| `GET` | `/cms/page-sections/home?tenantSlug=tucanwin` | Devuelve secciones del home, incluyendo las de tipo `gameCategory` con su `categoryId` y `categoryName`. |
| `GET` | `/categories/{categoryId}/games?playerId=-1&isMobile=false&page=1&pageSize=100` | Devuelve los juegos habilitados para esa categoria. **No requiere auth** (`playerId=-1` funciona anonimo). |
| `GET` | `/cms/banners/home?isAuthenticated=false` | Banners (no usado por el modulo). |
| `GET` | `/Navigation/cms?tenant=tucanwin&active=true&limit=20&page=1` | Nav (no usado). |

**Tenant**: `tucanwin` (querystring `tenantSlug=tucanwin`).

### Shape del response `/categories/{id}/games`

```json
{
  "items": [
    {
      "id": 156,
      "name": "5 Lions Megaways",
      "description": null,
      "imageUrl": "/assets/img/_desk/pragmatic/5 Lions Megaways.jpg",
      "gameTypeId": 0,
      "gameTypeName": null,
      "gameSubtypeId": 1,
      "gameSubtypeName": null,
      "providerId": 77,
      "providerName": "Pragmatic",
      "isFavorite": false,
      "isRecent": false,
      "rtp": null,
      "minBet": null,
      "maxBet": null,
      "gameCode": "vswayslions",
      "isHtml5": true,
      "brandId": 2,
      "brandName": "PragmaticPlay",
      "categoryTag": null
    }
  ],
  "totalCount": 29,
  "currentPage": 1,
  "pageSize": 100,
  "pageCount": 1
}
```

### Shape del response `/cms/page-sections/home`

Array de secciones. Solo nos interesan las de `sectionType === "gameCategory"`:

```json
{
  "id": "689e367ea785a474eb8458bb",
  "title": "Los más jugados",
  "order": 0,
  "sectionType": "gameCategory",
  "status": "published",
  "gameCategoryContent": {
    "categoryId": 4,
    "categoryName": "Los Más Jugados",
    "maxGamesToShow": 20
  }
}
```

Otros `sectionType` posibles: `news`, etc. Se filtran fuera.

### Categorias observadas en el home
- `4` - Los más jugados
- `55` - Juegos destacados
- `2` - Últimos lanzamientos

### Diseño del modulo `tests/tucanwin/utils/api.ts`

```typescript
export const TUCANWIN_API_BASE = 'https://gapi-tucanwin-testing.gampix.dev/api';
export const TUCANWIN_TENANT = 'tucanwin';

export interface EnabledGame {
  id: number;
  name: string;
  gameCode: string;
  providerId: number;
  providerName: string;
  brandId: number;
  brandName: string;
  isHtml5: boolean;
  imageUrl: string | null;
}

export interface HomeSection {
  id: string;
  title: string;
  order: number;
  categoryId: number;
  categoryName: string;
  maxGamesToShow: number;
}

// Lista las secciones de tipo gameCategory del home (ordenadas por `order`).
export async function getHomeGameSections(): Promise<HomeSection[]>;

// Trae los juegos habilitados para una categoria.
// pageSize default 100. Hace paginacion automatica si `pageCount > 1`.
export async function getGamesByCategory(
  categoryId: number,
  opts?: { pageSize?: number; isMobile?: boolean; playerId?: number },
): Promise<EnabledGame[]>;

// Atajo: trae todas las secciones del home y los juegos de cada una,
// devolviendo un mapa `categoryId -> EnabledGame[]`.
export async function getEnabledGamesByHomeSection(): Promise<
  Record<number, { section: HomeSection; games: EnabledGame[] }>
>;
```

**Decisiones**:
- Usa `fetch` nativo de Node 18+. Sin dependencia extra.
- No requiere JWT/auth para los endpoints anonimos (`playerId=-1`).
- Tipos minimos: solo los campos que tienen valor practico para tests/scripts.
- Errores: tira `Error` con status code y body si la respuesta no es 200 (no swallowing).
- Sin retry: keep simple. Si falla la red, falla el test.

### Spec de prueba `tests/tucanwin/api.spec.ts` (opcional, util como smoke)

```typescript
import { test, expect } from '@playwright/test';
import { getHomeGameSections, getGamesByCategory } from './utils/api';

test('API tucanwin - home tiene >= 1 seccion gameCategory', async () => {
  const sections = await getHomeGameSections();
  expect(sections.length).toBeGreaterThan(0);
});

test('API tucanwin - cada seccion tiene >= 1 juego habilitado', async () => {
  const sections = await getHomeGameSections();
  for (const s of sections) {
    const games = await getGamesByCategory(s.categoryId, { pageSize: 5 });
    expect(games.length, `categoria ${s.categoryId} (${s.categoryName})`).toBeGreaterThan(0);
  }
});
```

> Este spec **no usa el navegador** (no hay `page` fixture) — corre contra la API directo.

---

## 3. Estructura final de `tests/tucanwin/`

```
tests/tucanwin/
├── utils/
│   ├── auth.ts          # YA EXISTE - login con auto-fill
│   └── api.ts           # NUEVO - getHomeGameSections, getGamesByCategory, getEnabledGamesByHomeSection
├── login.spec.ts        # RENOMBRAR seed.spec.ts -> login.spec.ts
└── api.spec.ts          # NUEVO - smoke contra la API
```

Se eliminan del scope previo:
- `home-secciones.spec.ts`
- `home-abrir-juegos.spec.ts`
- `ciclo-juego.spec.ts`
- `utils/modals.ts`
- `utils/game.ts`

---

## 4. Notas

1. La API del env de testing **no requiere autenticacion** para listar juegos por categoria. Si en el futuro se quieren juegos personalizados (favoritos, recientes), habra que agregar JWT — el frontend usa `NEXT_PUBLIC_API_URL` + JWT con `Issuer=GGP.Casino.API` segun la doc de Notion (Glosario de Configuracion GGP Casino).
2. La `categoryId` de cada seccion del home **no esta hardcodeada**: viene de `/cms/page-sections/home`. El modulo lo descubre dinamicamente via `getHomeGameSections()`.
3. Las URLs son del env de testing. Para apuntar a otro env (staging/prod) hay que cambiar `TUCANWIN_API_BASE` y `TUCANWIN_TENANT`.
4. El modulo es agnostico de Playwright — se puede usar desde cualquier script Node.
