import http from "node:http";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLaunchReportContent, generateReportSectionContent } from "./ai.js";
import { openAiConfigStatus } from "./env.js";
import { calculateFinancialModel } from "../src/domain/financial-engine.js";
import { buildDecisionDashboard } from "../src/domain/decision-engine.js";
import { runConsistencyChecks } from "../src/domain/consistency-check.js";
import { flattenProjectFromStructuredInput, normalizeStructuredInput } from "../src/domain/project-input.js";
import { buildOperatingPlan } from "../src/domain/operating-engine.js";
import { buildDocx, buildExportPayload, buildXlsx } from "../src/domain/export-engine.js";
import { buildVisualizationReport } from "../src/domain/visualization-report.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const dataFile = path.resolve(rootDir, process.env.DATA_FILE || "data/db.json");
const sessionCookieName = "aplo_session";
const deviceCookieName = "aplo_device";
let dbWriteQueue = Promise.resolve();

const emptyDb = {
  meta: {
    schemaVersion: 1
  },
  users: [],
  workspaces: [],
  workspaceMembers: [],
  sessions: [],
  productProjects: [],
  launchReports: []
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function escapePdfText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function buildSimplePdf(title, lines) {
  const objects = [];
  const pageWidth = 595;
  const pageHeight = 842;
  const safeLines = [title, "", ...lines].flatMap((line) => {
    const text = String(line ?? "");
    const chunks = [];
    for (let index = 0; index < text.length; index += 48) {
      chunks.push(text.slice(index, index + 48));
    }
    return chunks.length ? chunks : [""];
  });
  const pages = [];

  for (let index = 0; index < safeLines.length; index += 36) {
    pages.push(safeLines.slice(index, index + 36));
  }

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageEntries = [];

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  for (const pageLines of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    const textCommands = pageLines
      .map((line, lineIndex) => `BT /F1 11 Tf 50 ${pageHeight - 56 - lineIndex * 20} Td (${escapePdfText(line)}) Tj ET`)
      .join("\n");
    const content = Buffer.from(textCommands, "utf8");

    objects[pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${textCommands}\nendstream`;
    pageEntries.push(`${pageId} 0 R`);
  }

  objects[pagesId] = `<< /Type /Pages /Kids [${pageEntries.join(" ")}] /Count ${pageEntries.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function sendPdf(res, filename, buffer) {
  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store"
  });
  res.end(buffer);
}

function sendDownload(res, contentType, filename, buffer) {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store"
  });
  res.end(buffer);
}

function sendRedirect(res, location) {
  res.writeHead(302, {
    Location: location
  });
  res.end();
}

function sendNotFound(res) {
  sendJson(res, 404, {
    error: "Not Found",
    message: "The requested resource does not exist."
  });
}

function sendUnauthorized(res) {
  sendJson(res, 401, {
    error: "Unauthorized",
    message: "Please log in to continue."
  });
}

function sendValidationError(res, message) {
  sendJson(res, 400, {
    error: "Validation Error",
    message
  });
}

async function readDb() {
  await ensureDbFile();
  const raw = await readFile(dataFile, "utf8");
  const db = JSON.parse(raw);

  db.users ||= [];
  db.workspaces ||= [];
  db.workspaceMembers ||= [];
  db.sessions ||= [];
  db.productProjects ||= [];
  db.launchReports ||= [];

  return db;
}

async function ensureDbFile() {
  if (existsSync(dataFile)) {
    return;
  }

  await mkdir(path.dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(emptyDb, null, 2)}\n`, "utf8");
}

async function writeDb(db) {
  const payload = `${JSON.stringify(db, null, 2)}\n`;

  const writeOperation = dbWriteQueue.then(async () => {
    await mkdir(path.dirname(dataFile), { recursive: true });
    const tempFile = path.join(path.dirname(dataFile), `db.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
    await writeFile(tempFile, payload, "utf8");
    await rename(tempFile, dataFile);
  });

  dbWriteQueue = writeOperation.catch(() => {});
  await writeOperation;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function publicWorkspace(workspace, membership) {
  if (!workspace) {
    return null;
  }

  return {
    id: workspace.id,
    name: workspace.name,
    plan: workspace.plan,
    ownerId: workspace.ownerId,
    role: membership?.role || "owner",
    createdAt: workspace.createdAt
  };
}

