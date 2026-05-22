/**
 * Ticket-to-tests agent (orchestrator).
 *
 * Uso:
 *   npm run ticket-to-tests -- GPX-5802
 *
 * Que hace:
 *   1. Fetcha el ticket de Notion (Tablero de Desarrollo) buscando por
 *      userDefined:ID = <numero>. Necesita NOTION_TOKEN en .env.
 *   2. Crea (o reutiliza) la branch git con el nombre del ticket.
 *   3. Invoca un orchestrator (Opus 4.7) con acceso al MCP playwright-test +
 *      Read/Edit/Write/Bash. El agente:
 *        a. Explora la feature/URL via browser_*.
 *        b. Diseña el plan via planner_setup_page + planner_save_plan.
 *        c. Escribe los specs via generator_setup_page + generator_write_test.
 *        d. Corre los specs.
 *        e. Si fallan, aplica heal loop (hasta MAX_HEAL_ATTEMPTS).
 *   4. Comitea los cambios a la branch (no push, no PR, no Notion update).
 *
 * Guardrails:
 *   - maxTurns / maxBudgetUsd
 *   - Loop de heal con cap explícito
 *   - El agente NO mergea ni pushea (el script tampoco)
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as path from "path";
import * as dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ====== Config ======

const PROJECT_DIR = path.resolve(__dirname, "..");
const MODEL = process.env.TICKET_AGENT_MODEL || "claude-opus-4-7";
const MAX_TURNS = parseInt(process.env.TICKET_AGENT_MAX_TURNS || "200", 10);
const MAX_BUDGET_USD = parseFloat(process.env.TICKET_AGENT_MAX_BUDGET || "10.0");
const MAX_HEAL_ATTEMPTS = parseInt(
  process.env.TICKET_AGENT_MAX_HEAL_ATTEMPTS || "3",
  10,
);
const NOTION_TOKEN = process.env.NOTION_TOKEN || "";
const NOTION_DEV_BOARD_DS_ID =
  process.env.NOTION_DEV_BOARD_DS_ID ||
  "21dfa94a-277f-482f-a901-1664f372132f";
const NOTION_VERSION = "2022-06-28";

// ====== Notion ======

interface NotionTicket {
  id: string; // page UUID
  url: string;
  ticketCode: string; // "GPX-5802"
  title: string;
  state: string | null;
  body: string; // text content of the page (best-effort, markdown-ish)
}

async function notionFetch(p: string, init?: RequestInit): Promise<any> {
  const resp = await fetch(`https://api.notion.com/v1${p}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Notion API ${resp.status} on ${p}: ${txt}`);
  }
  return resp.json();
}

async function fetchTicket(ticketId: string): Promise<NotionTicket> {
  const match = ticketId.match(/^GPX-(\d+)$/i);
  if (!match) {
    throw new Error(`Ticket ID inválido. Esperaba "GPX-<numero>", recibí: ${ticketId}`);
  }
  const numeric = parseInt(match[1], 10);

  if (!NOTION_TOKEN) {
    throw new Error(
      "Falta NOTION_TOKEN en .env (integration token de Notion con acceso al Tablero de Desarrollo).",
    );
  }

  // 1. Find the page by userDefined:ID property. The auto-incrementing ID
  //    property is usually exposed as "ID" via the API (its name in the schema).
  const queryRes = await notionFetch(
    `/databases/${NOTION_DEV_BOARD_DS_ID}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "ID", number: { equals: numeric } },
        page_size: 1,
      }),
    },
  );

  const page = queryRes.results?.[0];
  if (!page) {
    throw new Error(`No encontré ticket con ID=${numeric} en la base de Notion.`);
  }

  // 2. Title — find the title property (always exactly one).
  const props: Record<string, any> = page.properties;
  const titleProp = Object.values(props).find((p: any) => p.type === "title") as any;
  const title: string =
    titleProp?.title?.map((t: any) => t.plain_text).join("") ?? "(sin título)";

  // 3. Status / Estado, best-effort.
  const stateProp = (props["Estado"] || props["Status"]) as any;
  const state: string | null =
    stateProp?.status?.name ??
    stateProp?.select?.name ??
    (Array.isArray(stateProp?.multi_select) && stateProp.multi_select[0]?.name) ??
    null;

  // 4. Body — fetch the page block children and flatten to text.
  const body = await fetchPageBodyAsText(page.id);

  return {
    id: page.id,
    url: page.url,
    ticketCode: `GPX-${numeric}`,
    title,
    state,
    body,
  };
}

async function fetchPageBodyAsText(pageId: string): Promise<string> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await notionFetch(
      `/blocks/${pageId}/children${cursor ? `?start_cursor=${cursor}` : ""}`,
    );
    for (const block of res.results || []) {
      out.push(blockToText(block));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out.filter((s) => s.length > 0).join("\n");
}

function richTextToString(rt: any[] | undefined): string {
  if (!rt || rt.length === 0) return "";
  return rt.map((r: any) => r.plain_text ?? "").join("");
}

function blockToText(block: any): string {
  const t = block.type;
  const data = block[t] || {};
  switch (t) {
    case "paragraph":
      return richTextToString(data.rich_text);
    case "heading_1":
      return `# ${richTextToString(data.rich_text)}`;
    case "heading_2":
      return `## ${richTextToString(data.rich_text)}`;
    case "heading_3":
      return `### ${richTextToString(data.rich_text)}`;
    case "bulleted_list_item":
    case "numbered_list_item":
      return `- ${richTextToString(data.rich_text)}`;
    case "to_do":
      return `- [${data.checked ? "x" : " "}] ${richTextToString(data.rich_text)}`;
    case "quote":
      return `> ${richTextToString(data.rich_text)}`;
    case "code":
      return `\`\`\`${data.language || ""}\n${richTextToString(data.rich_text)}\n\`\`\``;
    case "callout":
      return `> ${richTextToString(data.rich_text)}`;
    default:
      return richTextToString(data.rich_text);
  }
}

// ====== Git helpers ======

function sh(cmd: string, opts: { cwd?: string; allowFail?: boolean } = {}): string {
  try {
    return execSync(cmd, {
      cwd: opts.cwd ?? PROJECT_DIR,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err: any) {
    if (opts.allowFail) return "";
    throw new Error(`Comando falló: ${cmd}\n${err?.stderr ?? err?.message}`);
  }
}

function ensureBranch(branchName: string): { isNew: boolean } {
  const current = sh("git branch --show-current");
  if (current === branchName) return { isNew: false };

  const status = sh("git status --porcelain");
  if (status.length > 0) {
    throw new Error(
      `Hay cambios sin commitear en la branch actual (${current}). Stash o commit antes de continuar:\n${status}`,
    );
  }

  // ¿Existe la branch?
  const existing = sh(`git branch --list ${branchName}`);
  if (existing.length > 0) {
    sh(`git checkout ${branchName}`);
    return { isNew: false };
  }

  // Crear desde main
  sh("git fetch origin main", { allowFail: true });
  sh(`git checkout -b ${branchName} origin/main`, { allowFail: true });
  // Fallback si no existe origin/main local
  const after = sh("git branch --show-current");
  if (after !== branchName) {
    sh(`git checkout -b ${branchName}`);
  }
  return { isNew: true };
}

// ====== Orchestrator prompt ======

function buildOrchestratorPrompt(ticket: NotionTicket): string {
  return `Sos un agente orquestador que automatiza el ciclo completo de QA Automation para un ticket de Notion.

# Ticket
- Codigo: ${ticket.ticketCode}
- Titulo: ${ticket.title}
- Estado: ${ticket.state ?? "(sin estado)"}
- URL: ${ticket.url}

## Contenido del ticket
${ticket.body || "(sin descripcion en el ticket — usa el titulo y tu juicio)"}

# Contexto del repo
- Proyecto Playwright E2E en \`${PROJECT_DIR}\`
- Tests organizados por licenciatario en \`tests/<licensee>/...\`
- Para tucanwin: \`tests/tucanwin/smoke/<feature>.spec.ts\`
- El seed compartido es \`tests/tucanwin/seed.spec.ts\` (abre el home, sin login)
- Plan maestro: \`tests/tucanwin/smoke.plan.md\` (consulta-lo para entender el scope)
- Config de Playwright en \`playwright.config.ts\` (geolocation, viewport, timeouts)
- Env de testing: \`https://gfront-tucanwin-testing.gampix.dev\` (usado por default)
- Env de prod: \`https://tucanwin.bet.ar\` (override via BASE_URL si es necesario)

# Tu workflow

1. **Entender el alcance**:
   - Lee el plan maestro (\`tests/tucanwin/smoke.plan.md\`) si el ticket apunta a una suite documentada ahi.
   - Si no, deduci el scope desde el titulo y el contenido del ticket.

2. **Explorar la feature (si hace falta)**:
   - Usa las tools del MCP \`playwright-test\`: \`planner_setup_page\` (con el seed apropiado), \`browser_navigate\`, \`browser_snapshot\`, etc.
   - Recolecta selectores reales, no inventes IDs/clases.

3. **Disenar el plan** (si no esta documentado todavia):
   - Usa \`planner_save_plan\` para escribir el plan en \`tests/<licensee>/<feature>.plan.md\`.
   - Si el plan ya existe en \`smoke.plan.md\`, saltea este paso.

4. **Generar los specs**:
   - Por cada test del plan, usa \`generator_setup_page\` + acciones de browser para grabar, despues \`generator_read_log\` y \`generator_write_test\` para volcar el codigo.
   - Alternativa: escribi el spec directamente con \`Write\`/\`Edit\` si conoces bien la estructura.
   - Ubicacion: \`tests/<licensee>/smoke/<feature>.spec.ts\` (o donde corresponda segun el plan).
   - Estilo: \`test.beforeEach\` para abrir home, \`test.step\` para bloques, locators por role/text/testid (NO css fragiles).

5. **Correr los specs y healear**:
   - Corre: \`npx playwright test <archivo> --reporter=list\` via \`Bash\`.
   - Si pasan todos: termina.
   - Si fallan: identifica causa raiz (selector roto, timing, assertion mal armada, env mismatch UAT vs PROD) y aplica fix MINIMO via \`Edit\`. Re-corre.
   - Cap: maximo ${MAX_HEAL_ATTEMPTS} ciclos de heal. Si despues de ese cap sigue fallando, dejalo como \`test.fixme\` con comentario explicando el sintoma observado.

# Reglas estrictas

- **NO push** y **NO crear PRs**. El script invocador hace el commit al final.
- **NO modificar** archivos fuera de \`tests/\` salvo \`playwright.config.ts\` si es estrictamente necesario (explicalo si lo haces).
- **NO debilitar assertions** para forzar pass (no \`toBeTruthy\` en lugar de \`toBe\`, no try/catch que trague errores).
- **NO eliminar tests** ni marcar \`test.skip\` salvo el fallback de \`test.fixme\` permitido despues del cap de heal.
- **Sin emojis** en el codigo / specs / comentarios. (Estilo del repo).
- **Comentarios solo cuando el "por que" no sea obvio**.
- Si el ticket no tiene suficiente info para escribir tests, mejor decir "no puedo hacerlo solo con esta info" en el reporte final que inventar tests genericos.

# Reporte final

Al terminar imprimi un resumen claro con:
- Archivos creados / modificados (paths absolutos).
- Tests escritos (nombres) y su resultado en la ultima corrida (PASS / FAIL / FIXME).
- Si quedaron tests fallando o como \`fixme\`, lista los motivos en una o dos lineas cada uno.
- Cualquier asuncion que hayas hecho que el reviewer humano deberia validar.

Empeza ahora.`;
}

// ====== Orchestrator invocation ======

async function invokeOrchestrator(ticket: NotionTicket): Promise<{ cost: number; turns: number }> {
  const prompt = buildOrchestratorPrompt(ticket);
  let totalCost = 0;
  let turns = 0;

  for await (const message of query({
    prompt,
    options: {
      model: MODEL,
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET_USD,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      cwd: PROJECT_DIR,
      mcpServers: {
        "playwright-test": {
          command: "npx",
          args: ["playwright", "run-test-mcp-server"],
        },
      },
    },
  })) {
    const t = (message as any).type;
    if (t === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
      process.stdout.write("\n");
      turns++;
    }
    if ("result" in message) {
      totalCost = (message as any).total_cost_usd ?? 0;
      const resultText = (message as any).result;
      if (typeof resultText === "string") {
        console.log("\n=== Resultado final del agente ===\n" + resultText);
      }
    }
  }
  return { cost: totalCost, turns };
}

// ====== Final commit ======

function commitChanges(ticket: NotionTicket): { committed: boolean; sha: string | null } {
  const status = sh("git status --porcelain");
  if (status.length === 0) {
    return { committed: false, sha: null };
  }

  // Solo stagear archivos bajo tests/ (regla estricta del agente).
  // Si hubo modificaciones afuera, las dejamos sin commitear para revision humana.
  sh("git add tests/");

  const staged = sh("git diff --cached --name-only");
  if (staged.length === 0) {
    console.warn(
      "El agente modificó archivos fuera de tests/ y no se commitea automáticamente:",
    );
    console.warn(status);
    return { committed: false, sha: null };
  }

  const subject = `test(${ticket.ticketCode.toLowerCase()}): ${ticket.title} (agent draft)`;
  sh(`git commit -m "${subject.replace(/"/g, '\\"')}"`);
  const sha = sh("git rev-parse --short HEAD");
  return { committed: true, sha };
}

// ====== Main ======

async function main() {
  const ticketId = process.argv[2];
  if (!ticketId) {
    console.error("Uso: npm run ticket-to-tests -- <GPX-XXXX>");
    process.exit(2);
  }

  console.log(`[ticket-to-tests] Modelo: ${MODEL} | maxTurns: ${MAX_TURNS} | budget: $${MAX_BUDGET_USD} | maxHealAttempts: ${MAX_HEAL_ATTEMPTS}`);
  console.log(`[ticket-to-tests] Fetcheando ticket ${ticketId} desde Notion...`);

  const ticket = await fetchTicket(ticketId);
  console.log(`[ticket-to-tests] OK: ${ticket.ticketCode} — "${ticket.title}" (${ticket.state ?? "sin estado"})`);
  console.log(`[ticket-to-tests] URL: ${ticket.url}`);

  const { isNew } = ensureBranch(ticket.ticketCode);
  console.log(`[ticket-to-tests] Branch ${ticket.ticketCode} ${isNew ? "(creada)" : "(reusada)"}`);

  const start = Date.now();
  const { cost, turns } = await invokeOrchestrator(ticket);
  const durationMin = ((Date.now() - start) / 60_000).toFixed(1);

  console.log(`\n[ticket-to-tests] Agente terminó: turns=${turns} cost=$${cost.toFixed(2)} duración=${durationMin}min`);

  const { committed, sha } = commitChanges(ticket);
  if (committed) {
    console.log(`[ticket-to-tests] Commit creado: ${sha} en branch ${ticket.ticketCode}`);
  } else {
    console.log(`[ticket-to-tests] Sin cambios para commitear (o el agente sólo tocó archivos fuera de tests/).`);
  }

  console.log(`\n[ticket-to-tests] Done. Revisá la branch ${ticket.ticketCode} antes de pushear.`);
}

main().catch((err) => {
  console.error("[ticket-to-tests] Fatal:", err?.message || err);
  process.exit(1);
});
