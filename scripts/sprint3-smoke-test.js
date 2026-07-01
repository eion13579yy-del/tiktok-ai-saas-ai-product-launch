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
const email = `sprint3-smoke-${unique}@example.com`;

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Three Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 3 Product Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const invalidMissingName = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    platforms: ["TikTok"]
  })
});
assert(invalidMissingName.status === 400, "Project creation should require product name.");

const invalidMissingPlatform = await request("/api/product-projects", {
  method: "POST",
  body: JSON.stringify({
    productName: "Portable blender",
    platforms: []
  })
});
assert(invalidMissingPlatform.status === 400, "Project creation should require at least one platform.");

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
assert(created.payload.project.productName === "Portable blender", "Created project name should match.");
assert(created.payload.project.status === "draft", "Created project should start as draft.");
assert(created.payload.project.platforms.length === 2, "Created project should preserve selected platforms.");

const detail = await request(`/api/product-projects/${created.payload.project.id}`);
assert(detail.status === 200, "Project detail should be readable.");
assert(detail.payload.project.inventory === 500, "Project detail should include inventory.");
assert(detail.payload.project.leadTimeDays === 21, "Project detail should include lead time.");

const list = await request("/api/product-projects");
assert(list.status === 200, "Project list should be readable.");
assert(list.payload.summary.total === 1, "Project summary should count the created project.");
assert(list.payload.summary.draft === 1, "Project summary should count the draft project.");
assert(list.payload.projects.some((project) => project.id === created.payload.project.id), "Project list should include created project.");

const page = await fetch(`${baseUrl}/`);
const html = await page.text();
assert(html.includes("创建产品项目"), "App shell should include create project form.");
assert(html.includes("销售平台"), "App shell should include platform selection.");
assert(html.includes("项目详情"), "App shell should include project detail surface.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "project validation",
        "project creation",
        "project detail",
        "project list refresh data",
        "create project UI surface"
      ],
      user: email,
      project: created.payload.project.productName
    },
    null,
    2
  )
);