function publicProductProject(project) {
  return {
    id: project.id,
    productName: project.productName,
    category: project.category || "Uncategorized",
    targetMarket: project.targetMarket || "缇庡浗",
    platforms: project.platforms || [],
    competitorLinks: project.competitorLinks || [],
    targetPrice: project.targetPrice ?? null,
    costPrice: project.costPrice ?? null,
    inventory: project.inventory ?? null,
    leadTimeDays: project.leadTimeDays ?? null,
    structuredInput: project.structuredInput || null,
    status: project.status || "draft",
    opportunityScore: project.opportunityScore ?? null,
    riskLevel: project.riskLevel || "unknown",
    latestReportId: project.latestReportId || null,
    latestReportStatus: project.latestReportStatus || "not_generated",
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function publicLaunchReport(report) {
  return {
    id: report.id,
    projectId: report.projectId,
    version: report.version,
    status: report.status,
    opportunityScore: report.opportunityScore,
    riskLevel: report.riskLevel,
    productProfile: report.productProfile || null,
    differentiationAnalysis: report.differentiationAnalysis || null,
    dataCredibilityScore: report.dataCredibilityScore ?? null,
    dataSourceBreakdown: report.dataSourceBreakdown || null,
    productEvaluationModel: report.productEvaluationModel || null,
    decisionDashboard: report.decisionDashboard || null,
    financialModel: report.financialModel || null,
    consistencyChecks: report.consistencyChecks || [],
    dataSourceMap: report.dataSourceMap || null,
    scenarioSimulation: report.scenarioSimulation || null,
    annualPlan: report.annualPlan || null,
    channelBreakdown: report.channelBreakdown || null,
    gateDecision: report.gateDecision || null,
    riskRegister: report.riskRegister || null,
    visualizationReport: report.visualizationReport || null,
    parameterSnapshot: report.parameterSnapshot || null,
    changeLog: report.changeLog || [],
    roleReviews: report.roleReviews || [],
    validationChecklist: report.validationChecklist || [],
    factSafetyRule: report.factSafetyRule || null,
    generationSource: report.generationSource || "unknown",
    model: report.model || null,
    aiError: report.aiError || null,
    summary: report.summary,
    recommendation: report.recommendation,
    sections: report.sections || [],
    generatedAt: report.generatedAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePlatforms(platforms) {
  const allowed = new Set(["TikTok", "Amazon", "Walmart", "DTC", "TikTok Shop"]);
  const values = Array.isArray(platforms) ? platforms : [];

  return [...new Set(values.map((platform) => String(platform).trim()).filter((platform) => allowed.has(platform)))];
}

function normalizeCompetitorLinks(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/\r?\n|,/)
      .map((item) => item.trim());

  return [...new Set(values.filter(Boolean))].slice(0, 10);
}

function buildMockLaunchReport(project, version) {
  const primaryPlatform = project.platforms?.[0] || "TikTok";
  const opportunityScore = Math.min(92, Math.max(62, 68 + (project.platforms?.length || 1) * 6));
  const riskLevel = project.category?.toLowerCase().includes("supplement") ? "medium" : "low";
  const product = project.productName;

  return {
    version,
    status: "completed",
    opportunityScore,
    riskLevel,
    summary: `${product} is ready for structured launch planning across ${project.platforms.join(", ")}. This Sprint 5 report proves the full ten-module report structure before real AI generation is added.`,
    recommendation: `Proceed with structured validation on ${primaryPlatform}. Use the ten modules below as the operating map for the first launch review.`,
    sections: [
      {
        type: "market_analysis",
        title: "Market Analysis",
        content: `Validate ${product} demand in ${project.targetMarket}, compare pricing bands, and identify where content-led discovery can outperform search-led competition.`,
        bullets: ["Demand strength: medium-high", `Primary market: ${project.targetMarket}`, `Primary platform: ${primaryPlatform}`]
      },
      {
        type: "creator_analysis",
        title: "Creator Analysis",
        content: `Start with micro and mid-tier creators who can demonstrate ${product} in practical situations and produce multiple testable hooks.`,
        bullets: ["Recommended creator type: demo-led UGC", "Initial creator count: 5-10", "Brief should focus on problem-solution proof"]
      },
      {
        type: "customer_persona",
        title: "Customer Persona",
        content: `Target buyers who want a simple, low-friction way to solve the main use case of ${product} without researching too many alternatives.`,
        bullets: ["Core buyer: convenience-driven shopper", "Purchase trigger: visible before/after benefit", "Main objection: trust and product quality"]
      },
      {
        type: "video_scripts",
        title: "Video Scripts",
        content: `Create short-form scripts around hooks, demonstrations, objections, and comparison angles for ${product}.`,
        bullets: ["Hook-first demo", "Before-after comparison", "UGC review angle"]
      },
      {
        type: "live_scripts",
        title: "Live Scripts",
        content: `Use live selling talk tracks that repeat the core problem, show the product in action, and handle price and quality objections.`,
        bullets: ["Opening: problem and offer", "Middle: demo and proof", "Close: urgency and FAQ"]
      },
      {
        type: "review_insights",
        title: "Review Insights",
        content: `Collect competitor reviews to extract positive purchase drivers, recurring complaints, FAQs, and language that buyers already use.`,
        bullets: ["Mine negative reviews for differentiation", "Turn FAQs into video hooks", "Track quality and shipping concerns"]
      },
      {
        type: "compliance_risk",
        title: "Compliance Risk",
        content: `Keep claims specific, demonstrable, and platform-safe. Avoid exaggerated guarantees or unsupported performance claims.`,
        bullets: [`Risk level: ${riskLevel}`, "Avoid guaranteed result language", "Escalate regulated categories for human review"]
      },
      {
        type: "ninety_day_plan",
        title: "90-Day Launch Plan",
        content: `Run a staged launch: validate hooks, test creators, scale content, then optimize inventory and paid amplification.`,
        bullets: ["Day 1-15: content validation", "Day 16-30: creator testing", "Day 31-90: scale and optimize"]
      },
      {
        type: "sales_forecast",
        title: "Sales Forecast",
        content: `Use conservative, base, and aggressive cases instead of a single forecast because TikTok-driven demand can move unevenly.`,
        bullets: ["Conservative: content tests only", "Base: creator traction", "Aggressive: repeatable winning hooks"]
      },
      {
        type: "inventory_suggestion",
        title: "Inventory Suggestion",
        content: `Align inventory exposure with validation speed, current stock, and supplier lead time before scaling creator spend.`,
        bullets: [`Current inventory: ${project.inventory ?? "not set"}`, `Lead time: ${project.leadTimeDays ?? "not set"} days`, "Hold safety stock before creator pushes"]
      }
    ]
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");

  if (!salt || !hash) {
    return false;
  }

  const hashedInput = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, "hex");

  return storedBuffer.length === hashedInput.length && timingSafeEqual(storedBuffer, hashedInput);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...value] = item.split("=");
        return [key, decodeURIComponent(value.join("="))];
      })
  );
}

