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

const email = `sprint15-${randomUUID()}@example.com`;
const password = "Sprint15Pass!";

const registered = await request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Sprint 15 中文团队",
    email,
    password,
    workspaceName: "中文版打品工作台"
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

assert(generated.status === 201, "Chinese launch report generation should succeed.");
assert(generated.payload.report.summary.includes("结构化打品"), "Report summary should be in Chinese.");
assert(generated.payload.report.recommendation.includes("15天验证"), "Report recommendation should be in Chinese.");

const sections = generated.payload.report.sections;
assert(Array.isArray(sections) && sections.length >= 11, "Report should include all core modules plus product fingerprint.");
assert(sections.some((section) => section.type === "product_fingerprint"), "Report should include product fingerprint.");

const sectionTitles = sections.map((section) => section.title);
for (const title of ["市场分析", "达人分析", "用户画像", "短视频脚本", "直播话术", "评论分析", "风险合规", "90天打品计划", "销量预测", "备货建议"]) {
  assert(sectionTitles.includes(title), `Report should include ${title}.`);
}

const videoScripts = sections.find((section) => section.type === "video_scripts");
assert(videoScripts.scripts.length === 10, "Chinese report should keep ten short video scripts.");
assert(videoScripts.scripts[0].hook.includes("日常使用场景") || videoScripts.scripts[0].title.includes("："), "Video scripts should be Chinese.");

const inventory = sections.find((section) => section.type === "inventory_suggestion");
assert(inventory.actions.some((action) => action.name === "补货观察"), "Inventory suggestion should include Chinese reorder action.");

const version = await request("/api/version");
assert(version.status === 200, "Version endpoint should succeed.");
assert(["Sprint 15", "Sprint 16", "Sprint 17", "Sprint 18", "Sprint 19", "Sprint 20"].includes(version.payload.sprint), "Version endpoint should report Sprint 15 or later.");

const page = await fetch(`${baseUrl}/`);
const html = await page.text();
assert(page.status === 200, "App shell should load.");
for (const text of ["总览", "创建产品项目", "打品报告"]) {
  assert(html.includes(text), `App shell should include Chinese text: ${text}.`);
}
assert(
  html.includes("中文版工作台已就绪") || html.includes("智能评估模型层已上线") || html.includes("产品指纹和真实模型配置已上线"),
  "App shell should include current sprint Chinese status."
);

const appJs = await fetch(`${baseUrl}/app.js`);
const appText = await appJs.text();
for (const text of ["生成中", "保存中", "重新生成中", "项目加载失败", "打品工作台"]) {
  assert(appText.includes(text), `Frontend runtime should include Chinese text: ${text}.`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "Sprint 15 version marker",
        "Chinese app shell",
        "Chinese runtime actions",
        "Chinese local report",
        "all core report modules plus product fingerprint preserved"
      ],
      user: email,
      report: generated.payload.report.id
    },
    null,
    2
  )
);
