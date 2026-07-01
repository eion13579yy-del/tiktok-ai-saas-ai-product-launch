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
const email = `sprint8-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Eight Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 8 Video Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Magnetic phone tripod",
    category: "Mobile accessories",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon"],
    targetPrice: "34.99",
    costPrice: "11.20",
    inventory: "800",
    leadTimeDays: "18"
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

const videoScripts = generated.payload.report.sections.find((section) => section.type === "video_scripts");
assert(videoScripts, "Report should include video scripts module.");
assert(Array.isArray(videoScripts.scripts), "Video scripts module should expose script list.");
assert(videoScripts.scripts.length === 10, "Video scripts module should generate ten scripts.");

const firstScript = videoScripts.scripts[0];
assert(firstScript.id, "Script should include id.");
assert(firstScript.scriptType, "Script should include type.");
assert(firstScript.hook, "Script should include hook.");
assert(Array.isArray(firstScript.storyboard) && firstScript.storyboard.length >= 5, "Script should include storyboard.");
assert(firstScript.voiceover, "Script should include voiceover.");
assert(firstScript.captions, "Script should include captions.");
assert(firstScript.cta, "Script should include CTA.");

const updatedTitle = "Edited 15-second TikTok opener";
const updated = await request(`/api/launch-reports/${generated.payload.report.id}/video-scripts/${firstScript.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    title: updatedTitle,
    hook: "Stop filming shaky product demos.",
    cta: "Save this setup before your next shoot.",
    status: "approved",
    storyboard: [
      { time: "0-2s", action: "Show shaky desk footage" },
      { time: "2-5s", action: "Snap phone onto the tripod" },
      { time: "5-9s", action: "Reveal stable overhead shot" }
    ]
  })
});
assert(updated.status === 200, "Script update should succeed.");
assert(updated.payload.script.title === updatedTitle, "Updated script title should be returned.");
assert(updated.payload.script.status === "approved", "Updated script status should be returned.");

const persistedScript = updated.payload.report.sections
  .find((section) => section.type === "video_scripts")
  .scripts.find((script) => script.id === firstScript.id);
assert(persistedScript.title === updatedTitle, "Updated script should persist inside report.");
assert(persistedScript.storyboard.length === 3, "Updated storyboard should persist.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-script"), "Frontend should expose copy action.");
assert(appText.includes("data-save-script"), "Frontend should expose save action.");
assert(cssText.includes("script-grid"), "Frontend should style script grid.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "ten generated short video scripts",
        "script structure with hook, storyboard, voiceover, captions, CTA",
        "video script edit endpoint",
        "persisted script edits",
        "copy and save UI surface"
      ],
      user: email,
      report: generated.payload.report.id,
      script: firstScript.id
    },
    null,
    2
  )
);
