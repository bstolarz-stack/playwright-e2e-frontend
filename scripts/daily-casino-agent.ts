import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ====== Types ======

interface SectionResult {
  name: string;
  game: string | null;
  status: "PASS" | "FAIL";
  loadTime: number | null;
  spins: {
    total: number;
    successful: number;
    failed: number;
    details: string;
  } | null;
  error: string | null;
}

interface TestReport {
  date: string;
  status: "PASS" | "FAIL";
  totalSections: number;
  passedSections: number;
  failedSections: number;
  sections: SectionResult[];
}

// ====== Config ======

const REPORTS_DIR = path.resolve(__dirname, "..", "reports");
const PROMPT_FILE = path.resolve(
  __dirname,
  "..",
  ".claude",
  "commands",
  "test-casino-diario.md"
);

const APP_USERNAME = process.env.APP_USERNAME || "33284255";
const PASSWORD = process.env.PASSWORD || "";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const MODEL = process.env.CASINO_TEST_MODEL || "claude-sonnet-4-6";
const MAX_TURNS = parseInt(process.env.CASINO_TEST_MAX_TURNS || "150", 10);
const MAX_BUDGET_USD = parseFloat(
  process.env.CASINO_TEST_MAX_BUDGET || "5.0"
);

// ====== JSON Schema for structured output ======

const outputSchema = {
  type: "object" as const,
  properties: {
    date: { type: "string" as const },
    status: { type: "string" as const, enum: ["PASS", "FAIL"] },
    totalSections: { type: "number" as const },
    passedSections: { type: "number" as const },
    failedSections: { type: "number" as const },
    sections: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          game: { type: ["string", "null"] as any },
          status: { type: "string" as const, enum: ["PASS", "FAIL"] },
          loadTime: { type: ["number", "null"] as any },
          spins: {
            type: ["object", "null"] as any,
            properties: {
              total: { type: "number" as const },
              successful: { type: "number" as const },
              failed: { type: "number" as const },
              details: { type: "string" as const },
            },
            required: ["total", "successful", "failed", "details"],
            additionalProperties: false,
          },
          error: { type: ["string", "null"] as any },
        },
        required: ["name", "game", "status", "loadTime", "spins", "error"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "date",
    "status",
    "totalSections",
    "passedSections",
    "failedSections",
    "sections",
  ],
  additionalProperties: false,
};

