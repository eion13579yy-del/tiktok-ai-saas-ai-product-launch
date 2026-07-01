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
const email = `sprint11-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Eleven Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 11 Compliance Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "LED baby night light",
    category: "Baby sleep accessories",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon", "Walmart"],
    targetPrice: "32.99",
    costPrice: "9.75",
    inventory: "600",
    leadTimeDays: "20"
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

const compliance = generated.payload.report.sections.find((section) => section.type === "compliance_risk");
assert(compliance, "Report should include compliance risk module.");
assert(compliance.confidence === "high", "Compliance risk should be high confidence.");
assert(compliance.overallRisk === "medium", "Sensitive category should produce medium risk.");
assert(Array.isArray(compliance.checks) && compliance.checks.length >= 5, "Compliance risk should include checks.");
assert(Array.isArray(compliance.claimRules) && compliance.claimRules.length >= 3, "Compliance risk should include claim rules.");
assert(Array.isArray(compliance.platformNotes) && compliance.platformNotes.length === 3, "Compliance risk should include platform notes.");
assert(Array.isArray(compliance.blockedPhrases) && compliance.blockedPhrases.length >= 5, "Compliance risk should include blocked phrases.");

const firstCheck = compliance.checks[0];
assert(firstCheck.id, "Compliance check should include id.");
assert(firstCheck.area, "Compliance check should include area.");
assert(firstCheck.requirement, "Compliance check should include requirement.");
assert(firstCheck.action, "Compliance check should include action.");
assert(firstCheck.owner, "Compliance check should include owner.");
assert(firstCheck.status, "Compliance check should include status.");

const updatedArea = "Edited Product Claims";
const updated = await request(`/api/launch-reports/${generated.payload.report.id}/compliance-checks/${firstCheck.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    area: updatedArea,
    risk: "high",
    requirement: "All baby-related claims must be reviewed before publishing.",
    action: "Remove sleep, safety, and health promises unless approved by legal review.",
    owner: "Compliance owner",
    status: "in_review"
  })
});
assert(updated.status === 200, "Compliance check update should succeed.");
assert(updated.payload.check.area === updatedArea, "Updated compliance area should be returned.");
assert(updated.payload.check.status === "in_review", "Updated compliance status should be returned.");

const persistedCheck = updated.payload.report.sections
  .find((section) => section.type === "compliance_risk")
  .checks.find((check) => check.id === firstCheck.id);
assert(persistedCheck.area === updatedArea, "Updated compliance check should persist inside report.");
assert(persistedCheck.owner === "Compliance owner", "Updated compliance owner should persist.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-compliance-check"), "Frontend should expose compliance copy action.");
assert(appText.includes("data-save-compliance-check"), "Frontend should expose compliance save action.");
assert(cssText.includes("compliance-grid"), "Frontend should style compliance grid.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "overall compliance risk",
        "claim rules and platform notes",
        "blocked phrase list",
        "compliance check edit endpoint",
        "copy and save compliance UI surface"
      ],
      user: email,
      report: generated.payload.report.id,
      check: firstCheck.id
    },
    null,
    2
  )
);