function setSessionCookie(res, token) {
  appendCookie(res, `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`);
}

function setDeviceCookie(res, deviceId) {
  appendCookie(res, `${deviceCookieName}=${encodeURIComponent(deviceId)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=31536000`);
}

function clearSessionCookie(res) {
  appendCookie(res, `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function appendCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");

  if (!current) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }

  res.setHeader("Set-Cookie", Array.isArray(current) ? [...current, cookie] : [current, cookie]);
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > 1024 * 1024) {
      throw new Error("Request body is too large.");
    }

    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function getSessionContext(req) {
  const token = parseCookies(req)[sessionCookieName];

  if (!token) {
    return null;
  }

  const db = await readDb();
  const session = db.sessions.find((item) => item.token === token);

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const user = db.users.find((item) => item.id === session.userId);

  if (!user) {
    return null;
  }

  const membership = db.workspaceMembers.find((item) => item.userId === user.id && item.status === "active");
  const workspace = db.workspaces.find((item) => item.id === membership?.workspaceId);

  return {
    db,
    session,
    user,
    workspace,
    membership
  };
}

async function requireSession(req, res) {
  let context = await getSessionContext(req);

  if (!context) {
    context = await createGuestSessionContext(req, res);
  }

  return context;
}

async function createGuestSessionContext(req, res) {
  const db = await readDb();
  const timestamp = new Date().toISOString();
  const cookies = parseCookies(req);
  const rawDeviceId = String(cookies[deviceCookieName] || "").trim();
  const deviceId = /^[a-f0-9-]{36}$/i.test(rawDeviceId) ? rawDeviceId : randomUUID();
  const guestEmail = `guest-${deviceId}@ai-product-launch-os.local`;
  let user = db.users.find((item) => item.email === guestEmail);

  if (!user) {
    user = {
      id: randomUUID(),
      name: "AI Product Launch User",
      email: guestEmail,
      passwordHash: "",
      role: "seller",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.users.push(user);
  }

  let membership = db.workspaceMembers.find((item) => item.userId === user.id && item.status === "active");
  let workspace = db.workspaces.find((item) => item.id === membership?.workspaceId);

  if (!workspace) {
    workspace = createDefaultWorkspace(db, user, "AI Product Launch OS 工作台");
    membership = db.workspaceMembers.find((item) => item.workspaceId === workspace.id && item.userId === user.id);
  }

  const session = createSession(db, user);
  await writeDb(db);
  setDeviceCookie(res, deviceId);
  setSessionCookie(res, session.token);

  return {
    db,
    session,
    user,
    workspace,
    membership
  };
}

function createDefaultWorkspace(db, user, workspaceName) {
  const timestamp = new Date().toISOString();
  const workspace = {
    id: randomUUID(),
    name: workspaceName || `${user.name}'s Launch Workspace`,
    ownerId: user.id,
    plan: "free",
    reportQuota: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.workspaces.push(workspace);
  db.workspaceMembers.push({
    id: randomUUID(),
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
    status: "active",
    createdAt: timestamp
  });

  return workspace;
}

function createSession(db, user) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const session = {
    id: randomUUID(),
    token: randomBytes(32).toString("hex"),
    userId: user.id,
    createdAt: now.toISOString(),
    expiresAt
  };

  db.sessions.push(session);
  return session;
}

async function getDatabaseStatus() {
  await ensureDbFile();
  const exists = existsSync(dataFile);

  if (!exists) {
    return {
      ok: false,
      path: dataFile,
      message: "Data file is missing."
    };
  }

  try {
    const parsed = await readDb();

    return {
      ok: true,
      path: dataFile,
      schemaVersion: parsed.meta?.schemaVersion ?? null,
      collections: {
        users: parsed.users?.length ?? 0,
        workspaces: parsed.workspaces?.length ?? 0,
        workspaceMembers: parsed.workspaceMembers?.length ?? 0,
        sessions: parsed.sessions?.length ?? 0,
        productProjects: parsed.productProjects?.length ?? 0,
        launchReports: parsed.launchReports?.length ?? 0
      }
    };
  } catch (error) {
    return {
      ok: false,
      path: dataFile,
      message: error.message
    };
  }
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = requestedPath === "/" || requestedPath === "/app" ? "index.html" : requestedPath.replace(/^\/+/, "");
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendNotFound(res);
    return;
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    sendNotFound(res);
  }
}

