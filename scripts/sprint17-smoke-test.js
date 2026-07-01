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

const health = await request("/api/health");
assert(health.status === 200, "Health check should succeed.");
assert(health.payload.services.openai, "Health check should expose OpenAI configuration status.");
assert(typeof health.payload.services.openai.configured === "boolean", "OpenAI status should expose configured boolean.");
assert(health.payload.services.openai.model, "OpenAI status should expose model name.");

const aiSource = await readFile("server/ai.js", "utf8");
assert(aiSource.includes("generateWithOpenAI"), "AI service should include OpenAI generation path.");
assert(aiSource.includes("openAiConfigStatus"), "AI service should read OpenAI config status.");
assert(aiSource.includes("product_fingerprint"), "AI service should include product fingerprint module.");
assert(aiSource.includes("reportStructureForFingerprint"), "AI service should include dynamic report structure selection.");

const email = `sprint17-${randomUUID()}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint 17 Tester",
    email,
    password: "Sprint17Pass!",
    workspaceName: "OpenAI Fingerprint Team"
  })
});

assert(registered.status === 201, "Register should succeed.");

const demoProduct = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "LED desk lamp",
    category: "Home office light",
    targetMarket: "美国",
    platforms: ["TikTok", "Amazon"],
    targetPrice: 24.99,
    costPrice: 8.5,
    inventory: 320,
    leadTimeDays: 14
  })
});

assert(demoProduct.status === 201, "Demo product creation should succeed.");

const regulatedProduct = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Kids health supplement gummies",
    category: "Health supplement",
    targetMarket: "美国",
    platforms: ["Amazon", "Walmart"],
    targetPrice: 34.99,
    costPrice: 11.25,
    inventory: 220,
    leadTimeDays: 35
  })
});

assert(regulatedProduct.status === 201, "Regulated product creation should succeed.");

if (!health.payload.services.openai.configured) {
  const autoAttempt = await request(`/api/product-projects/${demoProduct.payload.project.id}/launch-report/generate`, {
    method: "POST",
    body: JSON.stringify({})
  });

  assert(autoAttempt.status === 503, "Auto report generation should fail clearly when OPENAI_API_KEY is missing.");
  assert(autoAttempt.payload.message.includes("OPENAI_API_KEY"), "Missing key response should name OPENAI_API_KEY.");
}

const demoReport = await request(`/api/product-projects/${demoProduct.payload.project.id}/launch-report/generate`, {
  method: "POST",
  body: JSON.stringify({
    generationMode: "local"
  })
});

assert(demoReport.status === 201, "Local demo report generation should succeed.");

const regulatedReport = await request(`/api/product-projects/${regulatedProduct.payload.project.id}/launch-report/generate`, {
  method: "POST",
  body: JSON.stringify({
    generationMode: "local"
  })
});

assert(regulatedReport.status === 201, "Local regulated report generation should succeed.");

const demoSections = demoReport.payload.report.sections;
const regulatedSections = regulatedReport.payload.report.sections;
const demoFingerprint = demoSections.find((section) => section.type === "product_fingerprint");
const regulatedFingerprint = regulatedSections.find((section) => section.type === "product_fingerprint");

assert(demoFingerprint, "Demo report should include product fingerprint.");
assert(regulatedFingerprint, "Regulated report should include product fingerprint.");
assert(demoSections[0].type === "product_fingerprint", "Product fingerprint should be the first module.");
assert(regulatedSections[0].type === "product_fingerprint", "Product fingerprint should be the first module.");
assert(demoFingerprint.archetype !== regulatedFingerprint.archetype, "Different products should produce different fingerprints.");
assert(
  demoSections.map((section) => section.type).join(",") !== regulatedSections.map((section) => section.type).join(","),
  "Different fingerprints should produce different report structures."
);
assert(
  demoReport.payload.report.summary !== regulatedReport.payload.report.summary,
  "Different products should not reuse the same summary copy."
);
assert(demoFingerprint.proofAssetsNeeded.length > 0, "Product fingerprint should include proof assets.");
assert(regulatedFingerprint.mainRisk.includes("平台") || regulatedFingerprint.mainRisk.includes("规则"), "Regulated fingerprint should emphasize compliance risk.");

const version = await request("/api/version");
assert(version.status === 200, "Version endpoint should succeed.");
assert(["Sprint 17", "Sprint 18", "Sprint 19", "Sprint 20"].includes(version.payload.sprint), "Version endpoint should report Sprint 17 or later.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("产品指纹"), "Frontend should label product fingerprint module.");
assert(appText.includes("必须补齐的证明资产"), "Frontend should render proof assets.");
assert(cssText.includes("fingerprint-grid"), "Frontend should style product fingerprint.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "OpenAI config status",
        "missing key does not silently fallback",
        "product_fingerprint module",
        "dynamic report structure by fingerprint",
        "different product copy",
        "fingerprint UI"
      ],
      openaiConfigured: health.payload.services.openai.configured,
      demoArchetype: demoFingerprint.archetype,
      regulatedArchetype: regulatedFingerprint.archetype
    },
    null,
    2
  )
);
