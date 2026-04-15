import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ====== Types ======

interface HealedTest {
  testFile: string;
  testName: string;
  originalError: string;
  fix: string;
  filesModified: string[];
  status: "HEALED" | "UNHEALED";
}

interface HealerReport {
  date: string;
  status: "ALL_PASS" | "HEALED" | "PARTIAL" | "UNHEALED" | "ERROR";
  totalTests: number;
  passed: number;
  failed: number;
  healed: number;
  unhealed: number;
  healAttempts: number;
  cost: number;
  durationMin: string;
  sections: HealedTest[];
}

interface FailedTest {
  testFile: string;
  testName: string;
  error: string;
  stack: string;
}

// ====== Config ======

const REPORTS_DIR = path.resolve(__dirname, "..", "reports");
const PROJECT_DIR = path.resolve(__dirname, "..");
const MODEL = process.env.HEALER_MODEL || "claude-sonnet-4-6";
const MAX_TURNS = parseInt(process.env.HEALER_MAX_TURNS || "80", 10);
const MAX_BUDGET_USD = parseFloat(process.env.HEALER_MAX_BUDGET || "3.0");
const MAX_HEAL_ATTEMPTS = 2;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

// ====== JSON Schema for structured output ======

const outputSchema = {
  type: "object" as const,
  properties: {
    healedTests: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          testFile: { type: "string" as const },
          testName: { type: "string" as const },
          originalError: { type: "string" as const },
          fix: { type: "string" as const },
          filesModified: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          status: {
            type: "string" as const,
            enum: ["HEALED", "UNHEALED"],
          },
        },
        required: [
          "testFile",
          "testName",
          "originalError",
          "fix",
          "filesModified",
          "status",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["healedTests"],
  additionalProperties: false,
};

// ====== Playwright JSON Parsing ======

interface PlaywrightResult {
  totalTests: number;
  passed: number;
  failures: FailedTest[];
}

function parsePlaywrightJson(jsonStr: string): PlaywrightResult {
  if (!jsonStr) {
    return { totalTests: 0, passed: 0, failures: [] };
  }

  const raw = JSON.parse(jsonStr);
  const failures: FailedTest[] = [];
  let totalTests = 0;
  let passed = 0;

  function traverseSuites(suites: any[], parentFile?: string) {
    for (const suite of suites) {
      const file = suite.file || parentFile;

      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests || []) {
            totalTests++;
            const lastResult = test.results?.[test.results.length - 1];
            if (!lastResult) continue;

            if (lastResult.status === "passed") {
              passed++;
            } else {
              // Playwright uses "errors" (array), not "error"
              const firstError = lastResult.errors?.[0];
              failures.push({
                testFile: file || "unknown",
                testName: spec.title,
                error:
                  firstError?.message || lastResult.status || "unknown error",
                stack: firstError?.stack || "",
              });
            }
          }
        }
      }

      if (suite.suites) {
        traverseSuites(suite.suites, file);
      }
    }
  }

  traverseSuites(raw.suites || []);

  // Cross-check with Playwright stats
  const stats = raw.stats;
  if (stats && totalTests === 0) {
    const expected = stats.expected || 0;
    const unexpected = stats.unexpected || 0;
    const flaky = stats.flaky || 0;
    const skipped = stats.skipped || 0;
    const total = expected + unexpected + flaky + skipped;
    if (total > 0) {
      console.warn(
        `WARNING: Parser found 0 tests but stats show ${total}. Re-parsing with fallback.`
      );
    }
  }

  return { totalTests, passed, failures };
}

// ====== Run Playwright Tests ======

