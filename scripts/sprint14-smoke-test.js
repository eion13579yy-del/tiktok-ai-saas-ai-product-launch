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
const email = `sprint14-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Fourteen Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 14 Inventory Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const created = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Foldable travel kettle",
    category: "Travel kitchen",
    targetMarket: "United States",
    platforms: ["TikTok", "Amazon"],
    targetPrice: "39.99",
    costPrice: "14.25",
    inventory: "480",
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

const inventory = generated.payload.report.sections.find((section) => section.type === "inventory_suggestion");
assert(inventory, "Report should include inventory suggestion module.");
assert(inventory.confidence === "high", "Inventory suggestion should be high confidence.");
assert(Array.isArray(inventory.actions) && inventory.actions.length === 3, "Inventory suggestion should include three actions.");
assert(Array.isArray(inventory.controls) && inventory.controls.length >= 3, "Inventory suggestion should include controls.");
assert(Array.isArray(inventory.stockoutRisks) && inventory.stockoutRisks.length >= 3, "Inventory suggestion should include stockout risks.");

const reorderAction = inventory.actions.find((action) => action.id === "inventory-02");
assert(reorderAction, "Reorder watch action should exist.");
assert(reorderAction.quantity > 0, "Inventory action should include quantity.");
assert(reorderAction.timing, "Inventory action should include timing.");
assert(reorderAction.trigger, "Inventory action should include trigger.");
assert(reorderAction.rationale, "Inventory action should include rationale.");

const updated = await request(`/api/launch-reports/${generated.payload.report.id}/inventory-actions/${reorderAction.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    name: "Edited Reorder Watch",
    quantity: 260,
    timing: "When sellable stock reaches 260 units",
    trigger: "Base case beats plan for one full week.",
    rationale: "Confirm supplier capacity before creator content scales.",
    status: "approved"
  })
});
assert(updated.status === 200, "Inventory action update should succeed.");
assert(updated.payload.action.name === "Edited Reorder Watch", "Updated inventory action name should be returned.");
assert(updated.payload.action.quantity === 260, "Updated inventory action quantity should be returned.");
assert(updated.payload.action.status === "approved", "Updated inventory action status should be returned.");

const persistedAction = updated.payload.report.sections
  .find((section) => section.type === "inventory_suggestion")
  .actions.find((action) => action.id === reorderAction.id);
assert(persistedAction.name === "Edited Reorder Watch", "Updated inventory action should persist inside report.");
assert(persistedAction.quantity === 260, "Updated inventory quantity should persist.");

const version = await request("/api/version");
assert(version.status === 200, "Version endpoint should succeed.");
assert(["Sprint 14", "Sprint 15", "Sprint 16", "Sprint 17", "Sprint 18", "Sprint 19", "Sprint 20"].includes(version.payload.sprint), "Version endpoint should report Sprint 14 or later.");

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
const styles = await fetch(`${baseUrl}/styles.css`);
const cssText = await styles.text();
assert(appText.includes("data-copy-inventory-action"), "Frontend should expose inventory copy action.");
assert(appText.includes("data-save-inventory-action"), "Frontend should expose inventory save action.");
assert(cssText.includes("inventory-grid"), "Frontend should style inventory grid.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "three inventory actions",
        "inventory controls and stockout risks",
        "inventory action edit endpoint",
        "copy and save inventory UI surface",
        "Sprint 14 version marker"
      ],
      user: email,
      report: generated.payload.report.id,
      action: reorderAction.id
    },
    null,
    2
  )
);