// ====== Main ======

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  console.log(`[${today}] Casino Daily Test - Starting`);
  console.log(`Model: ${MODEL} | Max turns: ${MAX_TURNS} | Budget: $${MAX_BUDGET_USD}`);

  // Ensure reports directory exists
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  // Read the prompt template
  if (!fs.existsSync(PROMPT_FILE)) {
    console.error(`Prompt file not found: ${PROMPT_FILE}`);
    process.exit(1);
  }
  const promptTemplate = fs.readFileSync(PROMPT_FILE, "utf-8");

  // Replace $ARGUMENTS with credentials
  const prompt = promptTemplate.replace(
    "$ARGUMENTS",
    `${APP_USERNAME}:${PASSWORD}`
  );

  let report: TestReport | null = null;
  let totalCost = 0;
  let numTurns = 0;

  try {
    for await (const message of query({
      prompt,
      options: {
        model: MODEL,
        maxTurns: MAX_TURNS,
        maxBudgetUsd: MAX_BUDGET_USD,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        mcpServers: {
          playwright: {
            command: "npx",
            args: [
              "@playwright/mcp@latest",
              "--browser",
              "chromium",
              "--headless",
            ],
          },
        },
        outputFormat: {
          type: "json_schema",
          schema: outputSchema,
        },
      },
    })) {
      // Track result
      if ("result" in message) {
        const resultMsg = message as any;
        totalCost = resultMsg.total_cost_usd ?? 0;
        numTurns = resultMsg.num_turns ?? 0;

        // Try structured output first, then parse result text
        if (resultMsg.structured_output) {
          report = resultMsg.structured_output as TestReport;
        } else if (resultMsg.result) {
          try {
            report = JSON.parse(resultMsg.result) as TestReport;
          } catch {
            console.warn("Could not parse result as JSON, extracting from text...");
            report = extractReportFromText(resultMsg.result, today);
          }
        }
      }
    }
  } catch (err) {
    console.error("Agent execution failed:", err);
    report = {
      date: today,
      status: "FAIL",
      totalSections: 0,
      passedSections: 0,
      failedSections: 0,
      sections: [
        {
          name: "Agent Error",
          game: null,
          status: "FAIL",
          loadTime: null,
          spins: null,
          error: String(err),
        },
      ],
    };
  }

  const durationMs = Date.now() - startTime;
  const durationMin = (durationMs / 60000).toFixed(1);

  if (!report) {
    report = {
      date: today,
      status: "FAIL",
      totalSections: 0,
      passedSections: 0,
      failedSections: 0,
      sections: [],
    };
  }

  // Write JSON report
  const jsonPath = path.join(REPORTS_DIR, `casino-test-${today}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`JSON report: ${jsonPath}`);

  // Write HTML report
  const htmlPath = path.join(REPORTS_DIR, `casino-test-${today}.html`);
  fs.writeFileSync(htmlPath, generateHtml(report, totalCost, durationMin));
  console.log(`HTML report: ${htmlPath}`);

  // Send Slack notification
  if (SLACK_WEBHOOK_URL) {
    await sendSlack(report, totalCost, durationMin);
  } else {
    console.log("No SLACK_WEBHOOK_URL configured, skipping notification");
  }

  console.log(
    `\nDone in ${durationMin} min | Turns: ${numTurns} | Cost: $${totalCost.toFixed(2)} | Status: ${report.status}`
  );
}

// ====== Helpers ======

function extractReportFromText(text: string, date: string): TestReport {
  // Try to find JSON block in the text
  const jsonMatch = text.match(/\{[\s\S]*"sections"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as TestReport;
    } catch {
      // Fall through
    }
  }

  return {
    date,
    status: "FAIL",
    totalSections: 0,
    passedSections: 0,
    failedSections: 0,
    sections: [
      {
        name: "Parse Error",
        game: null,
        status: "FAIL",
        loadTime: null,
        spins: null,
        error: "Could not parse agent output as structured report",
      },
    ],
  };
}

function generateHtml(
  report: TestReport,
  cost: number,
  duration: string
): string {
  const statusColor = report.status === "PASS" ? "#22c55e" : "#ef4444";
  const statusIcon = report.status === "PASS" ? "&#10004;" : "&#10008;";

  const rows = report.sections
    .map((s) => {
      const icon = s.status === "PASS" ? "&#10004;" : "&#10008;";
      const color = s.status === "PASS" ? "#22c55e" : "#ef4444";
      const spinsInfo = s.spins
        ? `${s.spins.successful}/${s.spins.total} spins`
        : "N/A";
      const loadInfo =
        s.loadTime != null ? `${s.loadTime.toFixed(1)}s` : "N/A";
      return `
      <tr>
        <td style="color:${color};font-size:18px;">${icon}</td>
        <td>${s.name}</td>
        <td>${s.game || "N/A"}</td>
        <td style="color:${color};font-weight:bold;">${s.status}</td>
        <td>${loadInfo}</td>
        <td>${spinsInfo}</td>
        <td>${s.error || ""}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Casino Test Report - ${report.date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #0f172a; color: #e2e8f0; }
    h1 { color: ${statusColor}; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary .card { background: #1e293b; padding: 16px 24px; border-radius: 8px; }
    .summary .card .label { font-size: 12px; text-transform: uppercase; color: #94a3b8; }
    .summary .card .value { font-size: 24px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #1e293b; padding: 12px; text-align: left; font-size: 13px; text-transform: uppercase; color: #94a3b8; }
    td { padding: 12px; border-bottom: 1px solid #1e293b; }
    tr:hover { background: #1e293b40; }
    .footer { margin-top: 30px; color: #64748b; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${statusIcon} Casino Daily Test - ${report.date}</h1>

  <div class="summary">
    <div class="card">
      <div class="label">Status</div>
      <div class="value" style="color:${statusColor}">${report.status}</div>
    </div>
    <div class="card">
      <div class="label">Passed</div>
      <div class="value">${report.passedSections}/${report.totalSections}</div>
    </div>
    <div class="card">
      <div class="label">Cost</div>
      <div class="value">$${cost.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="label">Duration</div>
      <div class="value">${duration} min</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
        <th>Section</th>
        <th>Game</th>
        <th>Status</th>
        <th>Load Time</th>
        <th>Spins</th>
        <th>Error</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    Generated by Casino Daily Test Agent | Model: claude-sonnet-4-6
  </div>
</body>
</html>`;
}

async function sendSlack(
  report: TestReport,
  cost: number,
  duration: string
): Promise<void> {
  const statusEmoji = report.status === "PASS" ? ":white_check_mark:" : ":x:";
  const lines = report.sections.map((s) => {
    const icon = s.status === "PASS" ? ":white_check_mark:" : ":x:";
    const spinsInfo = s.spins ? ` (${s.spins.details})` : "";
    const errorInfo = s.error ? ` - ${s.error}` : "";
    return `${icon} ${s.name} - ${s.game || "N/A"}${spinsInfo}${errorInfo}`;
  });

  const text = [
    `${statusEmoji} *Casino Daily Test - ${report.date}*`,
    `Status: ${report.status} | ${report.passedSections}/${report.totalSections} passed | Cost: $${cost.toFixed(2)} | Duration: ${duration} min`,
    "",
    ...lines,
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
      console.warn(`Slack notification failed: ${resp.status} ${resp.statusText}`);
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
