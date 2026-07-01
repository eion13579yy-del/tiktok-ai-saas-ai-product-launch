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

const expectedSections = [
  "market_analysis",
  "creator_analysis",
  "customer_persona",
  "video_scripts",
  "live_scripts",
  "review_insights",
  "compliance_risk",
  "ninety_day_plan",
  "sales_forecast",
  "inventory_suggestion"
];

const unique = Date.now();
const email = `sprint5-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Five Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 5 Report Team"
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
assert(generated.status === 201, "Launch report generation should succeed.");

const sectionTypes = generated.payload.report.sections.map((section) => section.type);
assert(sectionTypes.length >= 11, "Report should include the core modules plus product fingerprint.");
assert(sectionTypes.includes("product_fingerprint"), "Report should include product fingerprint module.");
for (const type of expectedSections) {
  assert(sectionTypes.includes(type), `Report should include ${type}.`);
}

const detail = await request(`/api/launch-reports/${generated.payload.report.id}`);
assert(detail.status === 200, "Report detail should be readable.");
assert(detail.payload.report.sections.every((section) => Array.isArray(section.bullets)), "Each module should expose structured bullets.");

const page = await fetch(`${baseUrl}/`);
const html = await page.text();
assert(html.includes("report-module-nav"), "App shell should include report module navigation.");
assert(html.includes("report-workspace"), "App shell should include report workspace layout.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "core report modules plus product fingerprint",
        "module type coverage",
        "structured module bullets",
        "report module navigation surface",
        "report workspace layout"
      ],
      user: email,
      report: generated.payload.report.id
    },
    null,
    2
  )
);
