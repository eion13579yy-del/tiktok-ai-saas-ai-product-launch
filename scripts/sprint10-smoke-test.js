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
const email = `sprint10-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Ten Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 10 Review Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Reusable pet hair remover",
    category: "Home cleaning",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon"],
    targetPrice: "24.99",
    costPrice: "6.50",
    inventory: "900",
    leadTimeDays: "16"
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

const reviewInsights = generated.payload.report.sections.find((section) => section.type === "review_insights");
assert(reviewInsights, "Report should include review insights module.");
assert(reviewInsights.confidence === "high", "Review insights should be high confidence.");
assert(Array.isArray(reviewInsights.themes) && reviewInsights.themes.length >= 4, "Review insights should include comment themes.");
assert(Array.isArray(reviewInsights.objections) && reviewInsights.objections.length >= 3, "Review insights should include buyer objections.");
assert(Array.isArray(reviewInsights.contentAngles) && reviewInsights.contentAngles.length >= 4, "Review insights should include content angles.");
assert(Array.isArray(reviewInsights.faqs) && reviewInsights.faqs.length >= 3, "Review insights should include FAQs.");
assert(Array.isArray(reviewInsights.replies) && reviewInsights.replies.length >= 4, "Review insights should include reply templates.");

const firstReply = reviewInsights.replies[0];
assert(firstReply.id, "Reply should include id.");
assert(firstReply.trigger, "Reply should include trigger.");
assert(firstReply.replyText, "Reply should include reply text.");
assert(firstReply.intent, "Reply should include intent.");

const updatedTrigger = "Edited price concern";
const updated = await request(`/api/launch-reports/${generated.payload.report.id}/review-replies/${firstReply.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    trigger: updatedTrigger,
    replyText: "Fair question. I would compare the demo result with how often you would actually use it.",
    intent: "Reduce hesitation with practical value framing",
    status: "approved"
  })
});
assert(updated.status === 200, "Review reply update should succeed.");
assert(updated.payload.reply.trigger === updatedTrigger, "Updated reply trigger should be returned.");
assert(updated.payload.reply.status === "approved", "Updated reply status should be returned.");

const persistedReply = updated.payload.report.sections
  .find((section) => section.type === "review_insights")
  .replies.find((reply) => reply.id === firstReply.id);
assert(persistedReply.trigger === updatedTrigger, "Updated reply should persist inside report.");
assert(persistedReply.intent.includes("practical value"), "Updated reply intent should persist.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-review-reply"), "Frontend should expose review reply copy action.");
assert(appText.includes("data-save-review-reply"), "Frontend should expose review reply save action.");
assert(cssText.includes("review-grid"), "Frontend should style review insights grid.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "comment theme analysis",
        "buyer objections and evidence needs",
        "content angles and FAQs",
        "review reply edit endpoint",
        "copy and save review UI surface"
      ],
      user: email,
      report: generated.payload.report.id,
      reply: firstReply.id
    },
    null,
    2
  )
);
