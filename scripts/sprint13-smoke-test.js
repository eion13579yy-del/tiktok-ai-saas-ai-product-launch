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
const email = `sprint13-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Thirteen Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 13 Forecast Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Cordless mini vacuum",
    category: "Home cleaning",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon", "Walmart"],
    targetPrice: "49.99",
    costPrice: "18.50",
    inventory: "700",
    leadTimeDays: "28"
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

const forecast = generated.payload.report.sections.find((section) => section.type === "sales_forecast");
assert(forecast, "Report should include sales forecast module.");
assert(forecast.confidence === "high", "Sales forecast should be high confidence.");
assert(Array.isArray(forecast.scenarios) && forecast.scenarios.length === 3, "Sales forecast should include three scenarios.");
assert(Array.isArray(forecast.monthlyBreakdown) && forecast.monthlyBreakdown.length === 3, "Sales forecast should include monthly breakdown.");
assert(Array.isArray(forecast.assumptions) && forecast.assumptions.length >= 4, "Sales forecast should include assumptions.");
assert(Array.isArray(forecast.riskLevers) && forecast.riskLevers.length >= 4, "Sales forecast should include risk levers.");

const baseScenario = forecast.scenarios.find((scenario) => scenario.id === "forecast-02");
assert(baseScenario, "Base forecast scenario should exist.");
assert(baseScenario.units > 0, "Forecast scenario should include units.");
assert(baseScenario.revenue > 0, "Forecast scenario should include revenue.");
assert(baseScenario.grossProfit > 0, "Forecast scenario should include gross profit.");
assert(baseScenario.adBudget >= 0, "Forecast scenario should include ad budget.");
assert(baseScenario.conversionRate, "Forecast scenario should include conversion rate.");
assert(baseScenario.recommendation, "Forecast scenario should include recommendation.");

const updated = await request(`/api/launch-reports/${generated.payload.report.id}/forecast-scenarios/${baseScenario.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    name: "Edited Base",
    units: 520,
    revenue: 25995,
    grossProfit: 16375,
    adBudget: 3200,
    conversionRate: "3.1%",
    trigger: "One stable hook and reliable Amazon conversion.",
    recommendation: "Scale carefully while monitoring reorder timing.",
    status: "approved"
  })
});
assert(updated.status === 200, "Forecast scenario update should succeed.");
assert(updated.payload.scenario.name === "Edited Base", "Updated forecast name should be returned.");
assert(updated.payload.scenario.units === 520, "Updated forecast units should be returned.");
assert(updated.payload.scenario.status === "approved", "Updated forecast status should be returned.");

const persistedScenario = updated.payload.report.sections
  .find((section) => section.type === "sales_forecast")
  .scenarios.find((scenario) => scenario.id === baseScenario.id);
assert(persistedScenario.name === "Edited Base", "Updated forecast should persist inside report.");
assert(persistedScenario.revenue === 25995, "Updated forecast revenue should persist.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-forecast-scenario"), "Frontend should expose forecast copy action.");
assert(appText.includes("data-save-forecast-scenario"), "Frontend should expose forecast save action.");
assert(cssText.includes("forecast-grid"), "Frontend should style forecast grid.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "three forecast scenarios",
        "monthly breakdown and assumptions",
        "risk levers",
        "forecast scenario edit endpoint",
        "copy and save forecast UI surface"
      ],
      user: email,
      report: generated.payload.report.id,
      scenario: baseScenario.id
    },
    null,
    2
  )
);
