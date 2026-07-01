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
const email = `sprint2-smoke-${unique}@example.com`;

const blockedProjects = await request("/api/product-projects");
assert(blockedProjects.status === 401, "Unauthenticated project list should return 401.");

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Two Tester",
    email,
    password: "launchOS123",
    workspaceName: "Sprint 2 Dashboard Team"
  })
});
assert(registered.status === 201, "Registration should succeed.");

const projects = await request("/api/product-projects");
assert(projects.status === 200, "Authenticated project list should return 200.");
assert(Array.isArray(projects.payload.projects), "Projects response should include a projects array.");
assert(projects.payload.projects.length === 0, "New workspace should start with an empty project list.");
assert(projects.payload.summary.total === 0, "Project summary total should be 0.");

const page = await fetch(`${baseUrl}/`);
const html = await page.text();
assert(page.status === 200, "App shell should load.");
assert(html.includes("总览"), "App shell should include the dashboard surface.");
assert(html.includes("产品项目列表"), "App shell should include the product project list surface.");
assert(html.includes("新建产品"), "App shell should include the new project entry.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "project list auth guard",
        "dashboard shell",
        "empty project list",
        "project summary",
        "new project entry"
      ],
      user: email,
      workspace: registered.payload.workspace.name
    },
    null,
    2
  )
);