function runPlaywrightTests(
  jsonOutputPath: string,
  specificFiles?: string[]
): PlaywrightResult {
  // Remove previous JSON output to avoid reading stale data
  if (fs.existsSync(jsonOutputPath)) {
    fs.unlinkSync(jsonOutputPath);
  }

  const args = ["npx", "playwright", "test", "--reporter=json"];
  if (specificFiles && specificFiles.length > 0) {
    args.push(...specificFiles);
  }

  const cmd = args.join(" ");
  console.log(`Running: ${cmd}`);
  console.log(`JSON output target: ${jsonOutputPath}`);

  try {
    execSync(cmd, {
      cwd: PROJECT_DIR,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonOutputPath },
      stdio: "inherit",
      timeout: 1_800_000, // 30 min
    });
  } catch (err: any) {
    // Non-zero exit = tests failed, JSON file should still be written
    const code = err?.status ?? "unknown";
    console.log(`Playwright exited with code: ${code}`);
  }

  // Read JSON output
  let jsonStr = "";
  if (fs.existsSync(jsonOutputPath)) {
    jsonStr = fs.readFileSync(jsonOutputPath, "utf-8");
    console.log(`JSON output: ${jsonOutputPath} (${jsonStr.length} bytes)`);
  } else {
    console.error("ERROR: JSON output file not created by Playwright!");
  }

  const result = parsePlaywrightJson(jsonStr);

  // Sanity check: if file exists but parser returns 0, something is wrong
  if (jsonStr.length > 100 && result.totalTests === 0) {
    console.error(
      `ERROR: JSON file has ${jsonStr.length} bytes but parsed 0 tests. Possible parsing bug.`
    );
    // Log first 500 chars for debugging
    console.error(`JSON preview: ${jsonStr.slice(0, 500)}`);
  }

  return result;
}

// ====== Build Agent Prompt ======

function buildHealerPrompt(failures: FailedTest[]): string {
  const failureDetails = failures
    .map(
      (f, i) => `
### Fallo ${i + 1}
- **Archivo**: ${f.testFile}
- **Test**: ${f.testName}
- **Error**: ${f.error}
- **Stack trace**:
\`\`\`
${f.stack.slice(0, 2000)}
\`\`\`
`
    )
    .join("\n");

  const failedFiles = [...new Set(failures.map((f) => f.testFile))];
  const failedFilesCmd = failedFiles.join(" ");

  return `Sos un agente de auto-reparacion (healer) para tests de Playwright E2E.
Tu trabajo es analizar tests que fallaron, entender la causa raiz, y aplicar el fix minimo necesario.

## Contexto del proyecto
- Tests de Playwright para casino games en pba.sports.bet.ar
- Directorio del proyecto: ${PROJECT_DIR}
- Los tests estan en \`tests/\` y las utilidades compartidas en \`tests/utils/\`
- Los juegos de casino corren en canvas dentro de iframes anidados
- Config de Playwright: \`playwright.config.ts\`

## Tests que fallaron

${failureDetails}

## Tu tarea

1. **Lee los archivos** de cada test que fallo. Usa Read para leer el archivo de test y cualquier import de \`tests/utils/\` que use.

2. **Analiza el error**: Determina si es:
   - **Bug de codigo** (selector incorrecto, timeout muy bajo, logica rota, typo, import faltante, etc.) → FIXEABLE
   - **Problema de entorno** (servidor caido, credenciales invalidas, error de red, geolocalizacion rechazada, etc.) → NO FIXEABLE

3. **Si es fixeable**, aplica el fix minimo necesario usando Edit. Reglas estrictas:
   - Solo modifica archivos bajo \`tests/\`
   - Fix minimo: no refactorear, no agregar features, no cambiar logica que funciona
   - NO debilitar assertions para que "pasen" (ej: no cambiar \`toBe(X)\` a \`toBeTruthy()\`, no agregar try/catch que trague errores)
   - NO eliminar tests ni marcarlos como \`skip\`
   - NO cambiar timeouts de forma arbitraria (solo si el timeout actual es claramente insuficiente)

4. **Verifica tu fix** corriendo solo los tests que fallaron:
   \`\`\`bash
   cd ${PROJECT_DIR} && npx playwright test ${failedFilesCmd} --reporter=list
   \`\`\`

5. **Reporta el resultado** en el formato JSON estructurado. Para cada test fallido reporta:
   - \`testFile\`: ruta del archivo de test
   - \`testName\`: nombre del test
   - \`originalError\`: mensaje de error original
   - \`fix\`: descripcion breve del cambio realizado (o razon por la que no se puede arreglar)
   - \`filesModified\`: lista de archivos modificados (vacia si UNHEALED)
   - \`status\`: "HEALED" si el test ahora pasa, "UNHEALED" si no se pudo arreglar

## Importante
- Si TODOS los fallos son de entorno (servidor caido, red, etc.), marca todos como UNHEALED y explica por que en el campo fix.
- Si un fix requiere cambiar credenciales o configuracion fuera de \`tests/\`, marca como UNHEALED.
- Prioriza fixes simples y seguros. Un fix de una linea es mejor que un refactor de 20 lineas.
`;
}