async function handleRegister(req, res) {
  const body = await readRequestBody(req);
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const workspaceName = String(body.workspaceName || "").trim();

  if (!name) {
    sendValidationError(res, "Name is required.");
    return;
  }

  if (!email || !email.includes("@")) {
    sendValidationError(res, "A valid email is required.");
    return;
  }

  if (password.length < 8) {
    sendValidationError(res, "Password must be at least 8 characters.");
    return;
  }

  const db = await readDb();

  if (db.users.some((user) => user.email === email)) {
    sendValidationError(res, "This email is already registered.");
    return;
  }

  const timestamp = new Date().toISOString();
  const user = {
    id: randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password),
    role: "seller",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.users.push(user);
  const workspace = createDefaultWorkspace(db, user, workspaceName);
  const membership = db.workspaceMembers.find((item) => item.workspaceId === workspace.id && item.userId === user.id);
  const session = createSession(db, user);
  await writeDb(db);

  setSessionCookie(res, session.token);
  sendJson(res, 201, {
    user: publicUser(user),
    workspace: publicWorkspace(workspace, membership)
  });
}

async function handleLogin(req, res) {
  const body = await readRequestBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const db = await readDb();
  const user = db.users.find((item) => item.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    sendJson(res, 401, {
      error: "Invalid Credentials",
      message: "Email or password is incorrect."
    });
    return;
  }

  let membership = db.workspaceMembers.find((item) => item.userId === user.id && item.status === "active");
  let workspace = db.workspaces.find((item) => item.id === membership?.workspaceId);

  if (!workspace) {
    workspace = createDefaultWorkspace(db, user);
    membership = db.workspaceMembers.find((item) => item.workspaceId === workspace.id && item.userId === user.id);
  }

  const session = createSession(db, user);
  await writeDb(db);

  setSessionCookie(res, session.token);
  sendJson(res, 200, {
    user: publicUser(user),
    workspace: publicWorkspace(workspace, membership)
  });
}

async function handleLogout(req, res) {
  const token = parseCookies(req)[sessionCookieName];

  if (token) {
    const db = await readDb();
    db.sessions = db.sessions.filter((session) => session.token !== token);
    await writeDb(db);
  }

  clearSessionCookie(res);
  sendJson(res, 200, {
    ok: true
  });
}

async function handleMe(req, res) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  sendJson(res, 200, {
    user: publicUser(context.user),
    workspace: publicWorkspace(context.workspace, context.membership)
  });
}

async function handleCreateWorkspace(req, res) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const body = await readRequestBody(req);
  const name = String(body.name || "").trim();

  if (!name) {
    sendValidationError(res, "Workspace name is required.");
    return;
  }

  const workspace = createDefaultWorkspace(context.db, context.user, name);
  const membership = context.db.workspaceMembers.find(
    (item) => item.workspaceId === workspace.id && item.userId === context.user.id
  );

  await writeDb(context.db);

  sendJson(res, 201, {
    workspace: publicWorkspace(workspace, membership)
  });
}

async function handleCurrentWorkspace(req, res) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  sendJson(res, 200, {
    workspace: publicWorkspace(context.workspace, context.membership)
  });
}

async function handleListProductProjects(req, res) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const projects = context.db.productProjects
    .filter((project) => project.workspaceId === context.workspace?.id)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .map(publicProductProject);

  sendJson(res, 200, {
    projects,
    summary: {
      total: projects.length,
      draft: projects.filter((project) => project.status === "draft").length,
      generating: projects.filter((project) => project.status === "generating").length,
      completed: projects.filter((project) => project.status === "completed").length
    }
  });
}

async function handleCreateProductProject(req, res) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const body = await readRequestBody(req);
  body.targetPlatforms ||= body.platforms;
  body.targetCountry ||= body.targetMarket;
  body.factoryPrice ||= body.costPrice;
  body.currentInventory ||= body.inventory;
  body.productionLeadTimeDays ||= body.leadTimeDays;
  const structuredInput = normalizeStructuredInput(body);
  const flattenedProject = flattenProjectFromStructuredInput(structuredInput);
  const productName = String(flattenedProject.productName || body.productName || "").trim();
  const platforms = normalizePlatforms(flattenedProject.platforms.length ? flattenedProject.platforms : body.platforms);

  if (!productName) {
    sendValidationError(res, "Product name is required.");
    return;
  }

  if (platforms.length === 0) {
    sendValidationError(res, "Select at least one sales platform.");
    return;
  }

  const timestamp = new Date().toISOString();
  const project = {
    id: randomUUID(),
    workspaceId: context.workspace.id,
    productName,
    category: String(flattenedProject.category || body.category || "").trim() || "Uncategorized",
    targetMarket: String(flattenedProject.targetMarket || body.targetMarket || "").trim() || "美国",
    platforms,
    competitorLinks: normalizeCompetitorLinks(flattenedProject.competitorLinks.length ? flattenedProject.competitorLinks : body.competitorLinks),
    targetPrice: parseOptionalNumber(flattenedProject.targetPrice ?? body.targetPrice),
    costPrice: parseOptionalNumber(flattenedProject.costPrice ?? body.costPrice),
    inventory: parseOptionalNumber(flattenedProject.inventory ?? body.inventory),
    leadTimeDays: parseOptionalNumber(flattenedProject.leadTimeDays ?? body.leadTimeDays),
    structuredInput,
    status: "draft",
    opportunityScore: null,
    riskLevel: "unknown",
    createdBy: context.user.id,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  context.db.productProjects.push(project);
  await writeDb(context.db);

  sendJson(res, 201, {
    project: publicProductProject(project)
  });
}

async function handleGetProductProject(req, res, projectId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const project = context.db.productProjects.find(
    (item) => item.id === projectId && item.workspaceId === context.workspace?.id
  );

  if (!project) {
    sendNotFound(res);
    return;
  }

  sendJson(res, 200, {
    project: publicProductProject(project)
  });
}

