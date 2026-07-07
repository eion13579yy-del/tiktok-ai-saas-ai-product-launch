import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.APP_URL || "http://localhost:3000";

let cookie = "";

function updateCookie(response) {
  const setCookie = response.headers.getSetCookie?.() || [];
  const fallback = response.headers.get("set-cookie");
  const values = setCookie.length > 0 ? setCookie : fallback ? [fallback] : [];

  if (values.length > 0) {
    cookie = values.map((value) => value.split(";")[0]).join("; ");
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    }
  });

  updateCookie(response);

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, payload };
}

const engineSource = await readFile("src/ai-engine/index.js", "utf8");
const openAiClientSource = await readFile("src/ai-engine/openai-client.js", "utf8");
const serverAiSource = await readFile("server/ai.js", "utf8");

for (const token of [
  "generateAiEngineReport",
  "AI_ENGINE_REPORT_SCHEMA",
  "productProfile",
  "lifecycle",
  "tiktokFit",
  "amazonFit",
  "afterSalesRisk",
  "complianceRisk",
  "logisticsRisk",
  "Demand Score",
  "Competition Score",
  "Virality Score",
  "Margin Score",
  "Risk Score",
  "Overall Score",
  "scoreInsight",
  "dataSource",
  "modelReasoning"
]) {
  assert(engineSource.includes(token), `AI Engine should include ${token}.`);
}

assert(openAiClientSource.includes("https://api.deepseek.com/chat/completions"), "AI client should support DeepSeek chat completions.");
assert(openAiClientSource.includes("https://api.openai.com/v1/responses"), "AI client should keep optional OpenAI Responses support.");
assert(serverAiSource.includes("../src/ai-engine/index.js"), "server/ai.js should delegate to /src/ai-engine.");
assert(!serverAiSource.includes("return buildLocalAiReport(project);"), "Report generation should not return local fallback.");

const health = await request("/api/health");
assert(health.status === 200, "Health should succeed.");
assert(health.payload.sprint === "Sprint 20", "Health should report Sprint 20.");

const email = `sprint20-${randomUUID()}@example.com`;
const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint 20 Tester",
    email,
    password: "Sprint20Pass!",
    workspaceName: "AI Engine Team"
  })
});
assert(registered.status === 201, "Register should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Biometric jewelry box",
    category: "Jewelry storage",
    targetMarket: "美国",
    platforms: ["TikTok", "Amazon"],
    competitorLinks: "https://example.com/competitor",
    targetPrice: 79.99,
    costPrice: 22.5
  })
});
assert(created.status === 201, "Project creation should succeed.");

if (!health.payload.services.openai.configured) {
  const generated = await request(`/api/product-projects/${created.payload.project.id}/launch-report/generate`, {
    method: "POST",
    body: JSON.stringify({
      generationMode: "local"
    })
  });

  assert(generated.status === 503, "Report generation should fail without the configured provider key even when local mode is requested.");
  assert(
    generated.payload.message.includes("DEEPSEEK_API_KEY") || generated.payload.message.includes("OPENAI_API_KEY"),
    "Missing key error should mention the active provider API key."
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "/src/ai-engine exists",
    "China-friendly DeepSeek provider supported",
    "optional OpenAI Responses API retained",
        "Product Profile schema",
        "dynamic sections with Data Source and Model Reasoning",
        "AI Score schema",
        "local fallback removed from exported report path"
      ],
      openaiConfigured: health.payload.services.openai.configured
    },
    null,
    2
  )
);