// ====== Invoke Healer Agent ======

async function invokeHealerAgent(
  failures: FailedTest[]
): Promise<{ healedTests: HealedTest[]; cost: number }> {
  const prompt = buildHealerPrompt(failures);
  let healedTests: HealedTest[] = [];
  let totalCost = 0;

  try {
    for await (const message of query({
      prompt,
      options: {
        model: MODEL,
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        outputFormat: {
          type: "json_schema",
          schema: outputSchema,
        },
      },
    })) {
      if ("result" in message) {
        const resultMsg = message as any;
        totalCost = resultMsg.total_cost_usd ?? 0;

        if (resultMsg.structured_output) {
          healedTests = resultMsg.structured_output.healedTests || [];
        } else if (resultMsg.result) {
          try {
            const parsed = JSON.parse(resultMsg.result);
            healedTests = parsed.healedTests || [];
          } catch {
            console.warn("Could not parse agent result as JSON");
          }
        }
      }
    }
  } catch (err) {
    console.error("Healer agent error:", err);
  }

  return { healedTests, cost: totalCost };
}

// ====== Main ======

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  console.log(`[${today}] Healer Agent - Starting`);
  console.log(
    `Model: ${MODEL} | Max turns: ${MAX_TURNS} | Budget: $${MAX_BUDGET_USD}`
  );

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  // Step 1: Run all tests
  const jsonOutputPath = path.join(REPORTS_DIR, `healer-raw-${today}.json`);
  console.log("\n=== Running all Playwright tests ===");
  const initial = runPlaywrightTests(jsonOutputPath);
  console.log(
    `Results: ${initial.passed}/${initial.totalTests} passed, ${initial.failures.length} failed`
  );

  // Step 2: All pass → done
  if (initial.failures.length === 0) {
    const duration = ((Date.now() - startTime) / 60000).toFixed(1);
    const report: HealerReport = {
      date: today,
      status: "ALL_PASS",
      totalTests: initial.totalTests,
      passed: initial.passed,
      failed: 0,
      healed: 0,
      unhealed: 0,
      healAttempts: 0,
      cost: 0,
      durationMin: duration,
      sections: [],
    };
    writeReports(report, today);
    console.log(`\nAll tests passed! No healing needed.`);
    return;
  }

  // Steps 3-4: Heal loop
  let allHealedTests: HealedTest[] = [];
  let totalCost = 0;
  let remainingFailures = initial.failures;
  let healAttempts = 0;

  for (
    let attempt = 1;
    attempt <= MAX_HEAL_ATTEMPTS && remainingFailures.length > 0;
    attempt++
  ) {
    healAttempts = attempt;
    console.log(
      `\n=== Heal attempt ${attempt}/${MAX_HEAL_ATTEMPTS} - ${remainingFailures.length} failures ===`
    );

    // Invoke agent
    const { healedTests, cost } = await invokeHealerAgent(remainingFailures);
    totalCost += cost;
    allHealedTests.push(...healedTests);

    // Re-run failed tests to verify independently
    const failedFiles = [...new Set(remainingFailures.map((f) => f.testFile))];
    console.log(`\n--- Verification run: ${failedFiles.join(", ")} ---`);
    const verification = runPlaywrightTests(jsonOutputPath, failedFiles);

    remainingFailures = verification.failures;
    console.log(`Verification: ${remainingFailures.length} still failing`);

    if (remainingFailures.length === 0) break;
  }

  // Step 5: Build final report
  const duration = ((Date.now() - startTime) / 60000).toFixed(1);
  const healed = initial.failures.length - remainingFailures.length;
  const unhealed = remainingFailures.length;

  // Update statuses based on independent verification
  const stillFailingKeys = new Set(
    remainingFailures.map((f) => `${f.testFile}::${f.testName}`)
  );
  for (const ht of allHealedTests) {
    const key = `${ht.testFile}::${ht.testName}`;
    ht.status = stillFailingKeys.has(key) ? "UNHEALED" : "HEALED";
  }

  // Add any failures not covered by agent output
  const agentCoveredKeys = new Set(
    allHealedTests.map((ht) => `${ht.testFile}::${ht.testName}`)
  );
  for (const f of initial.failures) {
    const key = `${f.testFile}::${f.testName}`;
    if (!agentCoveredKeys.has(key)) {
      allHealedTests.push({
        testFile: f.testFile,
        testName: f.testName,
        originalError: f.error,
        fix: "Not addressed by agent",
        filesModified: [],
        status: stillFailingKeys.has(key) ? "UNHEALED" : "HEALED",
      });
    }
  }

  let status: HealerReport["status"];
  if (unhealed === 0) {
    status = "HEALED";
  } else if (healed > 0) {
    status = "PARTIAL";
  } else {
    status = "UNHEALED";
  }

  const report: HealerReport = {
    date: today,
    status,
    totalTests: initial.totalTests,
    passed: initial.passed,
    failed: initial.failures.length,
    healed,
    unhealed,
    healAttempts,
    cost: totalCost,
    durationMin: duration,
    sections: allHealedTests,
  };

  writeReports(report, today);
  console.log(
    `\nDone in ${duration} min | Cost: $${totalCost.toFixed(2)} | Status: ${status} | Healed: ${healed}/${initial.failures.length}`
  );
}