function formatAiGenerationError(error) {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();

  if (message === "OPENAI_API_KEY is not configured.") {
    return "OPENAI_API_KEY 未配置，无法调用真实大模型。请在环境变量中配置 OPENAI_API_KEY。";
  }

  if (message === "DEEPSEEK_API_KEY is not configured.") {
    return "DEEPSEEK_API_KEY 未配置，无法调用 DeepSeek 大模型。请在环境变量中配置 DEEPSEEK_API_KEY。";
  }

  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("balance") ||
    normalized.includes("402") ||
    normalized.includes("payment required") ||
    normalized.includes("429") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  ) {
    return "OpenAI API 额度不足，请检查 Billing。";
  }

  if (normalized.includes("invalid_api_key") || normalized.includes("401") || normalized.includes("unauthorized")) {
    return "AI API Key 无效，请检查当前模型供应商的 API Key 配置。";
  }

  if (normalized.includes("model_not_found") || normalized.includes("model not found")) {
    return "当前大模型不可用，请检查模型名称和供应商配置。";
  }

  return message;
}

async function handleGenerateLaunchReport(req, res, projectId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const project = context.db.productProjects.find(
    (item) => item.id === projectId && item.workspaceId === context.workspace?.id
  );

  if (!project) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const timestamp = new Date().toISOString();
  const version = context.db.launchReports.filter((report) => report.projectId === project.id).length + 1;
  let generated;

  const reportProject = {
    ...project,
    structuredInput: project.structuredInput || normalizeStructuredInput(project)
  };
  const financialModel = calculateFinancialModel(reportProject.structuredInput);

  try {
    generated = await generateLaunchReportContent(reportProject, {
      generationMode: body.generationMode || "auto"
    });
  } catch (error) {
    sendJson(res, 503, {
      error: "AI Generation Error",
      message: formatAiGenerationError(error)
    });
    return;
  }

  const consistencyChecks = runConsistencyChecks(reportProject.structuredInput, financialModel);
  const decisionDashboard = buildDecisionDashboard(project, reportProject.structuredInput, financialModel, generated, consistencyChecks);
  const operatingPlan = buildOperatingPlan(reportProject.structuredInput, financialModel, generated);
  const reportBase = {
    ...generated,
    financialModel,
    decisionDashboard,
    consistencyChecks,
    dataSourceMap: reportProject.structuredInput,
    ...operatingPlan
  };
  const report = {
    id: randomUUID(),
    workspaceId: context.workspace.id,
    projectId: project.id,
    version,
    ...reportBase,
    visualizationReport: buildVisualizationReport(project, { ...reportBase, version, generatedAt: timestamp }, { timestamp }),
    parameterSnapshot: reportProject.structuredInput,
    changeLog: [
      {
        version,
        action: version === 1 ? "created" : "regenerated",
        note: "Report generated from structured input, formula engine, operating plan, and AI analysis.",
        createdAt: timestamp
      }
    ],
    opportunityScore: decisionDashboard.weightedScore,
    riskLevel: decisionDashboard.recommendationGrade === "D" ? "high" : decisionDashboard.recommendationGrade === "C" ? "medium" : generated.riskLevel,
    generatedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  context.db.launchReports.push(report);
  project.status = "completed";
  project.opportunityScore = report.opportunityScore;
  project.riskLevel = report.riskLevel;
  project.latestReportId = report.id;
  project.latestReportStatus = report.status;
  project.updatedAt = timestamp;
  await writeDb(context.db);

  sendJson(res, 201, {
    report: publicLaunchReport(report),
    project: publicProductProject(project)
  });
}

async function handleGetLaunchReportStatus(req, res, reportId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  sendJson(res, 200, {
    reportId: report.id,
    projectId: report.projectId,
    status: report.status,
    progress: report.status === "completed" ? 100 : 25,
    currentSection: report.status === "completed" ? "completed" : "overview",
    errorMessage: null
  });
}

async function handleGetLaunchReport(req, res, reportId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const project = context.db.productProjects.find((item) => item.id === report.projectId);
  const publicReport = {
    ...report,
    visualizationReport: report.visualizationReport || buildVisualizationReport(project, report, { timestamp: report.updatedAt || report.generatedAt })
  };

  sendJson(res, 200, {
    report: publicLaunchReport(publicReport),
    project: project ? publicProductProject(project) : null
  });
}

async function handleListProjectReportVersions(req, res, projectId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const project = context.db.productProjects.find(
    (item) => item.id === projectId && item.workspaceId === context.workspace?.id
  );

  if (!project) {
    sendNotFound(res);
    return;
  }

  const versions = context.db.launchReports
    .filter((report) => report.projectId === project.id && report.workspaceId === context.workspace?.id)
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
    .map((report) => ({
      id: report.id,
      version: report.version,
      status: report.status,
      recommendationGrade: report.decisionDashboard?.recommendationGrade || null,
      suggestedAction: report.decisionDashboard?.suggestedAction || null,
      weightedScore: report.decisionDashboard?.weightedScore ?? report.opportunityScore,
      generatedAt: report.generatedAt,
      changeLog: report.changeLog || []
    }));

  sendJson(res, 200, {
    project: publicProductProject(project),
    versions
  });
}

async function handleCompareProjectReports(req, res) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const projects = context.db.productProjects
    .filter((project) => project.workspaceId === context.workspace?.id)
    .map((project) => {
      const report = context.db.launchReports
        .filter((item) => item.projectId === project.id && item.workspaceId === context.workspace?.id)
        .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];

      return {
        id: project.id,
        productName: project.productName,
        category: project.category,
        targetMarket: project.targetMarket,
        platforms: project.platforms || [],
        latestReportId: report?.id || null,
        version: report?.version || null,
        recommendationGrade: report?.decisionDashboard?.recommendationGrade || null,
        suggestedAction: report?.decisionDashboard?.suggestedAction || null,
        weightedScore: report?.decisionDashboard?.weightedScore ?? report?.opportunityScore ?? null,
        baseNetMargin: report?.decisionDashboard?.baseNetMargin || null,
        breakEvenRoas: report?.decisionDashboard?.breakEvenRoas || null,
        biggestRisk: report?.decisionDashboard?.biggestRisk || null,
        dataGap: report?.decisionDashboard?.biggestDataGap || null
      };
    })
    .sort((a, b) => Number(b.weightedScore || 0) - Number(a.weightedScore || 0));

  sendJson(res, 200, {
    projects
  });
}

