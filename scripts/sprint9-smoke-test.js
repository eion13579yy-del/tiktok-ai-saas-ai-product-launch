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
const email = `sprint9-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Nine Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 9 Live Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Countertop ice maker",
    category: "Kitchen appliances",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon", "Walmart"],
    targetPrice: "89.99",
    costPrice: "42.00",
    inventory: "350",
    leadTimeDays: "24"
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

const liveScripts = generated.payload.report.sections.find((section) => section.type === "live_scripts");
assert(liveScripts, "Report should include live scripts module.");
assert(liveScripts.confidence === "high", "Live scripts should be high confidence.");
assert(Array.isArray(liveScripts.segments), "Live scripts module should expose segments.");
assert(liveScripts.segments.length === 8, "Live scripts module should generate eight live segments.");

const firstSegment = liveScripts.segments[0];
assert(firstSegment.id, "Live segment should include id.");
assert(firstSegment.stage, "Live segment should include stage.");
assert(firstSegment.minuteRange, "Live segment should include minute range.");
assert(firstSegment.objective, "Live segment should include objective.");
assert(firstSegment.hostLine, "Live segment should include host line.");
assert(firstSegment.demoAction, "Live segment should include demo action.");
assert(firstSegment.objectionAnswer, "Live segment should include objection answer.");
assert(firstSegment.offerCue, "Live segment should include offer cue.");

const updatedStage = "Edited Live Opening";
const updated = await request(`/api/launch-reports/${generated.payload.report.id}/live-segments/${firstSegment.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    stage: updatedStage,
    hostLine: "Welcome in. I am showing the full product test before you decide.",
    demoAction: "Show the product close-up and run the first demo.",
    objectionAnswer: "Watch the result first, then decide whether it fits your routine.",
    offerCue: "The product card is pinned while the demo is on screen.",
    status: "approved"
  })
});
assert(updated.status === 200, "Live segment update should succeed.");
assert(updated.payload.segment.stage === updatedStage, "Updated segment stage should be returned.");
assert(updated.payload.segment.status === "approved", "Updated segment status should be returned.");

const persistedSegment = updated.payload.report.sections
  .find((section) => section.type === "live_scripts")
  .segments.find((segment) => segment.id === firstSegment.id);
assert(persistedSegment.stage === updatedStage, "Updated live segment should persist inside report.");
assert(persistedSegment.hostLine.includes("full product test"), "Updated host line should persist.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-live-segment"), "Frontend should expose live copy action.");
assert(appText.includes("data-save-live-segment"), "Frontend should expose live save action.");
assert(cssText.includes("live-grid"), "Frontend should style live grid.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "eight generated live segments",
        "live segment structure with host line, demo, objection, offer cue",
        "live segment edit endpoint",
        "persisted live segment edits",
        "copy and save live UI surface"
      ],
      user: email,
      report: generated.payload.report.id,
      segment: firstSegment.id
    },
    null,
    2
  )
);
