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
const email = `sprint12-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Twelve Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 12 Launch Plan Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Foldable walking pad",
    category: "Home fitness",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon", "Walmart"],
    targetPrice: "229.99",
    costPrice: "112.00",
    inventory: "240",
    leadTimeDays: "35"
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

const plan = generated.payload.report.sections.find((section) => section.type === "ninety_day_plan");
assert(plan, "Report should include 90-day plan module.");
assert(plan.confidence === "high", "90-day plan should be high confidence.");
assert(Array.isArray(plan.phases) && plan.phases.length === 4, "90-day plan should include four phases.");
assert(Array.isArray(plan.milestones) && plan.milestones.length >= 5, "90-day plan should include milestones.");
assert(Array.isArray(plan.weeklyCadence) && plan.weeklyCadence.length >= 4, "90-day plan should include weekly cadence.");

const firstPhase = plan.phases[0];
assert(firstPhase.id, "Plan phase should include id.");
assert(firstPhase.dayRange, "Plan phase should include day range.");
assert(firstPhase.name, "Plan phase should include name.");
assert(firstPhase.objective, "Plan phase should include objective.");
assert(firstPhase.keyMetric, "Plan phase should include key metric.");
assert(firstPhase.budgetFocus, "Plan phase should include budget focus.");
assert(firstPhase.owner, "Plan phase should include owner.");
assert(Array.isArray(firstPhase.tasks) && firstPhase.tasks.length >= 3, "Plan phase should include tasks.");

const updatedName = "Edited Demand Validation";
const updated = await request(`/api/launch-reports/${generated.payload.report.id}/plan-phases/${firstPhase.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    name: updatedName,
    dayRange: "Day 1-14",
    objective: "Validate buyer intent before scaling spend.",
    keyMetric: "Qualified clicks and add-to-cart rate",
    budgetFocus: "Low-cost creative testing",
    owner: "Launch PM",
    status: "active",
    tasks: [
      "Publish five hook tests.",
      "Review comment quality.",
      "Choose two angles for creator briefs."
    ]
  })
});
assert(updated.status === 200, "Plan phase update should succeed.");
assert(updated.payload.phase.name === updatedName, "Updated phase name should be returned.");
assert(updated.payload.phase.status === "active", "Updated phase status should be returned.");

const persistedPhase = updated.payload.report.sections
  .find((section) => section.type === "ninety_day_plan")
  .phases.find((phase) => phase.id === firstPhase.id);
assert(persistedPhase.name === updatedName, "Updated phase should persist inside report.");
assert(persistedPhase.tasks.length === 3, "Updated phase tasks should persist.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-plan-phase"), "Frontend should expose plan phase copy action.");
assert(appText.includes("data-save-plan-phase"), "Frontend should expose plan phase save action.");
assert(cssText.includes("plan-timeline"), "Frontend should style plan timeline.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "four 90-day launch phases",
        "milestones and weekly cadence",
        "plan phase edit endpoint",
        "persisted phase tasks",
        "copy and save plan UI surface"
      ],
      user: email,
      report: generated.payload.report.id,
      phase: firstPhase.id
    },
    null,
    2
  )
);