async function handleExternalDataStatus(req, res) {
  await requireSession(req, res);

  sendJson(res, 200, {
    connectors: [
      { key: "google_trends", name: "Google Trends", status: "not_connected", use: "趋势、季节性、搜索兴趣" },
      { key: "amazon", name: "Amazon Marketplace", status: "not_connected", use: "竞品、评论、价格、销量估算" },
      { key: "tiktok_shop", name: "TikTok Shop", status: "not_connected", use: "达人、内容、GMV、直播数据" },
      { key: "walmart", name: "Walmart Marketplace", status: "not_connected", use: "竞品、价格、类目承接" },
      { key: "review_sources", name: "Review Sources", status: "not_connected", use: "Amazon/TikTok/Reddit/YouTube 评论分析" }
    ],
    rule: "未连接外部接口时，报告中的外部数据必须显示为待验证或AI估算，不能写成确定事实。"
  });
}

async function handleDownloadLaunchReportPdf(req, res, reportId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const project = context.db.productProjects.find((item) => item.id === report.projectId);
  const dashboard = report.decisionDashboard || {};
  const financial = report.financialModel?.formulas || {};
  const lines = [
    `产品：${project?.productName || report.projectId}`,
    `目标市场：${project?.targetMarket || ""}`,
    `平台：${(project?.platforms || []).join(", ")}`,
    `目标售价：${project?.targetPrice ?? "待确认"}`,
    `出厂价：${project?.costPrice ?? "待确认"}`,
    `竞品链接：${(project?.competitorLinks || []).join(" | ") || "未提供"}`,
    "",
    "最终决策驾驶舱",
    `项目推荐等级：${dashboard.recommendationGrade || "待确认"}`,
    `建议动作：${dashboard.suggestedAction || "待确认"}`,
    `建议首批备货量：${dashboard.suggestedFirstBatchInventory || "待确认"}`,
    `建议测试预算：${dashboard.suggestedTestBudget || "待确认"}`,
    `基准净利润率：${dashboard.baseNetMargin || "待确认"}`,
    `盈亏平衡ROAS：${dashboard.breakEvenRoas || "待确认"}`,
    `最大风险：${dashboard.biggestRisk || "待确认"}`,
    `下一步验证动作：${dashboard.nextValidationAction || "待确认"}`,
    "",
    "财务公式结果",
    `单台落地成本：${financial.landedCost ?? "待确认"}`,
    `单台出仓成本：${financial.fulfillmentCost ?? "待确认"}`,
    `单台完整成本：${financial.totalCostPerUnit ?? "待确认"}`,
    `单台净利润：${financial.netProfitPerUnit ?? "待确认"}`,
    `首批备货现金需求：${financial.firstBatchCashNeed ?? "待确认"}`,
    "",
    `报告摘要：${report.summary || ""}`,
    `建议：${report.recommendation || ""}`
  ];
  const buffer = buildSimplePdf(`${project?.productName || "launch-report"} - AI Product Launch Report`, lines);
  const filename = `launch-report-${report.id}.pdf`;

  sendPdf(res, filename, buffer);
}

async function handleExportLaunchReport(req, res, reportId, format) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const project = context.db.productProjects.find((item) => item.id === report.projectId);
  const safeName = safeDownloadName(project?.productName || "AI_Product_Launch_Report");

  if (format === "json") {
    const payload = buildExportPayload(project ? publicProductProject(project) : null, publicLaunchReport(report));
    const buffer = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    sendDownload(res, "application/json; charset=utf-8", `${safeName}_AI_Product_Launch_Report.json`, buffer);
    return;
  }

  if (format === "docx") {
    const buffer = buildDocx(project ? publicProductProject(project) : null, publicLaunchReport(report));
    sendDownload(
      res,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      `${safeName}_AI_Product_Launch_Report.docx`,
      buffer
    );
    return;
  }

  if (format === "xlsx") {
    const buffer = buildXlsx(project ? publicProductProject(project) : null, publicLaunchReport(report));
    sendDownload(
      res,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `${safeName}_AI_Product_Launch_Report.xlsx`,
      buffer
    );
    return;
  }

  sendValidationError(res, "Unsupported export format.");
}

