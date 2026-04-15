# Frontend Tests - Casino Game E2E Testing

## Project Overview
Playwright E2E tests for casino games on `pba.sports.bet.ar` (Provincia de Buenos Aires sports betting portal).

## Key Rules

### Game Intro Screen Detection
- **If the balance shows null/N/A after loading a game, you have NOT entered the game.**
- Many games (especially Pragmatic Play) show an intro/feature screen before the actual game.
- You MUST click the intro play button to enter the real game before attempting spins.
- Only after entering the game will the balance display a real value.

### Geolocation
- The site requires Provincia de Buenos Aires (PBA) coordinates, NOT Ciudad de Buenos Aires (CABA).
- Current config uses La Plata (-34.9205, -57.9536).
- Using CABA coords will redirect to `/errorpage/invalidlocation`.

### Environment Variables
- Use `APP_USERNAME` instead of `USERNAME` — Windows reserves `USERNAME` as a system env var.
- `dotenv` does NOT overwrite existing env vars, so `process.env.USERNAME` returns the Windows user.

### Canvas-Based Games
- Casino games render entirely in `<canvas>` — no DOM buttons to click.
- Pragmatic Play games use PointerEvent listeners on the canvas.
- Must dispatch synthetic `pointerdown`/`pointerup` events directly via JavaScript `evaluate()` on the game frame.
- Playwright's `locator.click()` may not properly trigger canvas game engines.

### Game Frame Structure
- Main page → `#iframe-games` → game provider iframe → canvas
- Games load in nested iframes; must traverse frame tree to find the game canvas.
- Pragmatic Play games: URL contains `pragmaticplay`, `ppgames`, `casinomodule`, or `gs.pragmatic`.
- Caleta Gaming games (China Charm): URL contains `caletaholdings` or `chinacharms`.

## File Structure
- `tests/*.spec.ts` — Test specs (one per game)
- `tests/utils/navigation.ts` — City selection and navigation
- `tests/utils/auth.ts` — Login, geolocation modal, login verification
- `tests/utils/game.ts` — Game search, frame detection, intro dismissal, spin execution
- `playwright.config.ts` — Config with PBA geolocation, video recording, 180s timeout
