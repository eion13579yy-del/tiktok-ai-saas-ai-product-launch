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
const email = `sprint1-smoke-${unique}@example.com`;
const password = "launchOS123";

const blocked = await request("/api/auth/me");
assert(blocked.status === 401, "Unauthenticated /api/auth/me should return 401.");

const blockedApp = await request("/app");
assert(blockedApp.status === 302, "Unauthenticated /app should redirect to the auth entry.");

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint Smoke Tester",
    email,
    password,
    workspaceName: "Smoke Test Workspace"
  })
});
assert(registered.status === 201, "Registration should succeed.");
assert(registered.payload.user.email === email, "Registered user email should match.");
assert(registered.payload.workspace.name === "Smoke Test Workspace", "Default workspace should be created.");
assert(registered.payload.workspace.role === "owner", "Registered user should own the workspace.");

const me = await request("/api/auth/me");
assert(me.status === 200, "Logged-in /api/auth/me should return 200.");
assert(me.payload.user.email === email, "Current user should match registered user.");
assert(me.payload.workspace.id === registered.payload.workspace.id, "Current workspace should match registered workspace.");

const logout = await request("/api/auth/logout", {
  method: "POST",
  body: "{}"
});
assert(logout.status === 200, "Logout should succeed.");

const afterLogout = await request("/api/auth/me");
assert(afterLogout.status === 401, "Logged-out /api/auth/me should return 401.");

cookie = "";
const login = await request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({
    email,
    password
  })
});
assert(login.status === 200, "Login should succeed.");
assert(login.payload.workspace.name === "Smoke Test Workspace", "Login should restore the workspace.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "unauthenticated guard",
        "app route guard",
        "registration",
        "default workspace",
        "current user session",
        "logout",
        "login"
      ],
      user: email,
      workspace: login.payload.workspace.name
    },
    null,
    2
  )
);