function safeDownloadName(value) {
  return String(value || "AI_Product_Launch_Report")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

async function handleRegenerateReportSection(req, res, reportId, sectionType) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const project = context.db.productProjects.find(
    (item) => item.id === report.projectId && item.workspaceId === context.workspace?.id
  );

  if (!project) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const updatedSection = await generateReportSectionContent(project, sectionType, {
    generationMode: body.generationMode || "auto",
    instruction: body.instruction || ""
  });
  const sectionIndex = report.sections.findIndex((section) => section.type === sectionType);

  if (sectionIndex === -1) {
    sendNotFound(res);
    return;
  }

  report.sections[sectionIndex] = updatedSection;
  report.updatedAt = new Date().toISOString();
  await writeDb(context.db);

  sendJson(res, 200, {
    section: updatedSection,
    report: publicLaunchReport(report)
  });
}

async function handleUpdateVideoScript(req, res, reportId, scriptId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "video_scripts");
  const script = section?.scripts?.find((item) => item.id === scriptId);

  if (!section || !script) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const editableFields = ["title", "hook", "voiceover", "captions", "cta", "creatorType", "conversionGoal", "status"];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      script[field] = String(body[field]).trim();
    }
  }

  if (Array.isArray(body.storyboard)) {
    script.storyboard = body.storyboard.map((item) => ({
      time: String(item.time || "").trim(),
      action: String(item.action || "").trim()
    }));
  }

  script.updatedAt = new Date().toISOString();
  report.updatedAt = script.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    script,
    report: publicLaunchReport(report)
  });
}

async function handleUpdateLiveSegment(req, res, reportId, segmentId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "live_scripts");
  const segment = section?.segments?.find((item) => item.id === segmentId);

  if (!section || !segment) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const editableFields = ["stage", "minuteRange", "objective", "hostLine", "demoAction", "objectionAnswer", "offerCue", "status"];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      segment[field] = String(body[field]).trim();
    }
  }

  segment.updatedAt = new Date().toISOString();
  report.updatedAt = segment.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    segment,
    report: publicLaunchReport(report)
  });
}

async function handleUpdateReviewReply(req, res, reportId, replyId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "review_insights");
  const reply = section?.replies?.find((item) => item.id === replyId);

  if (!section || !reply) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const editableFields = ["trigger", "replyText", "intent", "status"];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      reply[field] = String(body[field]).trim();
    }
  }

  reply.updatedAt = new Date().toISOString();
  report.updatedAt = reply.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    reply,
    report: publicLaunchReport(report)
  });
}

async function handleUpdateComplianceCheck(req, res, reportId, checkId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "compliance_risk");
  const check = section?.checks?.find((item) => item.id === checkId);

  if (!section || !check) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const editableFields = ["area", "risk", "requirement", "action", "owner", "status"];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      check[field] = String(body[field]).trim();
    }
  }

  check.updatedAt = new Date().toISOString();
  report.updatedAt = check.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    check,
    report: publicLaunchReport(report)
  });
}

async function handleUpdatePlanPhase(req, res, reportId, phaseId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "ninety_day_plan");
  const phase = section?.phases?.find((item) => item.id === phaseId);

  if (!section || !phase) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const editableFields = ["dayRange", "name", "objective", "keyMetric", "budgetFocus", "owner", "status"];

  for (const field of editableFields) {
    if (body[field] !== undefined) {
      phase[field] = String(body[field]).trim();
    }
  }

  if (Array.isArray(body.tasks)) {
    phase.tasks = body.tasks.map((item) => String(item || "").trim()).filter(Boolean);
  }

  phase.updatedAt = new Date().toISOString();
  report.updatedAt = phase.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    phase,
    report: publicLaunchReport(report)
  });
}

async function handleUpdateForecastScenario(req, res, reportId, scenarioId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "sales_forecast");
  const scenario = section?.scenarios?.find((item) => item.id === scenarioId);

  if (!section || !scenario) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const textFields = ["name", "conversionRate", "trigger", "recommendation", "status"];
  const numberFields = ["units", "revenue", "grossProfit", "adBudget"];

  for (const field of textFields) {
    if (body[field] !== undefined) {
      scenario[field] = String(body[field]).trim();
    }
  }

  for (const field of numberFields) {
    if (body[field] !== undefined) {
      scenario[field] = Number(body[field]) || 0;
    }
  }

  scenario.updatedAt = new Date().toISOString();
  report.updatedAt = scenario.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    scenario,
    report: publicLaunchReport(report)
  });
}

