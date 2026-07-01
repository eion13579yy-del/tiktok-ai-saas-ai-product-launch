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

  return {
    status: response.status,
    payload
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const unique = Date.now();
const email = `sprint7-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Seven Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 7 Insights Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Portable blender",
    category: "Kitchen appliances",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon"],
    targetPrice: "29.99",
    costPrice: "9.50",
    inventory: "500",
    leadTimeDays: "21"
  })
});
assert(created.status === 201, "Project creation should succeed.");

const generated = await request(`/api/product-projects/${created.payload.project.id}/launch-report/generate`, {
  method: "POST",
  body: JSON.stringify({
    generationMode: "local"
  })
});
assert(generated.status === 201, "Report generation should succeed.");

const market = generated.payload.report.sections.find((section) => section.type === "market_analysis");
const persona = generated.payload.report.sections.find((section) => section.type === "customer_persona");
assert(market.confidence === "high", "Market analysis should be high confidence.");
assert(Array.isArray(market.scores) && market.scores.length >= 5, "Market analysis should include score cards.");
assert(Array.isArray(market.insights) && market.insights.length >= 3, "Market analysis should include insights.");
assert(persona.confidence === "high", "Customer persona should be high confidence.");
assert(Array.isArray(persona.personas) && persona.personas.length >= 2, "Customer persona should include persona cards.");
assert(Array.isArray(persona.decisionPath) && persona.decisionPath.length >= 4, "Customer persona should include decision path.");

const regenerated = await request(`/api/launch-reports/${generated.payload.report.id}/sections/market_analysis/regenerate`, {
  method: "POST",
  body: JSON.stringify({
    generationMode: "local"
  })
});
assert(regenerated.status === 200, "Section regeneration should succeed.");
assert(regenerated.payload.section.type === "market_analysis", "Regenerated section should be market analysis.");
assert(regenerated.payload.section.regeneratedAt, "Regenerated section should include timestamp.");
assert(regenerated.payload.report.sections.find((section) => section.type === "market_analysis").regeneratedAt, "Report should persist regenerated section.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-regenerate-section"), "Frontend should expose section regeneration action.");
assert(cssText.includes("confidence-pill"), "Frontend should style confidence display.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "market analysis score structure",
        "customer persona structure",
        "high confidence indicators",
        "section regeneration endpoint",
        "section regeneration UI surface"
      ],
      user: email,
      report: generated.payload.report.id
    },
    null,
    2
  )
);
