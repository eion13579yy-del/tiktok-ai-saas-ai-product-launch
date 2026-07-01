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

const email = `sprint16-${randomUUID()}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint 16 Model Tester",
    email,
    password: "Sprint16Pass!",
    workspaceName: "智能评估模型工作台"
  })
});

assert(registered.status === 201, "Register should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "便携式冷萃咖啡杯",
    category: "Kitchen",
    targetMarket: "美国",
    platforms: ["TikTok", "Amazon", "Walmart"],
    targetPrice: 39.99,
    costPrice: 12.5,
    inventory: 500,
    leadTimeDays: 21
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

const report = generated.payload.report;
assert(Number.isInteger(report.dataCredibilityScore), "Report should include a data credibility score.");
assert(report.dataCredibilityScore >= 0 && report.dataCredibilityScore <= 100, "Data credibility score should be 0-100.");

assert(report.dataSourceBreakdown, "Report should include data source breakdown.");
assert(Array.isArray(report.dataSourceBreakdown.verifiedData) && report.dataSourceBreakdown.verifiedData.length > 0, "Report should include verified data.");
assert(Array.isArray(report.dataSourceBreakdown.aiInferredData) && report.dataSourceBreakdown.aiInferredData.length > 0, "Report should include AI inferred data.");
assert(Array.isArray(report.dataSourceBreakdown.humanAssumptions) && report.dataSourceBreakdown.humanAssumptions.length > 0, "Report should include human assumptions.");

const model = report.productEvaluationModel;
assert(model, "Report should include product evaluation model.");
assert(Number.isInteger(model.totalScore) && model.totalScore >= 0 && model.totalScore <= 100, "Product evaluation score should be 0-100.");
assert(["可测品", "谨慎测品", "不建议进入"].includes(model.conclusion), "Conclusion should use the required three-state model.");

const requiredDimensions = [
  "market_demand",
  "content_virality",
  "price_margin",
  "competitor_validation",
  "logistics_after_sales",
  "compliance_risk"
];
const dimensionKeys = model.dimensions.map((dimension) => dimension.key);
for (const key of requiredDimensions) {
  assert(dimensionKeys.includes(key), `Evaluation model should include ${key}.`);
}

for (const dimension of model.dimensions) {
  assert(Number.isInteger(dimension.score) && dimension.score >= 0 && dimension.score <= 100, "Each dimension should include a 0-100 score.");
  assert(["已验证数据", "AI推测数据", "人工假设数据"].includes(dimension.dataType), "Each dimension should identify its data type.");
  assert(dimension.reason && dimension.validationNeeded, "Each dimension should include reason and validation action.");
}

const requiredRoles = ["选品经理", "财务经理", "达人运营", "风控经理", "供应链经理"];
const roleNames = report.roleReviews.map((review) => review.role);
for (const role of requiredRoles) {
  const review = report.roleReviews.find((item) => item.role === role);
  assert(roleNames.includes(role), `Role review should include ${role}.`);
  assert(review.supportReasons.length > 0, `${role} should include support reasons.`);
  assert(review.objectionReasons.length > 0, `${role} should include objection reasons.`);
}

assert(Array.isArray(report.validationChecklist) && report.validationChecklist.length >= 5, "Report should include validation checklist.");
assert(report.validationChecklist.some((item) => item.blocksScaling === true), "Validation checklist should identify blockers before scaling.");
assert(report.factSafetyRule.includes("禁止写成确定事实"), "Fact safety rule should forbid presenting unverified data as facts.");

const version = await request("/api/version");
assert(version.status === 200, "Version endpoint should succeed.");
assert(["Sprint 16", "Sprint 17", "Sprint 18", "Sprint 19", "Sprint 20"].includes(version.payload.sprint), "Version endpoint should report Sprint 16 or later.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("产品智能评估模型层"), "Frontend should render the intelligent evaluation layer.");
assert(appText.includes("待验证数据清单"), "Frontend should render the validation checklist.");
assert(cssText.includes("evaluation-layer"), "Frontend should style the evaluation layer.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "data source classification",
        "0-100 data credibility score",
        "six-dimension product evaluation model",
        "multi-role AI review",
        "three-state launch conclusion",
        "unverified data safety rule",
        "validation checklist",
        "evaluation layer UI"
      ],
      user: email,
      report: report.id,
      conclusion: model.conclusion,
      score: model.totalScore
    },
    null,
    2
  )
);
