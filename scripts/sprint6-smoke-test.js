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
const email = `sprint6-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Six Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 6 AI Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Portable blender",
    category: "Kitchen appliances",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon", "Walmart"],
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
assert(generated.status === 201, "AI report generation should succeed.");
assert(generated.payload.report.generationSource === "local_ai_fallback", "Local AI fallback should be used for this smoke test.");
assert(generated.payload.report.model === "local-structured-v1", "Report should include generator model metadata.");
assert(generated.payload.report.sections.length >= 11, "AI report should include structured sections plus product fingerprint.");
assert(
  generated.payload.report.sections.some((section) => section.type === "product_fingerprint"),
  "AI report should include product fingerprint."
);
assert(generated.payload.report.sections.every((section) => section.confidence), "Every section should include confidence.");
assert(generated.payload.report.summary.includes("Portable blender"), "AI report summary should reference the product.");
assert(generated.payload.report.recommendation.includes("TikTok"), "AI recommendation should be platform-aware.");

const detail = await request(`/api/launch-reports/${generated.payload.report.id}`);
assert(detail.status === 200, "Report detail should be readable.");
assert(detail.payload.report.generationSource === "local_ai_fallback", "Report detail should persist generation source.");
assert(detail.payload.report.model === "local-structured-v1", "Report detail should persist model metadata.");

const page = await fetch(`${baseUrl}/`);
const html = await page.text();
assert(html.includes("generationSource") || html.includes("report-summary"), "App shell should include AI report metadata surface.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "AI service generation mode",
        "generator metadata",
        "structured AI sections plus product fingerprint",
        "section confidence",
        "report metadata persistence"
      ],
      user: email,
      report: generated.payload.report.id
    },
    null,
    2
  )
);
