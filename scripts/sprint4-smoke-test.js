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
const email = `sprint4-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Four Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 4 Report Team"
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
assert(generated.payload.report.status === "completed", "Mock report should complete.");
assert(generated.payload.report.sections.length >= 3, "Mock report should include basic sections.");
assert(generated.payload.project.latestReportId === generated.payload.report.id, "Project should reference latest report.");

const status = await request(`/api/launch-reports/${generated.payload.report.id}/status`);
assert(status.status === 200, "Report status should be readable.");
assert(status.payload.status === "completed", "Report status endpoint should return completed.");
assert(status.payload.progress === 100, "Completed report progress should be 100.");

const detail = await request(`/api/launch-reports/${generated.payload.report.id}`);
assert(detail.status === 200, "Report detail should be readable.");
assert(detail.payload.report.summary.includes("Portable blender"), "Report summary should reference the product.");

const list = await request("/api/product-projects");
assert(list.status === 200, "Project list should be readable.");
assert(list.payload.summary.completed === 1, "Project summary should count completed report projects.");
assert(list.payload.projects[0].latestReportStatus === "completed", "Project list should expose latest report status.");

const page = await fetch(`${baseUrl}/`);
const html = await page.text();
assert(html.includes("生成报告"), "App shell should include report generation action.");
assert(html.includes("打品报告"), "App shell should include report detail surface.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "mock report generation",
        "report status endpoint",
        "report detail endpoint",
        "project report state sync",
        "report UI surface"
      ],
      user: email,
      report: generated.payload.report.id
    },
    null,
    2
  )
);
