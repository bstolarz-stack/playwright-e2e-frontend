/**
 * Modulo de llamado al backend de TucanWin (env de testing).
 *
 * Endpoints verificados por inspeccion de network el 2026-04-13:
 *  - GET /cms/page-sections/home?tenantSlug=tucanwin     -> secciones del home
 *  - GET /categories/{id}/games?playerId=-1&...          -> juegos por categoria
 *
 * Estos endpoints NO requieren autenticacion (`playerId=-1` funciona anonimo).
 * Si se necesitaran datos personalizados (favoritos, recientes) habra que
 * agregar JWT segun el Glosario de Configuracion GGP Casino (Notion).
 *
 * Es agnostico de Playwright — usa fetch nativo (Node 18+).
 */

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

interface RawGameItem {
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

interface RawGamesResponse {
  items: RawGameItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  pageCount: number;
}

interface RawSection {
  id: string;
  title: string;
  order: number;
  sectionType: string;
  status: string;
  gameCategoryContent?: {
    categoryId: number;
    categoryName: string;
    maxGamesToShow: number;
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `TucanWin API ${res.status} ${res.statusText} on ${url}\n${body.slice(0, 500)}`,
    );
  }
  return (await res.json()) as T;
}

/**
 * Lista las secciones del home que son de tipo `gameCategory` y estan
 * publicadas. Ordenadas por `order` ascendente.
 */
export async function getHomeGameSections(): Promise<HomeSection[]> {
  const url = `${TUCANWIN_API_BASE}/cms/page-sections/home?tenantSlug=${TUCANWIN_TENANT}`;
  const raw = await fetchJson<RawSection[]>(url);
  return raw
    .filter(
      (s) =>
        s.sectionType === 'gameCategory' &&
        s.status === 'published' &&
        s.gameCategoryContent != null,
    )
    .map((s) => ({
      id: s.id,
      title: s.title,
      order: s.order,
      categoryId: s.gameCategoryContent!.categoryId,
      categoryName: s.gameCategoryContent!.categoryName,
      maxGamesToShow: s.gameCategoryContent!.maxGamesToShow,
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Trae los juegos habilitados para una categoria. Hace paginacion automatica
 * si el endpoint reporta `pageCount > 1`.
 */
export async function getGamesByCategory(
  categoryId: number,
  opts: { pageSize?: number; isMobile?: boolean; playerId?: number } = {},
): Promise<EnabledGame[]> {
  const pageSize = opts.pageSize ?? 100;
  const isMobile = opts.isMobile ?? false;
  const playerId = opts.playerId ?? -1;

  const buildUrl = (page: number) =>
    `${TUCANWIN_API_BASE}/categories/${categoryId}/games` +
    `?playerId=${playerId}&isMobile=${isMobile}&page=${page}&pageSize=${pageSize}`;

  const first = await fetchJson<RawGamesResponse>(buildUrl(1));
  const all = [...first.items];

  for (let p = 2; p <= first.pageCount; p++) {
    const next = await fetchJson<RawGamesResponse>(buildUrl(p));
    all.push(...next.items);
  }

  return all.map(
    (g): EnabledGame => ({
      id: g.id,
      name: g.name,
      gameCode: g.gameCode,
      providerId: g.providerId,
      providerName: g.providerName,
      brandId: g.brandId,
      brandName: g.brandName,
      isHtml5: g.isHtml5,
      imageUrl: g.imageUrl,
    }),
  );
}

/**
 * Atajo: trae todas las secciones `gameCategory` del home y los juegos de
 * cada una, devolviendo un mapa keyed por `categoryId`.
 */
export async function getEnabledGamesByHomeSection(): Promise<
  Record<number, { section: HomeSection; games: EnabledGame[] }>
> {
  const sections = await getHomeGameSections();
  const entries = await Promise.all(
    sections.map(async (section) => {
      const games = await getGamesByCategory(section.categoryId);
      return [section.categoryId, { section, games }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
