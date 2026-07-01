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
  return { status: response.status, payload, response };
}

const email = `sprint19-${randomUUID()}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint 19 Tester",
    email,
    password: "Sprint19Pass!",
    workspaceName: "Differentiation Engine Team"
  })
});
assert(registered.status === 201, "Register should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Portable espresso maker",
    category: "Kitchen coffee appliance",
    targetMarket: "美国",
    platforms: ["TikTok", "Amazon"],
    competitorLinks: "https://www.amazon.com/example-espresso\nhttps://www.tiktok.com/@demo/video/123",
    targetPrice: 59.99,
    costPrice: 18.5,
    inventory: 260,
    leadTimeDays: 24
  })
});
assert(created.status === 201, "Project creation should succeed.");
assert(created.payload.project.competitorLinks.length === 2, "Project should store competitor links.");

const generated = await request(`/api/product-projects/${created.payload.project.id}/launch-report/generate`, {
  method: "POST",
  body: JSON.stringify({
    generationMode: "local"
  })
});
assert(generated.status === 201, "Report generation should succeed.");

const report = generated.payload.report;
const differentiation = report.sections.find((section) => section.type === "differentiation_analysis");
assert(report.productProfile, "Report should include top-level Product Profile.");
assert(differentiation, "Report should include differentiation analysis module.");
assert(differentiation.productProfile, "Differentiation module should include Product Profile.");
assert(Array.isArray(differentiation.scores) && differentiation.scores.length === 7, "Differentiation module should include seven scores.");

const requiredScores = [
  "市场需求分",
  "内容传播分",
  "利润空间分",
  "物流风险分",
  "售后风险分",
  "TikTok爆发潜力分",
  "Amazon承接潜力分"
];
for (const label of requiredScores) {
  assert(differentiation.scores.some((score) => score.label === label), `Score model should include ${label}.`);
}

const conclusion = differentiation.finalConclusion;
assert(conclusion.worthTesting, "Final conclusion should include testing decision.");
assert(conclusion.firstBatchInventory, "Final conclusion should include first batch inventory.");
assert(conclusion.testingCycle, "Final conclusion should include testing cycle.");
assert(conclusion.creatorStrategy, "Final conclusion should include creator strategy.");
assert(conclusion.shortVideoDirection, "Final conclusion should include short video direction.");
assert(conclusion.liveDirection, "Final conclusion should include live direction.");
assert(conclusion.biggestRisk, "Final conclusion should include biggest risk.");

const pdf = await fetch(`${baseUrl}/api/launch-reports/${report.id}/pdf`, {
  headers: {
    Cookie: cookie
  }
});
const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
assert(pdf.status === 200, "PDF download should succeed.");
assert(pdf.headers.get("content-type") === "application/pdf", "PDF endpoint should return application/pdf.");
assert(pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50 && pdfBytes[2] === 0x44 && pdfBytes[3] === 0x46, "PDF should start with %PDF.");

const version = await request("/api/version");
assert(["Sprint 19", "Sprint 20"].includes(version.payload.sprint), "Version endpoint should report Sprint 19 or later.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
assert(appText.includes("下载PDF"), "Frontend should include PDF download action.");
assert(appText.includes("产品差异化分析"), "Frontend should include differentiation module label.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "competitor links input",
        "Product Profile",
        "differentiation analysis engine",
        "seven-score model",
        "final conclusion",
        "PDF download"
      ],
      report: report.id
    },
    null,
    2
  )
);