async function handleUpdateInventoryAction(req, res, reportId, actionId) {
  const context = await requireSession(req, res);

  if (!context) {
    return;
  }

  const report = context.db.launchReports.find(
    (item) => item.id === reportId && item.workspaceId === context.workspace?.id
  );

  if (!report) {
    sendNotFound(res);
    return;
  }

  const section = report.sections.find((item) => item.type === "inventory_suggestion");
  const action = section?.actions?.find((item) => item.id === actionId);

  if (!section || !action) {
    sendNotFound(res);
    return;
  }

  const body = await readRequestBody(req);
  const textFields = ["name", "timing", "trigger", "rationale", "status"];

  for (const field of textFields) {
    if (body[field] !== undefined) {
      action[field] = String(body[field]).trim();
    }
  }

  if (body.quantity !== undefined) {
    action.quantity = Number(body.quantity) || 0;
  }

  action.updatedAt = new Date().toISOString();
  report.updatedAt = action.updatedAt;
  await writeDb(context.db);

  sendJson(res, 200, {
    action,
    report: publicLaunchReport(report)
  });
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/health") {
    const database = await getDatabaseStatus();
    sendJson(res, database.ok ? 200 : 503, {
      status: database.ok ? "ok" : "degraded",
      app: "AI Product Launch OS",
      sprint: "Sprint 20",
      timestamp: new Date().toISOString(),
      services: {
        api: "ok",
        database,
        openai: openAiConfigStatus()
      }
    });
    return;
  }

  if (requestUrl.pathname === "/api/version") {
    sendJson(res, 200, {
      name: "AI Product Launch OS",
      version: "0.1.0",
      sprint: "Sprint 20"
    });
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/register") {
    await handleRegister(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/login") {
    await handleLogin(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/auth/logout") {
    await handleLogout(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/auth/me") {
    await handleMe(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/workspaces/current") {
    await handleCurrentWorkspace(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/workspaces") {
    await handleCreateWorkspace(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/product-projects") {
    await handleListProductProjects(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/product-projects/compare") {
    await handleCompareProjectReports(req, res);
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/external-data/status") {
    await handleExternalDataStatus(req, res);
    return;
  }

  if (req.method === "POST" && requestUrl.pathname === "/api/product-projects") {
    await handleCreateProductProject(req, res);
    return;
  }

  const reportGenerateMatch = requestUrl.pathname.match(/^\/api\/product-projects\/([^/]+)\/launch-report\/generate$/);

  if (req.method === "POST" && reportGenerateMatch) {
    await handleGenerateLaunchReport(req, res, reportGenerateMatch[1]);
    return;
  }

  const reportStatusMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/status$/);

  if (req.method === "GET" && reportStatusMatch) {
    await handleGetLaunchReportStatus(req, res, reportStatusMatch[1]);
    return;
  }

  const reportExportMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/export\/(json|docx|xlsx)$/);

  if (req.method === "GET" && reportExportMatch) {
    await handleExportLaunchReport(req, res, reportExportMatch[1], reportExportMatch[2]);
    return;
  }

  const reportPdfMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/pdf$/);

  if (req.method === "GET" && reportPdfMatch) {
    await handleDownloadLaunchReportPdf(req, res, reportPdfMatch[1]);
    return;
  }

  const reportMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)$/);

  if (req.method === "GET" && reportMatch) {
    await handleGetLaunchReport(req, res, reportMatch[1]);
    return;
  }

  const reportSectionRegenerateMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/sections\/([^/]+)\/regenerate$/);

  if (req.method === "POST" && reportSectionRegenerateMatch) {
    await handleRegenerateReportSection(req, res, reportSectionRegenerateMatch[1], reportSectionRegenerateMatch[2]);
    return;
  }

  const videoScriptMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/video-scripts\/([^/]+)$/);

  if (req.method === "PATCH" && videoScriptMatch) {
    await handleUpdateVideoScript(req, res, videoScriptMatch[1], videoScriptMatch[2]);
    return;
  }

  const liveSegmentMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/live-segments\/([^/]+)$/);

  if (req.method === "PATCH" && liveSegmentMatch) {
    await handleUpdateLiveSegment(req, res, liveSegmentMatch[1], liveSegmentMatch[2]);
    return;
  }

  const reviewReplyMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/review-replies\/([^/]+)$/);

  if (req.method === "PATCH" && reviewReplyMatch) {
    await handleUpdateReviewReply(req, res, reviewReplyMatch[1], reviewReplyMatch[2]);
    return;
  }

  const complianceCheckMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/compliance-checks\/([^/]+)$/);

  if (req.method === "PATCH" && complianceCheckMatch) {
    await handleUpdateComplianceCheck(req, res, complianceCheckMatch[1], complianceCheckMatch[2]);
    return;
  }

  const planPhaseMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/plan-phases\/([^/]+)$/);

  if (req.method === "PATCH" && planPhaseMatch) {
    await handleUpdatePlanPhase(req, res, planPhaseMatch[1], planPhaseMatch[2]);
    return;
  }

  const forecastScenarioMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/forecast-scenarios\/([^/]+)$/);

  if (req.method === "PATCH" && forecastScenarioMatch) {
    await handleUpdateForecastScenario(req, res, forecastScenarioMatch[1], forecastScenarioMatch[2]);
    return;
  }

  const inventoryActionMatch = requestUrl.pathname.match(/^\/api\/launch-reports\/([^/]+)\/inventory-actions\/([^/]+)$/);

  if (req.method === "PATCH" && inventoryActionMatch) {
    await handleUpdateInventoryAction(req, res, inventoryActionMatch[1], inventoryActionMatch[2]);
    return;
  }

  const projectMatch = requestUrl.pathname.match(/^\/api\/product-projects\/([^/]+)$/);

  const projectVersionsMatch = requestUrl.pathname.match(/^\/api\/product-projects\/([^/]+)\/launch-reports$/);

  if (req.method === "GET" && projectVersionsMatch) {
    await handleListProjectReportVersions(req, res, projectVersionsMatch[1]);
    return;
  }

  if (req.method === "GET" && projectMatch) {
    await handleGetProductProject(req, res, projectMatch[1]);
    return;
  }

  await serveStatic(req, res);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendJson(res, 500, {
      error: "Internal Server Error",
      message: error.message
    });
  });
});

server.listen(port, host, () => {
  console.log(`AI Product Launch OS is running at http://${host}:${port}`);
  console.log(`Health check: http://${host}:${port}/api/health`);
});