// ====== Report Writing ======

function writeReports(report: HealerReport, today: string): void {
  const jsonPath = path.join(REPORTS_DIR, `healer-${today}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${jsonPath}`);

  const htmlPath = path.join(REPORTS_DIR, `healer-${today}.html`);
  fs.writeFileSync(htmlPath, generateHtml(report));
  console.log(`HTML report: ${htmlPath}`);

  if (SLACK_WEBHOOK_URL) {
    sendSlack(report).catch((err) => console.warn("Slack error:", err));
  } else {
    console.log("No SLACK_WEBHOOK_URL configured, skipping notification");
  }
}

// ====== HTML Report ======

function generateHtml(report: HealerReport): string {
  const statusColors: Record<string, string> = {
    ALL_PASS: "#22c55e",
    HEALED: "#22c55e",
    PARTIAL: "#f59e0b",
    UNHEALED: "#ef4444",
    ERROR: "#ef4444",
  };
  const statusIcons: Record<string, string> = {
    ALL_PASS: "&#10004;",
    HEALED: "&#9884;",
    PARTIAL: "&#9888;",
    UNHEALED: "&#10008;",
    ERROR: "&#10008;",
  };

  const color = statusColors[report.status] || "#94a3b8";
  const icon = statusIcons[report.status] || "?";

  const rows = report.sections
    .map((s) => {
      const rowColor = s.status === "HEALED" ? "#22c55e" : "#ef4444";
      const rowIcon = s.status === "HEALED" ? "&#9884;" : "&#10008;";
      const filesStr = s.filesModified.length > 0
        ? s.filesModified.map((f) => `<code>${f}</code>`).join(", ")
        : "&mdash;";
      const errorStr = s.originalError.length > 200
        ? s.originalError.slice(0, 200) + "..."
        : s.originalError;
      return `
      <tr>
        <td style="color:${rowColor};font-size:18px;">${rowIcon}</td>
        <td>${s.testName}</td>
        <td><code>${s.testFile}</code></td>
        <td style="color:${rowColor};font-weight:bold;">${s.status}</td>
        <td>${s.fix}</td>
        <td>${filesStr}</td>
        <td class="error-cell">${errorStr}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Healer Report - ${report.date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1100px; margin: 40px auto; padding: 0 20px; background: #0f172a; color: #e2e8f0; }
    h1 { color: ${color}; }
    .summary { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
    .summary .card { background: #1e293b; padding: 16px 24px; border-radius: 8px; min-width: 120px; }
    .summary .card .label { font-size: 12px; text-transform: uppercase; color: #94a3b8; }
    .summary .card .value { font-size: 24px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #1e293b; padding: 12px; text-align: left; font-size: 13px; text-transform: uppercase; color: #94a3b8; }
    td { padding: 12px; border-bottom: 1px solid #1e293b; vertical-align: top; }
    tr:hover { background: #1e293b40; }
    code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .error-cell { font-size: 12px; color: #94a3b8; max-width: 300px; word-break: break-word; }
    .footer { margin-top: 30px; color: #64748b; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${icon} Healer Report - ${report.date}</h1>

  <div class="summary">
    <div class="card">
      <div class="label">Status</div>
      <div class="value" style="color:${color}">${report.status}</div>
    </div>
    <div class="card">
      <div class="label">Healed</div>
      <div class="value">${report.healed}/${report.failed}</div>
    </div>
    <div class="card">
      <div class="label">Tests</div>
      <div class="value">${report.passed + report.healed}/${report.totalTests}</div>
    </div>
    <div class="card">
      <div class="label">Cost</div>
      <div class="value">$${report.cost.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="label">Duration</div>
      <div class="value">${report.durationMin} min</div>
    </div>
    <div class="card">
      <div class="label">Attempts</div>
      <div class="value">${report.healAttempts}</div>
    </div>
  </div>

  ${
    report.sections.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th></th>
        <th>Test</th>
        <th>File</th>
        <th>Status</th>
        <th>Fix</th>
        <th>Files Modified</th>
        <th>Error</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`
      : `<p style="color:#22c55e;margin-top:20px;">All tests passed - no healing needed.</p>`
  }

  <div class="footer">
    Generated by Healer Agent | Model: ${MODEL} | Attempts: ${report.healAttempts}
  </div>
</body>
</html>`;
}

// ====== Slack Notification ======

async function sendSlack(report: HealerReport): Promise<void> {
  const statusEmojis: Record<string, string> = {
    ALL_PASS: ":white_check_mark:",
    HEALED: ":wrench:",
    PARTIAL: ":warning:",
    UNHEALED: ":x:",
    ERROR: ":x:",
  };

  const emoji = statusEmojis[report.status] || ":grey_question:";
  const lines = report.sections.map((s) => {
    const icon = s.status === "HEALED" ? ":wrench:" : ":x:";
    return `${icon} \`${s.testName}\` (${s.testFile}) - ${s.fix}`;
  });

  const text = [
    `${emoji} *Healer Report - ${report.date}*`,
    `Status: ${report.status} | Healed: ${report.healed}/${report.failed} | Cost: $${report.cost.toFixed(2)} | Duration: ${report.durationMin} min`,
    ...(lines.length > 0 ? ["", ...lines] : []),
  ].join("\n");

  try {
    const resp = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (resp.ok) {
      console.log("Slack notification sent");
    } else {
      console.warn(
        `Slack notification failed: ${resp.status} ${resp.statusText}`
      );
    }
  } catch (err) {
    console.warn("Slack notification error:", err);
  }
}

// ====== Run ======

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
