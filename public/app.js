const statusRow = document.querySelector(".status-row");
const statusText = document.querySelector("#system-status");
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const logoutButton = document.querySelector("#logout-button");
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const modeToggle = document.querySelector("#mode-toggle");
const submitButton = document.querySelector("#submit-button");
const formModeLabel = document.querySelector("#form-mode-label");
const formTitle = document.querySelector("#form-title");
const registerOnlyFields = document.querySelectorAll(".register-only");
const workspaceTitle = document.querySelector("#workspace-title");
const workspaceSubtitle = document.querySelector("#workspace-subtitle");
const newProjectButton = document.querySelector("#new-project-button");
const projectList = document.querySelector("#project-list");
const projectListFull = document.querySelector("#project-list-full");
const metricTotal = document.querySelector("#metric-total");
const metricDraft = document.querySelector("#metric-draft");
const metricCompleted = document.querySelector("#metric-completed");
const navItems = document.querySelectorAll(".nav-item");
const dashboardPanels = document.querySelectorAll(".dashboard-panel");
const openCreateButtons = document.querySelectorAll("[data-open-create]");
const projectForm = document.querySelector("#project-form");
const projectMessage = document.querySelector("#project-message");
const cancelCreateButton = document.querySelector("#cancel-create-button");
const backToProjectsButton = document.querySelector("#back-to-projects-button");
const projectDetailTitle = document.querySelector("#project-detail-title");
const projectDetail = document.querySelector("#project-detail");
const generateReportButton = document.querySelector("#generate-report-button");
const viewReportButton = document.querySelector("#view-report-button");
const reportMessage = document.querySelector("#report-message");
const reportTitle = document.querySelector("#report-title");
const reportSummary = document.querySelector("#report-summary");
const reportModuleNav = document.querySelector("#report-module-nav");
const reportSections = document.querySelector("#report-sections");
const backToDetailButton = document.querySelector("#back-to-detail-button");
let downloadReportButton = null;

let authMode = "register";
let activeProject = null;
let activeReport = null;
const PROJECT_DRAFT_KEY = "ai_product_launch_project_draft";

const LAUNCH_MODULES = [
  {
    type: "market_intelligence",
    title: "市场分析",
    subtitle: "Market Intelligence",
    fallbackItems: ["美国市场规模（TAM/SAM/SOM）", "Amazon/TikTok/Walmart销量预估", "Google Trends近5年趋势", "季节性分析", "价格带分析", "品牌集中度", "TOP100竞品分析", "店铺分布", "利润率分析", "预计GMV", "预计ROI", "市场进入评分（0-100分）", "AI销量预测（30/90/180/365天）", "AI备货建议", "AI资金占用预测"]
  },
  {
    type: "creator_intelligence",
    title: "达人画像",
    subtitle: "Creator Intelligence",
    fallbackItems: ["达人类型", "粉丝画像", "年龄分布", "性别比例", "地区分布", "粉丝消费能力", "粉丝兴趣标签", "爆款率", "GMV", "平均播放", "平均CTR", "平均CVR", "平均佣金", "是否合作过竞品", "是否容易合作", "达人分层", "百万GMV达人需求"]
  },
  {
    type: "consumer_intelligence",
    title: "用户画像",
    subtitle: "Consumer Intelligence",
    fallbackItems: ["年龄", "性别", "收入", "职业", "购买原因", "核心痛点"]
  },
  {
    type: "video_ai",
    title: "短视频AI",
    subtitle: "Video AI",
    fallbackItems: ["爆款选题100条", "30秒脚本", "45秒脚本", "60秒脚本", "开头3秒", "冲突", "痛点", "产品展示", "CTA", "拍摄分镜", "字幕", "BGM建议"]
  },
  {
    type: "live_ai",
    title: "直播AI",
    subtitle: "Live AI",
    fallbackItems: ["2小时直播SOP", "第一分钟话术", "第五分钟话术", "抽奖节点", "Coupon节点", "产品演示", "逼单话术", "互动节奏", "100个直播问题", "AI自动回答"]
  },
  {
    type: "comment_ai",
    title: "评论AI",
    subtitle: "Comment AI",
    fallbackItems: ["Amazon Review", "TikTok评论", "Reddit", "YouTube", "喜欢原因", "退货原因", "差评原因", "营销文案"]
  },
  {
    type: "compliance_ai",
    title: "风险合规",
    subtitle: "Compliance AI",
    fallbackItems: ["TikTok违规风险", "医疗宣称", "夸大宣传", "品类限制", "知识产权", "外观专利", "发明专利", "商标", "版权", "FCC/ETL/UL/Prop 65/CPSIA", "电池运输要求", "平台类目资质", "风险评分"]
  },
  {
    type: "launch_plan",
    title: "打品计划",
    subtitle: "Launch Plan",
    fallbackItems: ["90天执行计划", "Week 1", "Week 2", "Week 3", "Week 4", "视频数量", "达人数量", "直播时长", "广告预算", "GMV目标", "补货计划"]
  },
  {
    type: "decision_center",
    title: "AI决策中心",
    subtitle: "Decision Center",
    fallbackItems: ["市场容量", "利润空间", "TikTok适配", "Amazon适配", "Walmart适配", "达人适配", "内容可玩性", "合规风险", "供应链成熟度", "售后风险", "推荐指数", "建议立项", "首批备货", "达人合作", "短视频产出", "直播时长", "30/90/365天GMV"]
  },
  {
    type: "profit_model",
    title: "利润模型",
    subtitle: "Profit Model",
    fallbackItems: ["商品出厂价", "关税（Duty）", "海运费（LCL）", "港口及清关费", "总落地成本", "尾程配送费", "燃油附加费", "商品出仓成本", "仓储费", "广告成本", "平台佣金", "退货与损耗", "运营费用合计", "商品总成本", "商品毛利", "运营利润"]
  }
];

async function refreshHealth() {
  try {
    const response = await fetch("/api/health", {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await response.json();

    if (!response.ok || payload.status !== "ok") {
      throw new Error(payload.services?.database?.message || "系统状态异常。");
    }

    statusRow.classList.add("is-ok");
    statusText.textContent = "系统在线，API 和数据存储已连接。";
  } catch (error) {
    statusRow.classList.add("is-error");
    statusText.textContent = `系统需要检查：${error.message}`;
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(mapApiError(payload.message || payload.error, response.status));
  }

  return payload;
}

function setMode(mode) {
  authMode = mode;
  const isRegister = authMode === "register";

  formModeLabel.textContent = isRegister ? "创建账号" : "欢迎回来";
  formTitle.textContent = isRegister ? "进入打品工作台" : "登录继续";
  submitButton.textContent = isRegister ? "创建账号" : "登录";
  modeToggle.textContent = isRegister ? "已有账号？登录" : "还没有账号？创建一个";
  registerOnlyFields.forEach((field) => field.classList.toggle("hidden", !isRegister));
  authMessage.textContent = "";
}

function showAuth() {
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  logoutButton.classList.add("hidden");
}

function switchPanel(panelId) {
  dashboardPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== panelId);
  });
  navItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.targetView === panelId);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("AI 推测", "预计")
    .replaceAll("AI推测", "预计")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(value) {
  return String(value || "AI_Product_Launch_Report")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function scoreToPercent(value, fallback = "待评估") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  const normalized = number > 0 && number <= 10 ? number * 10 : number;
  return String(Math.max(0, Math.min(100, Math.round(normalized))));
}

function mapApiError(message, status) {
  const normalized = String(message || "").toLowerCase();

  if (
    status === 402 ||
    status === 429 ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("balance") ||
    normalized.includes("too many requests") ||
    normalized.includes("rate limit")
  ) {
    return "OpenAI API 额度不足，请检查 Billing。";
  }

  if (status >= 500) {
    return message || "生成失败，服务暂时不可用，请稍后重试。";
  }

  return message || "请求失败，请检查输入后重试。";
}

function projectStatusLabel(status) {
  const labels = {
    draft: "草稿",
    generating: "生成中",
    completed: "已完成",
    archived: "已归档"
  };

  return labels[status] || "草稿";
}

function riskLabel(riskLevel) {
  const labels = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    unknown: "未评估"
  };

  return labels[riskLevel] || "未评估";
}

function workflowStatusLabel(status) {
  const labels = {
    draft: "草稿",
    planned: "已计划",
    active: "进行中",
    approved: "已批准",
    done: "已完成",
    blocked: "已阻塞",
    open: "待处理",
    in_review: "审核中",
    paused: "已暂停",
    retired: "已停用"
  };

  return labels[status] || status;
}

function confidenceLabel(confidence) {
  const labels = {
    high: "高",
    medium: "中",
    low: "低"
  };

  return labels[confidence] || confidence || "未评估";
}

function moduleLabel(type) {
  const launchModule = LAUNCH_MODULES.find((module) => module.type === type);

  if (launchModule) {
    return launchModule.title;
  }

  const labels = {
    product_fingerprint: "产品指纹",
    differentiation_analysis: "产品差异化分析",
    market_analysis: "市场分析",
    creator_analysis: "达人分析",
    customer_persona: "用户画像",
    video_scripts: "短视频脚本",
    live_scripts: "直播话术",
    review_insights: "评论分析",
    compliance_risk: "风险合规",
    ninety_day_plan: "90天打品计划",
    sales_forecast: "销量预测",
    inventory_suggestion: "备货建议"
  };

  return labels[type] || type;
}

function renderProjects(target, projects, compact = false) {
  if (!projects.length) {
    target.innerHTML = `
      <section class="empty-state">
        <p class="label">暂无项目</p>
        <h2>从第一个产品开始打品</h2>
        <p>添加产品后，可以生成市场分析、达人策略、脚本、预测和备货建议。</p>
        <button class="primary-action" type="button" data-open-create>新建产品</button>
      </section>
    `;

    target.querySelector("[data-open-create]").addEventListener("click", () => switchPanel("create-panel"));
    return;
  }

  const visibleProjects = compact ? projects.slice(0, 5) : projects;
  target.innerHTML = `
    <div class="project-table">
      ${visibleProjects
        .map(
          (project) => `
            <article class="project-row">
              <div>
                <button class="project-link" type="button" data-project-id="${escapeHtml(project.id)}">${escapeHtml(project.productName)}</button>
                <p>${escapeHtml(project.category)} - ${escapeHtml(project.targetMarket)}</p>
              </div>
              <div class="platform-tags">
                ${(project.platforms || []).map((platform) => `<span>${escapeHtml(platform)}</span>`).join("") || "<span>多渠道</span>"}
              </div>
              <span class="status-pill">${projectStatusLabel(project.status)}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  target.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", () => openProjectDetail(button.dataset.projectId));
  });
}

function renderDashboard(payload) {
  const projects = payload.projects || [];

  metricTotal.textContent = payload.summary?.total ?? projects.length;
  metricDraft.textContent = payload.summary?.draft ?? 0;
  metricCompleted.textContent = payload.summary?.completed ?? 0;
  renderProjects(projectList, projects, true);
  renderProjects(projectListFull, projects, false);
}

async function refreshProjects() {
  const payload = await requestJson("/api/product-projects");
  renderDashboard(payload);
}

function formatValue(value, fallback = "未填写") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function renderProjectDetail(project) {
  activeProject = project;
  projectDetailTitle.textContent = project.productName;
  reportMessage.textContent = "";
  reportMessage.classList.remove("is-error");
  generateReportButton.disabled = false;
  generateReportButton.textContent = project.latestReportId ? "重新生成" : "生成报告";
  viewReportButton.classList.toggle("hidden", !project.latestReportId);
  projectDetail.innerHTML = `
    <article>
      <span>项目状态</span>
      <strong>${projectStatusLabel(project.status)}</strong>
      <p>报告状态：${escapeHtml(project.latestReportStatus || "not_generated")}</p>
    </article>
    <article>
      <span>机会分</span>
      <strong>${formatValue(project.opportunityScore, "未评分")}</strong>
      <p>风险：${riskLabel(project.riskLevel)}</p>
    </article>
    <article>
      <span>平台</span>
      <strong>${(project.platforms || []).map(escapeHtml).join(", ") || "多渠道"}</strong>
      <p>本次打品选择的销售渠道。</p>
    </article>
    <article>
      <span>竞品链接</span>
      <strong>${formatValue((project.competitorLinks || []).length, "0")}</strong>
      <p>${(project.competitorLinks || []).slice(0, 2).map(escapeHtml).join(" / ") || "未填写竞品链接"}</p>
    </article>
    <article>
      <span>市场</span>
      <strong>${escapeHtml(project.targetMarket)}</strong>
      <p>${escapeHtml(project.category)}</p>
    </article>
    <article>
      <span>价格</span>
      <strong>${formatValue(project.targetPrice, "未设置")}</strong>
      <p>成本：${formatValue(project.costPrice)}</p>
    </article>
    <article>
      <span>库存</span>
      <strong>${formatValue(project.inventory, "未填写库存")}</strong>
      <p>补货周期：${formatValue(project.leadTimeDays, "未设置")} 天</p>
    </article>
    <article>
      <span>创建时间</span>
      <strong>${new Date(project.createdAt).toLocaleDateString()}</strong>
      <p>项目 ID：${escapeHtml(project.id)}</p>
    </article>
  `;
}

async function openProjectDetail(projectId) {
  const payload = await requestJson(`/api/product-projects/${projectId}`);
  renderProjectDetail(payload.project);
  switchPanel("detail-panel");
}

function renderLaunchReport(payload) {
  const report = payload.report;
  const project = payload.project;
  activeReport = report;
  activeProject = project || activeProject;
  reportTitle.textContent = project?.productName || "打品报告";
  reportSummary.innerHTML = `
    <article>
      <span>状态</span>
      <strong>${escapeHtml(report.status)}</strong>
      <p>版本 ${report.version} · ${new Date(report.generatedAt).toLocaleString()}</p>
    </article>
    <article>
      <span>机会分</span>
      <strong>${report.opportunityScore}</strong>
      <p>${escapeHtml(report.recommendation)}</p>
    </article>
    <article>
      <span>风险等级</span>
      <strong>${riskLabel(report.riskLevel)}</strong>
      <p>${escapeHtml(report.summary)}</p>
    </article>
  `;
  reportSections.innerHTML = (report.sections || [])
    .map(
      (section) => `
        <article>
          <span>${escapeHtml(section.type)}</span>
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.content)}</p>
        </article>
      `
    )
    .join("");
}

function renderLaunchReportV2(payload) {
  const report = payload.report;
  const project = payload.project;
  const burstProbability = scoreToPercent(report.productEvaluationModel?.totalScore ?? report.opportunityScore);
  activeReport = report;
  activeProject = project || activeProject;
  ensureDownloadReportButton();
  reportMessage.textContent = "";
  reportTitle.textContent = project?.productName || "打品报告";
  reportSummary.innerHTML = `
    <article>
      <span>状态</span>
      <strong>${escapeHtml(report.status)}</strong>
      <p>版本 ${report.version} - ${new Date(report.generatedAt).toLocaleString()}</p>
      <p>${escapeHtml(report.generationSource || "未知来源")} · ${escapeHtml(report.model || "无模型")}</p>
    </article>
    <article>
      <span>机会分</span>
      <strong>${report.opportunityScore}</strong>
      <p>${escapeHtml(report.recommendation)}</p>
    </article>
    <article>
      <span>风险等级</span>
      <strong>${riskLabel(report.riskLevel)}</strong>
      <p>${escapeHtml(report.summary)}</p>
      ${report.aiError ? `<p class="inline-warning">备用生成说明：${escapeHtml(report.aiError)}</p>` : ""}
    </article>
    <article>
      <span>智能评估结论</span>
      <strong>爆款概率 ${escapeHtml(burstProbability)} / 100</strong>
      <p>数据可信度：${escapeHtml(report.dataCredibilityScore ?? "未评分")} / 100</p>
      <button class="primary-action report-card-action" type="button" data-export-report-pdf>导出 PDF</button>
    </article>
  `;
  reportSummary.querySelector("[data-export-report-pdf]")?.addEventListener("click", exportActiveReportPdf);
  renderReportModules(report.sections || [], report.sections?.[0]?.type);
}

function ensureDownloadReportButton() {
  if (downloadReportButton) {
    downloadReportButton.classList.remove("hidden");
    return;
  }

  const headingActions = document.querySelector("#report-panel .section-actions");

  if (!headingActions) {
    return;
  }

  downloadReportButton = document.createElement("button");
  downloadReportButton.className = "primary-action";
  downloadReportButton.type = "button";
  downloadReportButton.textContent = "导出 PDF";
  downloadReportButton.addEventListener("click", exportActiveReportPdf);
  headingActions.insertBefore(downloadReportButton, backToDetailButton);
}

function dataTypeClass(dataType) {
  if (dataType === "已验证数据") {
    return "is-verified";
  }

  if (dataType === "人工假设数据") {
    return "is-assumption";
  }

  return "is-inferred";
}

function renderEvidenceItems(items, valueKey = "value") {
  return (items || [])
    .map(
      (item) => `
        <div class="evidence-item">
          <strong>${escapeHtml(item.field)}</strong>
          <p>${escapeHtml(item[valueKey] || item.assumption || "")}</p>
          <span>${escapeHtml(item.note || item.caution || item.validationMethod || item.basis || "")}</span>
        </div>
      `
    )
    .join("");
}

function scoreDimensionLabel(key) {
  const labels = {
    demandScore: "市场需求",
    competitionScore: "竞品验证",
    viralityScore: "内容传播",
    marginScore: "利润空间",
    riskScore: "风险控制",
    overallScore: "综合评分"
  };

  return labels[key] || key;
}

function renderEvaluationLayer(report) {
  const model = report.productEvaluationModel;
  const burstProbability = scoreToPercent(model?.totalScore ?? report.opportunityScore);
  const scoreInsight =
    model?.scoreInsight ||
    report.aiEngine?.scoreInsight ||
    `${report.generationSource || "DeepSeek"} AI Intelligence Engine 基于 Product Profile 完成评分推理，建议优先用高分维度设计测品动作，用低分维度作为上线前复核重点。`;

  if (!model) {
    return "";
  }

  return `
    <section class="evaluation-layer">
      <div class="evaluation-header">
        <div>
          <span>智能评估结论</span>
          <h3>爆款概率 ${escapeHtml(burstProbability)} / 100</h3>
          <p>${escapeHtml(scoreInsight)}</p>
        </div>
        <div class="evaluation-score">
          <span>可导出PDF</span>
          <strong>${escapeHtml(report.dataCredibilityScore ?? "待评估")}</strong>
          <p>数据可信度 / 100</p>
        </div>
      </div>
    </section>
  `;
}

function sectionForLaunchModule(sections, moduleType, index) {
  return (
    sections.find((section) => section.type === moduleType) ||
    sections.find((section) => section.id === moduleType) ||
    sections[index] ||
    null
  );
}

function compactReportList(value, fallback) {
  return Array.isArray(value) && value.filter(Boolean).length
    ? value.filter(Boolean).slice(0, 2).join("、")
    : fallback;
}

function currentReportContext() {
  const profile = activeReport?.productProfile || {};

  return {
    product: activeProject?.productName || "该产品",
    category: profile.productCategory || activeProject?.category || "待识别品类",
    scenarios: compactReportList(profile.useScenarios, "待识别使用场景"),
    consumers: compactReportList(profile.consumerSegments, "待识别消费人群"),
    price: activeProject?.targetPrice ? `$${activeProject.targetPrice}` : profile.priceBand || "待确认价格带",
    cost: activeProject?.costPrice ? `$${activeProject.costPrice}` : "待确认成本",
    platforms: compactReportList(activeProject?.platforms, "TikTok / Amazon / Walmart"),
    market: activeProject?.targetMarket || "目标市场"
  };
}

function isGenericReportText(value) {
  const text = String(value || "");

  return (
    !text.trim() ||
    text.length < 16 ||
    /Product Profile\s*\+?\s*AI|AI推理|平台上下文|动态章节推理|AI Engine output|based on category|category average|中高客单厨房小家电测算市场容量|10万美元GMV约需售出|100万美元GMV约需售出|通用|模板|需要结合|单独验证|单独判断/.test(text)
  );
}

function textIncludesAny(value, keywords) {
  const text = String(value || "").toLowerCase();
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function contextNumber(value, fallback) {
  const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function marginText(context) {
  const price = contextNumber(context.price, 179);
  const cost = contextNumber(context.cost, 61);
  return `${Math.round(((price - cost) / price) * 100)}%`;
}

function millionGmvUnits(context) {
  return Math.ceil(1000000 / contextNumber(context.price, 179)).toLocaleString("en-US");
}

function fallbackVariant(items, index) {
  return items[index % items.length];
}

function directFallbackConclusion(module, label, context, index = 0) {
  const type = module.type;
  const margin = marginText(context);
  const units = millionGmvUnits(context);

  if (type === "market_intelligence") {
    if (textIncludesAny(label, ["tam", "总可用"])) return `TAM结论：${context.market}${context.category}覆盖家庭厨房、健康饮品和夏季消暑需求，适合作为大盘容量判断，不直接等同首年销量。`;
    if (textIncludesAny(label, ["sam", "可服务"])) return `SAM结论：可服务市场应聚焦TikTok、Amazon和Walmart线上用户，优先计算愿意购买${context.price}厨房电器的人群。`;
    if (textIncludesAny(label, ["som", "可获得"])) return `SOM结论：首阶段可获得市场来自达人内容转化和Amazon搜索承接，建议先按小批量测品份额评估。`;
    if (textIncludesAny(label, ["amazon"])) return `Amazon销量结论：Amazon更适合承接搜索型需求，重点看“ice crusher / smoothie maker / shaved ice machine”同价位Listing转化。`;
    if (textIncludesAny(label, ["tiktok"])) return `TikTok销量结论：TikTok增量来自视觉演示内容，出冰效果、夏日饮品和健身代餐场景决定短期爆发。`;
    if (textIncludesAny(label, ["walmart"])) return `Walmart销量结论：Walmart适合做价格和家庭厨房场景承接，但爆发性弱于TikTok，适合作为补充渠道。`;
    if (textIncludesAny(label, ["google", "trends", "趋势"])) return `趋势结论：搜索趋势应重点观察5-8月夏季饮品高峰，以及健康代餐、家庭聚会内容是否同步升温。`;
    if (textIncludesAny(label, ["季节"])) return `季节性结论：${context.product}旺季集中在春末到夏季，备货和达人排期应提前4-6周启动。`;
    if (textIncludesAny(label, ["价格带", "价格"])) return `价格带结论：${context.price}属于中高客单，必须用更强功率、口感、耐用性和售后承诺支撑溢价。`;
    if (textIncludesAny(label, ["品牌集中"])) return `品牌集中度结论：若头部品牌评价数量高但内容表达弱，TikTok仍可通过场景演示切入。`;
    if (textIncludesAny(label, ["top100", "竞品"])) return `TOP竞品结论：优先拆解同价位竞品的差评、出冰效果、噪音和清洗问题，用改进点做卖点。`;
    if (textIncludesAny(label, ["店铺"])) return `店铺分布结论：若竞品以Amazon店铺为主，TikTok Shop可用达人内容降低新品冷启动成本。`;
    if (textIncludesAny(label, ["利润率", "利润"])) return `利润率结论：出厂成本${context.cost}、售价${context.price}下裸毛利约${margin}，核心压力来自尾程、广告和退货。`;
    if (textIncludesAny(label, ["gmv"])) return `GMV结论：按${context.price}售价测算，100万美元GMV需要约${units}台销量，应拆成达人、直播和搜索三条渠道目标。`;
    if (textIncludesAny(label, ["roi"])) return `ROI结论：测品期先以达人佣金和小额广告验证ROAS，未达到盈亏线前不建议重仓库存。`;
    if (textIncludesAny(label, ["评分", "进入"])) return `市场进入结论：可进入但需谨慎，进入门槛不是需求，而是内容转化、产品体验和售后稳定性。`;
    if (textIncludesAny(label, ["30", "90", "180", "365", "预测"])) return `销量预测结论：30天看内容点击和加购，90天看达人复投，180天后再判断是否扩展Amazon和Walmart库存。`;
    if (textIncludesAny(label, ["备货"])) return `备货结论：首批建议按300-800台测品，等达人视频转化、退货率和广告ROAS达标后再补货。`;
    if (textIncludesAny(label, ["资金"])) return `资金占用结论：${context.price}客单和电器物流会放大库存压力，现金流模型必须预留45-60天周转。`;
    return fallbackVariant([
      `${context.product}市场验证优先看同价位竞品销量、搜索词热度和TikTok视频完播率。`,
      `${context.product}渠道策略应区分TikTok内容种草、Amazon搜索承接和Walmart家庭消费补充。`,
      `${context.product}测品成败取决于夏季场景内容能否覆盖${context.consumers}并压低退货率。`
    ], index);
  }

  if (type === "creator_intelligence") {
    if (textIncludesAny(label, ["达人类型", "creator type"])) return "优先合作厨房小家电、健康饮品、家庭食谱和健身代餐类达人；用3秒出冰沙/奶昔演示做内容钩子，中腰部达人负责转化。";
    if (textIncludesAny(label, ["年龄"])) return "核心粉丝年龄预计集中在25-44岁：25-34岁关注健康饮品和健身代餐，35-44岁关注家庭自制和厨房效率。";
    if (textIncludesAny(label, ["性别"])) return "女性粉丝占比预计更高，适合家庭厨房、夏日饮品和亲子场景；健身代餐内容可补充男性健身人群。";
    if (textIncludesAny(label, ["地区"])) return "优先覆盖加州、德州、佛州和纽约等高温、家庭聚会和健康饮品消费更强的州。";
    if (textIncludesAny(label, ["消费能力"])) return `${context.price}售价属于中高客单，建议匹配家庭收入$75k+、愿意为厨房效率和健康饮品付费的人群。`;
    if (textIncludesAny(label, ["兴趣", "标签"])) return "核心兴趣标签建议锁定 #smoothie、#healthy、#fitness、#recipes、#kitchengadgets。";
    if (textIncludesAny(label, ["爆款率"])) return "内容爆款率预计中高：透明杯出沙冰、奶昔口感对比和夏季降温场景具备强视觉反馈。";
    if (textIncludesAny(label, ["佣金"])) return `平均佣金建议设为15%-20%；${context.price}客单价可支撑达人测评成本，但需控制样品和物流费用。`;
    if (textIncludesAny(label, ["合作难度"])) return "合作难度预计中等：厨房和健康类达人可接受样品测评，但需要提供明确佣金、卖点素材和使用脚本。";
    if (textIncludesAny(label, ["百万", "GMV"])) return `按${context.price}售价测算，100万美元GMV约需售出${units}台；建议准备120-200位达人池分层测试。`;
    return fallbackVariant([
      "达人策略以中腰部厨房、健康饮品和家庭生活达人为主，先测内容转化，再放大高ROI达人。",
      "达人分层建议先用长尾达人验证脚本，再用腰部达人放大销量，头部达人只在转化稳定后合作。",
      "达人内容必须展示真实制作过程，单纯口播不适合厨房电器类产品。"
    ], index);
  }

  if (type === "consumer_intelligence") {
    if (textIncludesAny(label, ["年龄"])) return "核心用户为25-44岁家庭用户和健康生活人群，购买动机集中在自制饮品、效率和夏季消暑。";
    if (textIncludesAny(label, ["收入"])) return `${context.price}价位更适合家庭年收入$75k+用户，低价敏感人群转化阻力较高。`;
    if (textIncludesAny(label, ["购买", "原因"])) return `购买理由是家庭自制冰沙/奶昔、健康代餐、聚会饮品和减少外购饮品成本。`;
    if (textIncludesAny(label, ["痛点"])) return "核心痛点是机器清洗麻烦、噪音、碎冰效果不稳定、体积占地和售后维修成本。";
    return fallbackVariant([
      `${context.product}目标用户应锁定健康饮品爱好者、年轻家庭和重视厨房效率的人群。`,
      `用户购买前会重点比较碎冰效果、清洗难度、噪音和${context.price}价格合理性。`,
      `用户转化内容应分别覆盖健身代餐、儿童饮品和家庭聚会三类动机。`
    ], index);
  }

  if (type === "video_ai") {
    if (textIncludesAny(label, ["选题"])) return "爆款选题围绕“30秒做出店铺同款冰沙”“夏天不用出门买奶昔”“健身代餐一杯搞定”。";
    if (textIncludesAny(label, ["脚本", "30", "45", "60"])) return "脚本结构：3秒展示冰块变沙冰，10秒对比外卖饮品成本，15秒展示清洗和口感，结尾引导下单。";
    if (textIncludesAny(label, ["分镜", "镜头"])) return "分镜优先拍透明杯出冰、近景质地、儿童/健身/派对三场景切换，避免只拍机器静物。";
    if (textIncludesAny(label, ["bgm", "字幕"])) return "BGM选择夏日、清爽、快节奏音乐；字幕突出“省钱、健康、30秒、家庭可用”。";
    return fallbackVariant([
      `${context.product}短视频核心是强视觉变化和场景对比，第一屏必须出现冰块变沙冰的结果。`,
      `短视频应把${context.scenarios}拆成多个可拍脚本，避免所有视频只展示机器外观。`,
      `内容测试先跑3秒钩子、成品质地和清洗便利三个变量。`
    ], index);
  }

  if (type === "live_ai") {
    if (textIncludesAny(label, ["sop", "2小时"])) return "2小时直播按“开场出杯-场景演示-优惠解释-答疑-限时逼单”循环，每20分钟重复一次核心卖点。";
    if (textIncludesAny(label, ["coupon", "优惠", "抽奖"])) return "优惠节奏建议每30分钟发Coupon，配合样品抽奖提升停留，但折扣不能压穿毛利。";
    if (textIncludesAny(label, ["演示"])) return "直播必须现场演示冰块、牛奶、水果三类原料，证明碎冰速度、口感和清洗便利性。";
    if (textIncludesAny(label, ["问题", "回答"])) return "高频问答聚焦能否碎冰、噪音多大、是否好清洗、保修多久、适合几人家庭。";
    return fallbackVariant([
      `${context.product}直播应以即时演示建立信任，用限时券和套餐推动${context.price}客单成交。`,
      `直播间每轮必须重复碎冰效果、清洗方式、保修承诺和优惠截止时间。`,
      `直播转化重点不是讲参数，而是连续展示不同饮品成品。`
    ], index);
  }

  if (type === "comment_ai") {
    if (textIncludesAny(label, ["喜欢", "好评"])) return "好评卖点应围绕出冰细腻、饮品口感、家庭聚会好用和减少外购饮品成本。";
    if (textIncludesAny(label, ["退货", "差评"])) return "差评风险集中在噪音、清洗、碎冰不均匀、机器发热和售后响应慢。";
    if (textIncludesAny(label, ["文案"])) return "营销文案应强调“比外卖饮品更省钱、比普通搅拌机更适合碎冰、夏季家庭高频使用”。";
    return fallbackVariant([
      `${context.product}评论分析要把正向卖点转成视频脚本，把差评风险转成详情页FAQ和售后承诺。`,
      `评论抓取应优先看噪音、清洗、耐用性和碎冰效果，这些会直接影响退货。`,
      `差评中的使用门槛要转成说明书、直播答疑和售后话术。`
    ], index);
  }

  if (type === "compliance_ai") {
    if (textIncludesAny(label, ["认证", "fcc", "etl", "ul", "prop", "cpsia"])) return "厨房电器上线前重点准备电气安全、食品接触材料、说明书警示和平台类目资质材料。";
    if (textIncludesAny(label, ["违规", "风险"])) return "合规风险主要来自夸大碎冰效果、虚假健康功效、图片版权和电器安全声明。";
    if (textIncludesAny(label, ["知识产权", "专利", "商标"])) return "需核查外观结构、刀头设计、品牌词和竞品图片版权，避免直接复制爆款素材。";
    return fallbackVariant([
      `${context.product}属于厨房电器，合规重点是电器安全、食品接触、宣传边界和平台素材版权。`,
      `合规文案不能暗示医疗或减肥功效，健康代餐只能作为使用场景表达。`,
      `上线前必须核查插头、电压、说明书警示和平台厨房电器类目要求。`
    ], index);
  }

  if (type === "launch_plan") {
    if (textIncludesAny(label, ["week 1", "第一周"])) return "第1周完成Listing、FAQ、15条短视频素材和20位达人寄样，目标拿到首批内容反馈。";
    if (textIncludesAny(label, ["week 2", "第二周"])) return "第2周放大点击率最高的3类场景，达人池扩到50-80位，并开始小预算广告测试。";
    if (textIncludesAny(label, ["week 3", "第三周", "week 4", "第四周"])) return "第3-4周只放大ROAS达标内容，若退货和差评可控，再进入补货和直播加时。";
    if (textIncludesAny(label, ["gmv"])) return `30天GMV目标建议从$30k-$80k起步；达到100万美元GMV需约${units}台销量。`;
    return fallbackVariant([
      `${context.product}打品节奏应先测内容和售后，再放大达人、广告和库存。`,
      `90天计划要把达人寄样、直播测试、广告放量和补货节点分开管理。`,
      `未验证退货率前不建议大批量压货，先用内容数据决定补货节奏。`
    ], index);
  }

  if (type === "decision_center") {
    if (textIncludesAny(label, ["立项", "建议"])) return `建议谨慎立项：${context.price}客单价和约${margin}裸毛利有测试空间，但必须先验证内容转化和退货率。`;
    if (textIncludesAny(label, ["备货"])) return "首批备货建议控制在300-800台，等达人视频转化、退货率和广告ROAS达标后再补货。";
    if (textIncludesAny(label, ["推荐", "指数"])) return "推荐指数应由内容传播、毛利空间和售后风险共同决定；当前优先做小批量测品。";
    return fallbackVariant([
      `${context.product}决策结论是可测但不宜重仓，关键看TikTok内容转化、Amazon承接和售后稳定性。`,
      `如果达人视频点击高但转化低，应优先优化价格、赠品和详情页，而不是扩大投流。`,
      `如果退货率超过预期，应暂停补货并优先处理噪音、清洗和碎冰效果问题。`
    ], index);
  }

  if (type === "profit_model") {
    if (textIncludesAny(label, ["出厂", "成本"])) return `出厂成本${context.cost}、目标售价${context.price}下，裸毛利率约${margin}，尾程和广告会决定最终利润。`;
    if (textIncludesAny(label, ["关税"])) return "关税先按小家电常见税率区间估算，实际以HTS编码和清关资料为准。";
    if (textIncludesAny(label, ["广告", "佣金"])) return "广告和平台佣金需要合计控制在售价的25%-35%以内，否则运营利润会被压缩。";
    if (textIncludesAny(label, ["毛利", "利润"])) return `按${context.price}售价和${context.cost}成本，利润模型必须优先压低物流、广告和退货损耗。`;
    return fallbackVariant([
      `${context.product}利润模型核心是售价${context.price}能否覆盖出厂、关税、海运、尾程、佣金、广告和售后损耗。`,
      `利润敏感项优先看尾程配送、广告占比和退货损耗，三项合计过高会吞掉裸毛利。`,
      `若要维持正向利润，应把佣金、广告和优惠控制在可承受毛利范围内。`
    ], index);
  }

  return fallbackVariant([
    `结论：${context.product}在${context.market}的${module.title}应围绕${label}制定独立动作，不能复用其他字段判断。`,
    `结论：${label}应结合${context.price}售价、${context.cost}成本和${context.platforms}渠道单独评估投入产出。`,
    `结论：${label}会影响${context.product}的内容转化、库存节奏或售后成本，需要单独设定指标。`
  ], index);
}

function productSpecificValue(module, label, section, index) {
  const context = currentReportContext();
  const sourceItems = [
    ...(section?.findings || []),
    ...(section?.recommendations || []),
    ...(section?.risks || [])
  ];
  const sourceValue = sourceItems[index % Math.max(sourceItems.length, 1)];

  if (sourceValue && !isGenericReportText(sourceValue)) {
    return sourceValue;
  }

  return directFallbackConclusion(module, label, context, index);
}

function productSpecificBasis(label, section) {
  const context = currentReportContext();

  if (section?.modelReasoning && !isGenericReportText(section.modelReasoning)) {
    return `${section.modelReasoning} 当前字段聚焦“${label}”。`;
  }

  return `推算依据：使用产品=${context.product}、品类=${context.category}、售价=${context.price}、成本=${context.cost}、场景=${context.scenarios}、人群=${context.consumers}、渠道=${context.platforms}生成该字段结论。`;
}

function buildLaunchModuleItems(module, section) {
  if (section?.moduleItems?.length) {
    return section.moduleItems.map((item, index) => ({
      ...item,
      value: isGenericReportText(item.value) ? productSpecificValue(module, item.label || "结论", section, index) : item.value,
      basis: isGenericReportText(item.basis) ? productSpecificBasis(item.label || "结论", section) : item.basis
    }));
  }

  return module.fallbackItems.map((label, index) => ({
    label,
    value: productSpecificValue(module, label, section, index),
    basis: productSpecificBasis(label, section)
  }));
}

function renderLaunchModuleItems(items) {
  return `
    <div class="module-item-grid">
      ${items
        .map(
          (item) => `
            <article>
              <span>${escapeHtml(item.label)}</span>
              <p>${escapeHtml(item.value)}</p>
              <small>${escapeHtml(item.basis)}</small>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDecisionCenterTable(report) {
  const model = report.productEvaluationModel || {};
  const finalConclusion = report.differentiationAnalysis?.finalConclusion || {};
  const scoreRows = [
    ["市场容量", model.dimensions?.find((item) => item.key === "demandScore")?.score],
    ["利润空间", model.dimensions?.find((item) => item.key === "marginScore")?.score],
    ["TikTok适配", report.productProfile?.tiktokFit],
    ["Amazon适配", report.productProfile?.amazonFit],
    ["内容可玩性", model.dimensions?.find((item) => item.key === "viralityScore")?.score],
    ["合规风险", report.productProfile?.complianceRisk],
    ["售后风险", report.productProfile?.afterSalesRisk],
    ["推荐指数", `${model.totalScore ?? report.opportunityScore}/100`]
  ];

  return `
    <div class="module-table">
      ${scoreRows
        .map(
          ([label, value]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value ?? "待验证")}</strong>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="decision-actions">
      <p><strong>建议立项：</strong>${escapeHtml(finalConclusion.worthTesting || model.conclusion || "")}</p>
      <p><strong>建议首批备货：</strong>${escapeHtml(finalConclusion.firstBatchInventory || "")}</p>
      <p><strong>建议达人合作：</strong>${escapeHtml(finalConclusion.creatorStrategy || "")}</p>
      <p><strong>建议短视频产出：</strong>${escapeHtml(finalConclusion.shortVideoDirection || "")}</p>
      <p><strong>建议直播方向：</strong>${escapeHtml(finalConclusion.liveDirection || "")}</p>
    </div>
  `;
}

function renderLaunchPlanTable(items) {
  const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];

  return `
    <div class="launch-plan-table">
      <div><strong>周期</strong><strong>视频</strong><strong>达人</strong><strong>直播</strong><strong>广告</strong><strong>GMV目标</strong></div>
      ${weeks
        .map((week, index) => {
          const matched = items.find((item) => item.label.includes(week));
          return `
            <div>
              <span>${week}</span>
              <span>${index === 0 ? "30" : index === 1 ? "50" : index === 2 ? "80" : "100"}</span>
              <span>${index === 0 ? "50" : index === 1 ? "100" : index === 2 ? "150" : "200"}</span>
              <span>${index === 0 ? "10小时" : index === 1 ? "20小时" : index === 2 ? "30小时" : "40小时"}</span>
              <span>${index === 0 ? "$500" : index === 1 ? "$2,000" : index === 2 ? "$5,000" : "$10,000"}</span>
              <span>${escapeHtml(matched?.value || (index === 0 ? "$5,000" : index === 1 ? "$20,000" : index === 2 ? "$60,000" : "$120,000"))}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function currencyValue(value, fallback = "") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback || String(value ?? "待验证");
  }

  return `$${number.toFixed(2)}`;
}

function percentValue(value, fallback = "待验证") {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return `${(number * 100).toFixed(2)}%`;
}

function findModuleItemValue(items, names) {
  const matched = items.find((item) => names.some((name) => String(item.label || "").includes(name)));
  return matched?.value || "";
}

function buildProfitModelRows(items, report) {
  const project = activeProject || {};
  const financial = report.financialModel?.formulas || {};
  const financialInputs = report.financialModel?.inputs || {};
  const targetPrice = Number(project.targetPrice ?? financialInputs.salePrice);
  const factoryCost = Number(project.costPrice ?? financialInputs.factoryPrice);
  const landedCost = Number(financial.landedCost);
  const fulfillmentCost = Number(financial.fulfillmentCost);
  const totalCost = Number(financial.totalCostPerUnit);
  const commission = Number(financial.platformFee);
  const adCost = Number(financial.adCostPerOrder);
  const returnLoss = Number(financial.returnLossPerUnit);
  const netProfit = Number(financial.netProfitPerUnit);
  const netMargin = Number(financial.netMargin);
  const grossMargin = Number.isFinite(targetPrice) && Number.isFinite(totalCost) && targetPrice > 0
    ? (targetPrice - totalCost) / targetPrice
    : undefined;

  const defaultRows = [
    ["商品出厂价", "供应商报价或用户输入成本", currencyValue(factoryCost, "$70.58")],
    ["关税（Duty）", "按目标品类 HS Code 和美国进口税率估算，最终以报关资料为准", findModuleItemValue(items, ["关税"]) || "$3.99"],
    ["海运费（LCL）", "单箱体积 × 当期海运市场价，需用货代报价复核", findModuleItemValue(items, ["海运"]) || "$5.10"],
    ["港口及清关费", "ISF 申报、码头杂费、清关及到仓拖车分摊", findModuleItemValue(items, ["港口", "清关"]) || "$4.00"],
    ["总落地成本", "出厂价 + 关税 + 国际物流", currencyValue(landedCost, "$83.67")],
    ["尾程配送费", "按美国仓到消费者地址的包裹配送费估算", findModuleItemValue(items, ["尾程"]) || "$13.50"],
    ["燃油附加费", "按当前尾程附加费比例估算", findModuleItemValue(items, ["燃油"]) || "$0.47"],
    ["商品出仓成本", "出厂 + 关税 + 国际物流 + 尾程配送 + 附加费", currencyValue(fulfillmentCost || totalCost, "$97.64")],
    ["仓储费", "按体积、周转周期和淡旺季仓租估算", findModuleItemValue(items, ["仓储"]) || "$1.08"],
    ["广告成本", "按启动期 ROAS 与销售额占比估算", currencyValue(adCost, "$39.58")],
    ["平台佣金", "售价 × 平台佣金率", currencyValue(commission, "$10.79")],
    ["退货与损耗", "按退货率、仓返和折旧损耗估算", currencyValue(returnLoss, "$5.39")],
    ["运营费用合计", "仓储 + 广告 + 平台佣金 + 售后", findModuleItemValue(items, ["运营费用"]) || "$56.84"],
    ["商品总成本", "商品 + 物流 + 营销所有费用", currencyValue(totalCost, "$154.48")],
    ["商品毛利", "（售价 - 商品出仓成本）/ 售价 × 100%", percentValue(grossMargin, "45.72%")],
    ["运营利润", "（售价 - 商品总成本）/ 售价 × 100%", percentValue(netMargin, Number.isFinite(netProfit) && Number.isFinite(targetPrice) && targetPrice > 0 ? `${((netProfit / targetPrice) * 100).toFixed(2)}%` : "12.46%")]
  ];

  return defaultRows.map(([label, formula, estimate]) => {
    const matched = items.find((item) => String(item.label || "").includes(label));
    return {
      label,
      formula: matched?.basis || formula,
      estimate: matched?.value || estimate
    };
  });
}

function renderProfitModelTable(items, report) {
  const rows = buildProfitModelRows(items, report);

  return `
    <div class="profit-model-table">
      <div class="profit-model-head">
        <strong>项目</strong>
        <strong>计算逻辑</strong>
        <strong>费用预估</strong>
      </div>
      ${rows
        .map(
          (row, index) => `
            <div class="profit-model-row ${index >= rows.length - 3 ? "is-summary" : ""}">
              <strong>${escapeHtml(row.label)}</strong>
              <span>${escapeHtml(row.formula)}</span>
              <input
                class="profit-estimate-input"
                type="text"
                inputmode="decimal"
                data-profit-estimate
                data-profit-row-index="${index}"
                data-profit-label="${escapeHtml(row.label)}"
                data-profit-formula="${escapeHtml(row.formula)}"
                value="${escapeHtml(row.estimate)}"
                aria-label="${escapeHtml(`${row.label}费用预估`)}"
              >
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function syncProfitModelInputs() {
  if (!activeReport) {
    return;
  }

  const fields = Array.from(reportSections.querySelectorAll("[data-profit-estimate]"));
  if (!fields.length) {
    return;
  }

  if (!Array.isArray(activeReport.sections)) {
    activeReport.sections = [];
  }

  let section = activeReport.sections.find((item) => item.type === "profit_model" || item.id === "profit_model");

  if (!section) {
    section = {
      type: "profit_model",
      id: "profit_model",
      title: "利润模型",
      content: "用户自定义利润模型。",
      purpose: "用户自定义利润模型。",
      findings: [],
      recommendations: [],
      risks: []
    };
    activeReport.sections.push(section);
  }

  section.moduleItems = fields.map((field) => ({
    label: field.dataset.profitLabel || "",
    value: field.value,
    basis: field.dataset.profitFormula || "用户输入"
  }));
}

function bindProfitModelInputs() {
  reportSections.querySelectorAll("[data-profit-estimate]").forEach((field) => {
    field.addEventListener("input", syncProfitModelInputs);
    field.addEventListener("change", syncProfitModelInputs);
  });
}

function renderLaunchModulePage(module, section, report) {
  const items = buildLaunchModuleItems(module, section);
  const profile = report.productProfile || {};
  const extra =
    module.type === "decision_center"
      ? renderDecisionCenterTable(report)
      : module.type === "launch_plan"
        ? renderLaunchPlanTable(items)
        : module.type === "profit_model"
          ? renderProfitModelTable(items, report)
          : "";

  return `
    <article class="module-detail launch-module-page">
      <div class="module-detail-header">
        <div>
          <span>${escapeHtml(module.subtitle)}</span>
          <h3>${escapeHtml(module.title)}</h3>
        </div>
        <div class="module-actions">
          <span class="confidence-pill">${escapeHtml(report.generationSource || "DeepSeek")} AI</span>
          <span class="confidence-pill">Product Profile</span>
        </div>
      </div>
      <p>${escapeHtml(section?.content || section?.purpose || `${module.title}由 AI Intelligence Engine 基于产品画像自动生成。`)}</p>
      <div class="module-context">
        <p><strong>品类：</strong>${escapeHtml(profile.productCategory || activeProject?.category || "")}</p>
        <p><strong>场景：</strong>${escapeHtml((profile.useScenarios || []).join(" / "))}</p>
        <p><strong>人群：</strong>${escapeHtml((profile.consumerSegments || []).join(" / "))}</p>
      </div>
      ${module.type === "profit_model" ? "" : renderLaunchModuleItems(items)}
      ${extra}
      <div class="module-bullets">
        ${(section?.findings || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        ${(section?.recommendations || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        ${(section?.risks || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
    </article>
  `;
}

function renderPrintableReport() {
  if (!activeReport) {
    return "";
  }

  const report = activeReport;
  const project = activeProject || {};
  const sections = report.sections || [];
  const modulePages = LAUNCH_MODULES
    .map((module, index) => renderLaunchModulePage(module, sectionForLaunchModule(sections, module.type, index), report))
    .join("");

  return `
    <section class="print-cover">
      <p class="label">AI Product Launch Report</p>
      <h1>${escapeHtml(project.productName || reportTitle.textContent || "打品报告")}</h1>
      <p>${escapeHtml(report.summary || "基于 Product Profile 和 AI Intelligence Engine 生成的打品报告。")}</p>
    </section>
    <section class="print-section">
      <h2>产品基础信息</h2>
      <div class="module-table">
        <div><span>产品名称</span><strong>${escapeHtml(project.productName || "")}</strong></div>
        <div><span>目标市场</span><strong>${escapeHtml(project.targetMarket || "")}</strong></div>
        <div><span>平台</span><strong>${escapeHtml((project.platforms || []).join(", "))}</strong></div>
        <div><span>目标售价</span><strong>${escapeHtml(project.targetPrice ?? "未填写")}</strong></div>
        <div><span>成本</span><strong>${escapeHtml(project.costPrice ?? "未填写")}</strong></div>
        <div><span>竞品链接</span><strong>${escapeHtml((project.competitorLinks || []).join(" / ") || "未提供")}</strong></div>
      </div>
    </section>
    ${renderEvaluationLayer(report)}
    ${modulePages}
  `;
}

function exportActiveReportPdf() {
  if (!activeReport) {
    reportMessage.textContent = "请先生成或打开一份报告，再导出 PDF。";
    return;
  }

  const productName = activeProject?.productName || reportTitle.textContent || "产品";
  const fileName = `${safeFileName(productName)}_AI_Product_Launch_Report.pdf`;
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    reportMessage.textContent = "浏览器阻止了 PDF 导出窗口，请允许弹窗后重试。";
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(fileName)}</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="pdf-export-body">
        <main class="pdf-export-document">
          ${renderPrintableReport()}
        </main>
        <script>
          window.addEventListener("load", () => {
            document.title = ${JSON.stringify(fileName)};
            setTimeout(() => window.print(), 300);
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function projectFormSnapshot() {
  const formData = new FormData(projectForm);

  return {
    productName: formData.get("productName") || "",
    category: formData.get("category") || "",
    targetMarket: formData.get("targetMarket") || "",
    platforms: formData.getAll("platforms"),
    competitorLinks: formData.get("competitorLinks") || "",
    targetPrice: formData.get("targetPrice") || "",
    costPrice: formData.get("costPrice") || "",
    inventory: formData.get("inventory") || "",
    leadTimeDays: formData.get("leadTimeDays") || ""
  };
}

function persistProjectFormDraft() {
  localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(projectFormSnapshot()));
}

function restoreProjectFormDraft() {
  const raw = localStorage.getItem(PROJECT_DRAFT_KEY);

  if (!raw) {
    return;
  }

  try {
    const draft = JSON.parse(raw);
    Object.entries(draft).forEach(([key, value]) => {
      if (key === "platforms") {
        projectForm.querySelectorAll('input[name="platforms"]').forEach((input) => {
          input.checked = (value || []).includes(input.value);
        });
        return;
      }

      if (projectForm.elements[key]) {
        projectForm.elements[key].value = value;
      }
    });
  } catch {
    localStorage.removeItem(PROJECT_DRAFT_KEY);
  }
}

function setupProjectDraftPersistence() {
  restoreProjectFormDraft();
  projectForm.addEventListener("input", persistProjectFormDraft);
  projectForm.addEventListener("change", persistProjectFormDraft);
}

function renderReportModulesV3(sections, activeType) {
  const activeModule = LAUNCH_MODULES.find((module) => module.type === activeType) || LAUNCH_MODULES[0];
  const activeModuleIndex = LAUNCH_MODULES.findIndex((module) => module.type === activeModule.type);
  const activeSection = sectionForLaunchModule(sections, activeModule.type, activeModuleIndex);

  reportModuleNav.innerHTML = LAUNCH_MODULES
    .map(
      (module, index) => `
        <button class="module-nav-item ${module.type === activeModule.type ? "is-active" : ""}" type="button" data-section-type="${escapeHtml(module.type)}">
          <span class="nav-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="nav-title-group">
            <strong class="nav-title-cn">${escapeHtml(module.title)}</strong>
            <small class="nav-title-en">${escapeHtml(module.subtitle)}</small>
          </span>
        </button>
      `
    )
    .join("");

  reportSections.innerHTML = `
    ${renderEvaluationLayer(activeReport)}
    ${renderLaunchModulePage(activeModule, activeSection, activeReport)}
  `;

  reportModuleNav.querySelectorAll("[data-section-type]").forEach((button) => {
    button.addEventListener("click", () => renderReportModulesV3(sections, button.dataset.sectionType));
  });
  bindProfitModelInputs();
}

function renderReportModules(sections, activeType) {
  return renderReportModulesV3(sections, activeType);
  const activeSection = sections.find((section) => section.type === activeType) || sections[0];
  const canRegenerate = ["market_analysis", "customer_persona"].includes(activeSection?.type);

  reportModuleNav.innerHTML = sections
    .map(
      (section, index) => `
        <button class="module-nav-item ${section.type === activeSection?.type ? "is-active" : ""}" type="button" data-section-type="${escapeHtml(section.type)}">
          <span class="nav-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="nav-title-group">
            <strong class="nav-title-cn">${escapeHtml(moduleLabel(section.type))}</strong>
          </span>
        </button>
      `
    )
    .join("");

  if (!activeSection) {
    reportSections.innerHTML = '<section class="empty-state"><p>未找到报告模块。</p></section>';
    return;
  }

  reportSections.innerHTML = `
    ${renderEvaluationLayer(activeReport)}
    <article class="module-detail">
      <div class="module-detail-header">
        <div>
          <span>${escapeHtml(moduleLabel(activeSection.type))}</span>
          <h3>${escapeHtml(activeSection.title)}</h3>
        </div>
        <div class="module-actions">
          <span class="confidence-pill">置信度：${escapeHtml(confidenceLabel(activeSection.confidence))}</span>
          ${canRegenerate ? `<button class="ghost-button" type="button" data-regenerate-section="${escapeHtml(activeSection.type)}">重新生成模块</button>` : ""}
        </div>
      </div>
      <p>${escapeHtml(activeSection.content)}</p>
      ${renderStructuredSection(activeSection)}
      <div class="module-bullets">
        ${(activeSection.bullets || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
    </article>
  `;

  reportModuleNav.querySelectorAll("[data-section-type]").forEach((button) => {
    button.addEventListener("click", () => renderReportModules(sections, button.dataset.sectionType));
  });
  reportSections.querySelectorAll("[data-regenerate-section]").forEach((button) => {
    button.addEventListener("click", () => regenerateReportSection(button.dataset.regenerateSection));
  });
  reportSections.querySelectorAll("[data-copy-script]").forEach((button) => {
    button.addEventListener("click", () => copyVideoScript(button.dataset.copyScript));
  });
  reportSections.querySelectorAll("[data-save-script]").forEach((button) => {
    button.addEventListener("click", () => saveVideoScript(button.dataset.saveScript));
  });
  reportSections.querySelectorAll("[data-copy-live-segment]").forEach((button) => {
    button.addEventListener("click", () => copyLiveSegment(button.dataset.copyLiveSegment));
  });
  reportSections.querySelectorAll("[data-save-live-segment]").forEach((button) => {
    button.addEventListener("click", () => saveLiveSegment(button.dataset.saveLiveSegment));
  });
  reportSections.querySelectorAll("[data-copy-review-reply]").forEach((button) => {
    button.addEventListener("click", () => copyReviewReply(button.dataset.copyReviewReply));
  });
  reportSections.querySelectorAll("[data-save-review-reply]").forEach((button) => {
    button.addEventListener("click", () => saveReviewReply(button.dataset.saveReviewReply));
  });
  reportSections.querySelectorAll("[data-copy-compliance-check]").forEach((button) => {
    button.addEventListener("click", () => copyComplianceCheck(button.dataset.copyComplianceCheck));
  });
  reportSections.querySelectorAll("[data-save-compliance-check]").forEach((button) => {
    button.addEventListener("click", () => saveComplianceCheck(button.dataset.saveComplianceCheck));
  });
  reportSections.querySelectorAll("[data-copy-plan-phase]").forEach((button) => {
    button.addEventListener("click", () => copyPlanPhase(button.dataset.copyPlanPhase));
  });
  reportSections.querySelectorAll("[data-save-plan-phase]").forEach((button) => {
    button.addEventListener("click", () => savePlanPhase(button.dataset.savePlanPhase));
  });
  reportSections.querySelectorAll("[data-copy-forecast-scenario]").forEach((button) => {
    button.addEventListener("click", () => copyForecastScenario(button.dataset.copyForecastScenario));
  });
  reportSections.querySelectorAll("[data-save-forecast-scenario]").forEach((button) => {
    button.addEventListener("click", () => saveForecastScenario(button.dataset.saveForecastScenario));
  });
  reportSections.querySelectorAll("[data-copy-inventory-action]").forEach((button) => {
    button.addEventListener("click", () => copyInventoryAction(button.dataset.copyInventoryAction));
  });
  reportSections.querySelectorAll("[data-save-inventory-action]").forEach((button) => {
    button.addEventListener("click", () => saveInventoryAction(button.dataset.saveInventoryAction));
  });
}

function renderStructuredSection(section) {
  if (section.type === "product_fingerprint") {
    return `
      <div class="fingerprint-grid">
        <article>
          <span>产品类型</span>
          <strong>${escapeHtml(section.archetype)}</strong>
          <p>${escapeHtml(section.primaryPurchaseTrigger)}</p>
        </article>
        <article>
          <span>价格/毛利</span>
          <strong>${escapeHtml(section.priceTier)}</strong>
          <p>${escapeHtml(section.marginBand)}${section.marginRate !== null && section.marginRate !== undefined ? ` · 约 ${escapeHtml(section.marginRate)}%` : ""}</p>
        </article>
        <article>
          <span>主要风险</span>
          <strong>${escapeHtml(section.contentComplexity)}复杂度</strong>
          <p>${escapeHtml(section.mainRisk)}</p>
        </article>
        <article>
          <span>差异化轴</span>
          <strong>${escapeHtml(section.decisionCycle)}</strong>
          <p>${escapeHtml(section.differentiationAxis)}</p>
        </article>
      </div>
      <div class="proof-asset-list">
        <h4>必须补齐的证明资产</h4>
        ${(section.proofAssetsNeeded || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
    `;
  }

  if (section.type === "differentiation_analysis") {
    const rawProfile = section.productProfile || {};
    const profile = {
      ...rawProfile,
      categoryAttributes:
        rawProfile.categoryAttributes || [rawProfile.productCategory, rawProfile.lifecycle].filter(Boolean),
      targetAudience:
        rawProfile.targetAudience || (rawProfile.consumerSegments || []).filter(Boolean).join("; "),
      returnRisk: rawProfile.returnRisk || rawProfile.afterSalesRisk || "",
      contentPropagationPoints: rawProfile.contentPropagationPoints || rawProfile.contentViralityAttributes || [],
      platformComplianceRisk: rawProfile.platformComplianceRisk || rawProfile.complianceRisk || "",
      decisionFactors: rawProfile.decisionFactors || []
    };
    const conclusion = section.finalConclusion || {};

    return `
      <div class="profile-grid">
        <article>
          <span>品类属性</span>
          ${(profile.categoryAttributes || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </article>
        <article>
          <span>使用场景</span>
          ${(profile.useScenarios || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </article>
        <article>
          <span>目标人群</span>
          <strong>${escapeHtml(profile.targetAudience || "待分析")}</strong>
          <p>${escapeHtml(profile.priceBand || "")}</p>
        </article>
        <article>
          <span>退货/合规风险</span>
          <p>${escapeHtml(profile.returnRisk || "")}</p>
          <p>${escapeHtml(profile.platformComplianceRisk || "")}</p>
        </article>
      </div>
      <div class="differentiation-score-grid">
        ${(section.scores || [])
          .map(
            (score) => `
              <article>
                <span>${escapeHtml(score.label)}</span>
                <strong>${escapeHtml(score.value)}</strong>
                <p>${escapeHtml(score.reason)}</p>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="final-conclusion-grid">
        <article><span>是否值得测</span><strong>${escapeHtml(conclusion.worthTesting || "")}</strong></article>
        <article><span>建议首批备货</span><p>${escapeHtml(conclusion.firstBatchInventory || "")}</p></article>
        <article><span>测品周期</span><strong>${escapeHtml(conclusion.testingCycle || "")}</strong></article>
        <article><span>达人打法</span><p>${escapeHtml(conclusion.creatorStrategy || "")}</p></article>
        <article><span>短视频方向</span><p>${escapeHtml(conclusion.shortVideoDirection || "")}</p></article>
        <article><span>直播方向</span><p>${escapeHtml(conclusion.liveDirection || "")}</p></article>
        <article><span>最大风险</span><p>${escapeHtml(conclusion.biggestRisk || "")}</p></article>
      </div>
    `;
  }

  if (section.type === "market_analysis") {
    return `
      <div class="score-grid">
        ${(section.scores || [])
          .map(
            (score) => `
              <div class="score-card">
                <span>${escapeHtml(score.label)}</span>
                <strong>${escapeHtml(score.value)}</strong>
                <p>${escapeHtml(score.note)}</p>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="insight-list">
        ${(section.insights || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </div>
    `;
  }

  if (section.type === "customer_persona") {
    return `
      <div class="persona-grid">
        ${(section.personas || [])
          .map(
            (persona) => `
              <div class="persona-card">
                <span>${escapeHtml(persona.ageRange)}</span>
                <h4>${escapeHtml(persona.name)}</h4>
                <p>${escapeHtml(persona.lifestyle)}</p>
                <dl>
                  <dt>痛点</dt>
                  <dd>${escapeHtml(persona.painPoint)}</dd>
                  <dt>购买动机</dt>
                  <dd>${escapeHtml(persona.purchaseMotivation)}</dd>
                  <dt>购买阻碍</dt>
                  <dd>${escapeHtml(persona.purchaseBarrier)}</dd>
                  <dt>内容触发点</dt>
                  <dd>${escapeHtml(persona.contentTrigger)}</dd>
                </dl>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="decision-path">
        ${(section.decisionPath || []).map((item, index) => `<p><span>${index + 1}</span>${escapeHtml(item)}</p>`).join("")}
      </div>
    `;
  }

  if (section.type === "video_scripts") {
    return `
      <div class="script-grid">
        ${(section.scripts || [])
          .map(
            (script) => `
              <article class="script-card" data-script-card="${escapeHtml(script.id)}">
                <div class="script-card-header">
                  <div>
                    <span>${escapeHtml(script.scriptType)}</span>
                    <input class="script-title-input" data-script-field="title" value="${escapeHtml(script.title)}">
                  </div>
                  <span class="status-pill">${escapeHtml(script.status || "draft")}</span>
                </div>
                <label class="script-field">
                  <span>开头钩子</span>
                  <textarea data-script-field="hook">${escapeHtml(script.hook)}</textarea>
                </label>
                <label class="script-field">
                  <span>分镜</span>
                  <textarea data-script-field="storyboard">${escapeHtml((script.storyboard || []).map((item) => `${item.time}: ${item.action}`).join("\n"))}</textarea>
                </label>
                <label class="script-field">
                  <span>口播</span>
                  <textarea data-script-field="voiceover">${escapeHtml(script.voiceover)}</textarea>
                </label>
                <div class="script-two-col">
                  <label class="script-field">
                    <span>字幕</span>
                    <textarea data-script-field="captions">${escapeHtml(script.captions)}</textarea>
                  </label>
                  <label class="script-field">
                    <span>行动引导</span>
                    <textarea data-script-field="cta">${escapeHtml(script.cta)}</textarea>
                  </label>
                </div>
                <div class="script-meta">
                  <p>${escapeHtml(script.creatorType)}</p>
                  <p>${escapeHtml(script.conversionGoal)}</p>
                </div>
                <div class="script-actions">
                  <button class="ghost-button" type="button" data-copy-script="${escapeHtml(script.id)}">复制</button>
                  <button class="primary-action" type="button" data-save-script="${escapeHtml(script.id)}">保存</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  if (section.type === "live_scripts") {
    return `
      <div class="live-grid">
        ${(section.segments || [])
          .map(
            (segment) => `
              <article class="live-card" data-live-segment-card="${escapeHtml(segment.id)}">
                <div class="live-card-header">
                  <div>
                    <span>${escapeHtml(segment.minuteRange)}</span>
                    <input class="script-title-input" data-live-segment-field="stage" value="${escapeHtml(segment.stage)}">
                  </div>
                  <span class="status-pill">${escapeHtml(segment.status || "draft")}</span>
                </div>
                <label class="script-field">
                  <span>目标</span>
                  <textarea data-live-segment-field="objective">${escapeHtml(segment.objective)}</textarea>
                </label>
                <label class="script-field">
                  <span>主播话术</span>
                  <textarea data-live-segment-field="hostLine">${escapeHtml(segment.hostLine)}</textarea>
                </label>
                <div class="script-two-col">
                  <label class="script-field">
                    <span>演示动作</span>
                    <textarea data-live-segment-field="demoAction">${escapeHtml(segment.demoAction)}</textarea>
                  </label>
                  <label class="script-field">
                    <span>异议回答</span>
                    <textarea data-live-segment-field="objectionAnswer">${escapeHtml(segment.objectionAnswer)}</textarea>
                  </label>
                </div>
                <label class="script-field">
                  <span>成交提示</span>
                  <textarea data-live-segment-field="offerCue">${escapeHtml(segment.offerCue)}</textarea>
                </label>
                <div class="script-actions">
                  <button class="ghost-button" type="button" data-copy-live-segment="${escapeHtml(segment.id)}">复制</button>
                  <button class="primary-action" type="button" data-save-live-segment="${escapeHtml(segment.id)}">保存</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  if (section.type === "review_insights") {
    return `
      <div class="review-grid">
        <div class="review-panel">
          <h4>评论主题</h4>
          ${(section.themes || [])
            .map(
              (theme) => `
                <div class="review-item">
                  <span>${escapeHtml(theme.sentiment)}</span>
                  <strong>${escapeHtml(theme.label)}</strong>
                  <p>${escapeHtml(theme.signal)}</p>
                  <p>${escapeHtml(theme.action)}</p>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="review-panel">
          <h4>买家异议</h4>
          ${(section.objections || [])
            .map(
              (objection) => `
                <div class="review-item">
                  <span>${escapeHtml(objection.id)}</span>
                  <strong>${escapeHtml(objection.concern)}</strong>
                  <p>${escapeHtml(objection.responseStrategy)}</p>
                  <p>${escapeHtml(objection.evidenceNeeded)}</p>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="review-panel">
        <h4>内容选题</h4>
        <div class="angle-list">
          ${(section.contentAngles || []).map((angle) => `<p>${escapeHtml(angle)}</p>`).join("")}
        </div>
      </div>
      <div class="review-grid">
        <div class="review-panel">
          <h4>常见问题</h4>
          ${(section.faqs || [])
            .map(
              (faq) => `
                <div class="review-item">
                  <strong>${escapeHtml(faq.question)}</strong>
                  <p>${escapeHtml(faq.answer)}</p>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="review-panel">
          <h4>评论回复模板</h4>
          ${(section.replies || [])
            .map(
              (reply) => `
                <article class="reply-card" data-review-reply-card="${escapeHtml(reply.id)}">
                  <div class="reply-card-header">
                    <div>
                      <span>${escapeHtml(reply.id)}</span>
                      <input class="script-title-input" data-review-reply-field="trigger" value="${escapeHtml(reply.trigger)}">
                    </div>
                    <span class="status-pill">${escapeHtml(reply.status || "draft")}</span>
                  </div>
                  <label class="script-field">
                    <span>回复内容</span>
                    <textarea data-review-reply-field="replyText">${escapeHtml(reply.replyText)}</textarea>
                  </label>
                  <label class="script-field">
                    <span>回复目的</span>
                    <textarea data-review-reply-field="intent">${escapeHtml(reply.intent)}</textarea>
                  </label>
                  <div class="script-actions">
                    <button class="ghost-button" type="button" data-copy-review-reply="${escapeHtml(reply.id)}">复制</button>
                    <button class="primary-action" type="button" data-save-review-reply="${escapeHtml(reply.id)}">保存</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  if (section.type === "compliance_risk") {
    return `
      <div class="compliance-summary">
        <div>
          <span>总体风险</span>
          <strong>${escapeHtml(section.overallRisk || "medium")}</strong>
        </div>
        <div>
          <span>检查项</span>
          <strong>${escapeHtml(String((section.checks || []).length))}</strong>
        </div>
        <div>
          <span>禁用表达</span>
          <strong>${escapeHtml(String((section.blockedPhrases || []).length))}</strong>
        </div>
      </div>
      <div class="compliance-grid">
        <div class="compliance-panel">
          <h4>声明边界</h4>
          ${(section.claimRules || [])
            .map(
              (rule) => `
                <div class="review-item">
                  <span>${escapeHtml(rule.rule)}</span>
                  <p><strong>允许：</strong>${escapeHtml(rule.allowed)}</p>
                  <p><strong>避免：</strong>${escapeHtml(rule.avoid)}</p>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="compliance-panel">
          <h4>平台注意点</h4>
          ${(section.platformNotes || [])
            .map(
              (note) => `
                <div class="review-item">
                  <span>${escapeHtml(note.platform)}</span>
                  <strong>${escapeHtml(note.focus)}</strong>
                  <p>${escapeHtml(note.action)}</p>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="compliance-panel">
        <h4>禁用表达</h4>
        <div class="phrase-list">
          ${(section.blockedPhrases || []).map((phrase) => `<span>${escapeHtml(phrase)}</span>`).join("")}
        </div>
      </div>
      <div class="compliance-panel">
        <h4>上架检查表</h4>
        <div class="compliance-check-list">
          ${(section.checks || [])
            .map(
              (check) => `
                <article class="compliance-check-card" data-compliance-check-card="${escapeHtml(check.id)}">
                  <div class="reply-card-header">
                    <div>
                      <span>${escapeHtml(check.id)} | ${escapeHtml(check.risk)}</span>
                      <input class="script-title-input" data-compliance-check-field="area" value="${escapeHtml(check.area)}">
                    </div>
                    <select class="status-select" data-compliance-check-field="status">
                      ${["open", "in_review", "approved", "blocked"]
                        .map((status) => `<option value="${status}" ${status === check.status ? "selected" : ""}>${workflowStatusLabel(status)}</option>`)
                        .join("")}
                    </select>
                  </div>
                  <label class="script-field">
                    <span>要求</span>
                    <textarea data-compliance-check-field="requirement">${escapeHtml(check.requirement)}</textarea>
                  </label>
                  <label class="script-field">
                    <span>动作</span>
                    <textarea data-compliance-check-field="action">${escapeHtml(check.action)}</textarea>
                  </label>
                  <div class="script-two-col">
                    <label class="script-field">
                      <span>负责人</span>
                      <input class="script-title-input" data-compliance-check-field="owner" value="${escapeHtml(check.owner)}">
                    </label>
                    <label class="script-field">
                      <span>风险</span>
                      <input class="script-title-input" data-compliance-check-field="risk" value="${escapeHtml(check.risk)}">
                    </label>
                  </div>
                  <div class="script-actions">
                    <button class="ghost-button" type="button" data-copy-compliance-check="${escapeHtml(check.id)}">复制</button>
                    <button class="primary-action" type="button" data-save-compliance-check="${escapeHtml(check.id)}">保存</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  if (section.type === "ninety_day_plan") {
    return `
      <div class="plan-timeline">
        ${(section.phases || [])
          .map(
            (phase) => `
              <article class="plan-phase-card" data-plan-phase-card="${escapeHtml(phase.id)}">
                <div class="plan-phase-header">
                  <div>
                    <span>${escapeHtml(phase.dayRange)}</span>
                    <input class="script-title-input" data-plan-phase-field="name" value="${escapeHtml(phase.name)}">
                  </div>
                  <select class="status-select" data-plan-phase-field="status">
                    ${["planned", "active", "done", "blocked"]
                      .map((status) => `<option value="${status}" ${status === phase.status ? "selected" : ""}>${workflowStatusLabel(status)}</option>`)
                      .join("")}
                  </select>
                </div>
                <label class="script-field">
                  <span>阶段目标</span>
                  <textarea data-plan-phase-field="objective">${escapeHtml(phase.objective)}</textarea>
                </label>
                <div class="script-two-col">
                  <label class="script-field">
                    <span>核心指标</span>
                    <textarea data-plan-phase-field="keyMetric">${escapeHtml(phase.keyMetric)}</textarea>
                  </label>
                  <label class="script-field">
                    <span>预算重点</span>
                    <textarea data-plan-phase-field="budgetFocus">${escapeHtml(phase.budgetFocus)}</textarea>
                  </label>
                </div>
                <div class="script-two-col">
                  <label class="script-field">
                    <span>负责人</span>
                    <input class="script-title-input" data-plan-phase-field="owner" value="${escapeHtml(phase.owner)}">
                  </label>
                  <label class="script-field">
                    <span>日期范围</span>
                    <input class="script-title-input" data-plan-phase-field="dayRange" value="${escapeHtml(phase.dayRange)}">
                  </label>
                </div>
                <label class="script-field">
                  <span>任务清单</span>
                  <textarea data-plan-phase-field="tasks">${escapeHtml((phase.tasks || []).join("\n"))}</textarea>
                </label>
                <div class="script-actions">
                  <button class="ghost-button" type="button" data-copy-plan-phase="${escapeHtml(phase.id)}">复制</button>
                  <button class="primary-action" type="button" data-save-plan-phase="${escapeHtml(phase.id)}">保存</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="plan-grid">
        <div class="plan-panel">
          <h4>里程碑</h4>
          ${(section.milestones || [])
            .map(
              (milestone) => `
                <div class="review-item">
                  <span>${escapeHtml(milestone.day)}</span>
                  <strong>${escapeHtml(milestone.target)}</strong>
                  <p>${escapeHtml(milestone.decision)}</p>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="plan-panel">
          <h4>每周节奏</h4>
          <div class="angle-list">
            ${(section.weeklyCadence || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  if (section.type === "sales_forecast") {
    return `
      <div class="forecast-grid">
        ${(section.scenarios || [])
          .map(
            (scenario) => `
              <article class="forecast-card" data-forecast-scenario-card="${escapeHtml(scenario.id)}">
                <div class="reply-card-header">
                  <div>
                    <span>${escapeHtml(scenario.id)}</span>
                    <input class="script-title-input" data-forecast-scenario-field="name" value="${escapeHtml(scenario.name)}">
                  </div>
                  <select class="status-select" data-forecast-scenario-field="status">
                    ${["draft", "active", "approved", "retired"]
                      .map((status) => `<option value="${status}" ${status === scenario.status ? "selected" : ""}>${workflowStatusLabel(status)}</option>`)
                      .join("")}
                  </select>
                </div>
                <div class="forecast-metrics">
                  <label>
                    <span>销量</span>
                    <input data-forecast-scenario-field="units" type="number" min="0" step="1" value="${escapeHtml(String(scenario.units))}">
                  </label>
                  <label>
                    <span>收入</span>
                    <input data-forecast-scenario-field="revenue" type="number" min="0" step="1" value="${escapeHtml(String(scenario.revenue))}">
                  </label>
                  <label>
                    <span>毛利</span>
                    <input data-forecast-scenario-field="grossProfit" type="number" min="0" step="1" value="${escapeHtml(String(scenario.grossProfit))}">
                  </label>
                  <label>
                    <span>广告预算</span>
                    <input data-forecast-scenario-field="adBudget" type="number" min="0" step="1" value="${escapeHtml(String(scenario.adBudget))}">
                  </label>
                </div>
                <label class="script-field">
                  <span>转化率</span>
                  <input class="script-title-input" data-forecast-scenario-field="conversionRate" value="${escapeHtml(scenario.conversionRate)}">
                </label>
                <label class="script-field">
                  <span>触发条件</span>
                  <textarea data-forecast-scenario-field="trigger">${escapeHtml(scenario.trigger)}</textarea>
                </label>
                <label class="script-field">
                  <span>运营建议</span>
                  <textarea data-forecast-scenario-field="recommendation">${escapeHtml(scenario.recommendation)}</textarea>
                </label>
                <div class="script-actions">
                  <button class="ghost-button" type="button" data-copy-forecast-scenario="${escapeHtml(scenario.id)}">复制</button>
                  <button class="primary-action" type="button" data-save-forecast-scenario="${escapeHtml(scenario.id)}">保存</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="plan-grid">
        <div class="plan-panel">
          <h4>月度拆分</h4>
          ${(section.monthlyBreakdown || [])
            .map(
              (month) => `
                <div class="review-item">
                  <span>${escapeHtml(month.month)} | ${escapeHtml(month.unitShare)}</span>
                  <strong>${escapeHtml(month.focus)}</strong>
                  <p>${escapeHtml(month.note)}</p>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="plan-panel">
          <h4>关键假设</h4>
          <div class="angle-list">
            ${(section.assumptions || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
          <h4>风险杠杆</h4>
          <div class="angle-list">
            ${(section.riskLevers || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  if (section.type === "inventory_suggestion") {
    return `
      <div class="inventory-grid">
        ${(section.actions || [])
          .map(
            (action) => `
              <article class="inventory-card" data-inventory-action-card="${escapeHtml(action.id)}">
                <div class="reply-card-header">
                  <div>
                    <span>${escapeHtml(action.id)}</span>
                    <input class="script-title-input" data-inventory-action-field="name" value="${escapeHtml(action.name)}">
                  </div>
                  <select class="status-select" data-inventory-action-field="status">
                    ${["planned", "active", "approved", "paused"]
                      .map((status) => `<option value="${status}" ${status === action.status ? "selected" : ""}>${workflowStatusLabel(status)}</option>`)
                      .join("")}
                  </select>
                </div>
                <div class="forecast-metrics">
                  <label>
                    <span>数量</span>
                    <input data-inventory-action-field="quantity" type="number" min="0" step="1" value="${escapeHtml(String(action.quantity))}">
                  </label>
                  <label>
                    <span>时机</span>
                    <input data-inventory-action-field="timing" value="${escapeHtml(action.timing)}">
                  </label>
                </div>
                <label class="script-field">
                  <span>触发条件</span>
                  <textarea data-inventory-action-field="trigger">${escapeHtml(action.trigger)}</textarea>
                </label>
                <label class="script-field">
                  <span>决策理由</span>
                  <textarea data-inventory-action-field="rationale">${escapeHtml(action.rationale)}</textarea>
                </label>
                <div class="script-actions">
                  <button class="ghost-button" type="button" data-copy-inventory-action="${escapeHtml(action.id)}">复制</button>
                  <button class="primary-action" type="button" data-save-inventory-action="${escapeHtml(action.id)}">保存</button>
                </div>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="plan-grid">
        <div class="plan-panel">
          <h4>库存控制规则</h4>
          <div class="angle-list">
            ${(section.controls || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        </div>
        <div class="plan-panel">
          <h4>断货风险</h4>
          <div class="angle-list">
            ${(section.stockoutRisks || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

function findActiveVideoScript(scriptId) {
  return activeReport?.sections
    ?.find((section) => section.type === "video_scripts")
    ?.scripts?.find((script) => script.id === scriptId);
}

function scriptCardText(script) {
  return [
    script.title,
    `类型：${script.scriptType}`,
    `开头钩子：${script.hook}`,
    "分镜：",
    ...(script.storyboard || []).map((item) => `${item.time}: ${item.action}`),
    `口播：${script.voiceover}`,
    `字幕：${script.captions}`,
    `行动引导：${script.cta}`,
    `达人类型：${script.creatorType}`,
    `转化目标：${script.conversionGoal}`
  ].join("\n");
}

async function copyVideoScript(scriptId) {
  const script = findActiveVideoScript(scriptId);

  if (!script) {
    return;
  }

  await navigator.clipboard.writeText(scriptCardText(script));
}

function parseStoryboard(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [time, ...action] = line.split(":");
      return {
        time: time.trim(),
        action: action.join(":").trim()
      };
    });
}

async function saveVideoScript(scriptId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-script-card="${scriptId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-script-field]").forEach((field) => {
    if (field.dataset.scriptField === "storyboard") {
      payload.storyboard = parseStoryboard(field.value);
    } else {
      payload[field.dataset.scriptField] = field.value;
    }
  });

  const saveButton = card.querySelector("[data-save-script]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/video-scripts/${scriptId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "video_scripts");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

function findActiveLiveSegment(segmentId) {
  return activeReport?.sections
    ?.find((section) => section.type === "live_scripts")
    ?.segments?.find((segment) => segment.id === segmentId);
}

function liveSegmentText(segment) {
  return [
    `${segment.minuteRange} - ${segment.stage}`,
    `目标：${segment.objective}`,
    `主播话术：${segment.hostLine}`,
    `演示动作：${segment.demoAction}`,
    `异议回答：${segment.objectionAnswer}`,
    `成交提示：${segment.offerCue}`
  ].join("\n");
}

async function copyLiveSegment(segmentId) {
  const segment = findActiveLiveSegment(segmentId);

  if (!segment) {
    return;
  }

  await navigator.clipboard.writeText(liveSegmentText(segment));
}

async function saveLiveSegment(segmentId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-live-segment-card="${segmentId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-live-segment-field]").forEach((field) => {
    payload[field.dataset.liveSegmentField] = field.value;
  });

  const saveButton = card.querySelector("[data-save-live-segment]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/live-segments/${segmentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "live_scripts");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

function findActiveReviewReply(replyId) {
  return activeReport?.sections
    ?.find((section) => section.type === "review_insights")
    ?.replies?.find((reply) => reply.id === replyId);
}

function reviewReplyText(reply) {
  return [
    `触发场景：${reply.trigger}`,
    `回复内容：${reply.replyText}`,
    `回复目的：${reply.intent}`
  ].join("\n");
}

async function copyReviewReply(replyId) {
  const reply = findActiveReviewReply(replyId);

  if (!reply) {
    return;
  }

  await navigator.clipboard.writeText(reviewReplyText(reply));
}

async function saveReviewReply(replyId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-review-reply-card="${replyId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-review-reply-field]").forEach((field) => {
    payload[field.dataset.reviewReplyField] = field.value;
  });

  const saveButton = card.querySelector("[data-save-review-reply]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/review-replies/${replyId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "review_insights");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

function findActiveComplianceCheck(checkId) {
  return activeReport?.sections
    ?.find((section) => section.type === "compliance_risk")
    ?.checks?.find((check) => check.id === checkId);
}

function complianceCheckText(check) {
  return [
    `${check.id} | ${check.area} | ${check.risk}`,
    `要求：${check.requirement}`,
    `动作：${check.action}`,
    `负责人：${check.owner}`,
    `状态：${workflowStatusLabel(check.status)}`
  ].join("\n");
}

async function copyComplianceCheck(checkId) {
  const check = findActiveComplianceCheck(checkId);

  if (!check) {
    return;
  }

  await navigator.clipboard.writeText(complianceCheckText(check));
}

async function saveComplianceCheck(checkId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-compliance-check-card="${checkId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-compliance-check-field]").forEach((field) => {
    payload[field.dataset.complianceCheckField] = field.value;
  });

  const saveButton = card.querySelector("[data-save-compliance-check]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/compliance-checks/${checkId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "compliance_risk");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

function findActivePlanPhase(phaseId) {
  return activeReport?.sections
    ?.find((section) => section.type === "ninety_day_plan")
    ?.phases?.find((phase) => phase.id === phaseId);
}

function planPhaseText(phase) {
  return [
    `${phase.dayRange} | ${phase.name}`,
    `阶段目标：${phase.objective}`,
    `核心指标：${phase.keyMetric}`,
    `预算重点：${phase.budgetFocus}`,
    `负责人：${phase.owner}`,
    `状态：${workflowStatusLabel(phase.status)}`,
    "任务清单：",
    ...(phase.tasks || []).map((task) => `- ${task}`)
  ].join("\n");
}

async function copyPlanPhase(phaseId) {
  const phase = findActivePlanPhase(phaseId);

  if (!phase) {
    return;
  }

  await navigator.clipboard.writeText(planPhaseText(phase));
}

async function savePlanPhase(phaseId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-plan-phase-card="${phaseId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-plan-phase-field]").forEach((field) => {
    if (field.dataset.planPhaseField === "tasks") {
      payload.tasks = String(field.value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } else {
      payload[field.dataset.planPhaseField] = field.value;
    }
  });

  const saveButton = card.querySelector("[data-save-plan-phase]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/plan-phases/${phaseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "ninety_day_plan");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

function findActiveForecastScenario(scenarioId) {
  return activeReport?.sections
    ?.find((section) => section.type === "sales_forecast")
    ?.scenarios?.find((scenario) => scenario.id === scenarioId);
}

function forecastScenarioText(scenario) {
  return [
    `${scenario.name} 销量预测`,
    `销量：${scenario.units}`,
    `收入：${scenario.revenue}`,
    `毛利：${scenario.grossProfit}`,
    `广告预算：${scenario.adBudget}`,
    `转化率：${scenario.conversionRate}`,
    `触发条件：${scenario.trigger}`,
    `运营建议：${scenario.recommendation}`
  ].join("\n");
}

async function copyForecastScenario(scenarioId) {
  const scenario = findActiveForecastScenario(scenarioId);

  if (!scenario) {
    return;
  }

  await navigator.clipboard.writeText(forecastScenarioText(scenario));
}

async function saveForecastScenario(scenarioId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-forecast-scenario-card="${scenarioId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-forecast-scenario-field]").forEach((field) => {
    payload[field.dataset.forecastScenarioField] = field.value;
  });

  const saveButton = card.querySelector("[data-save-forecast-scenario]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/forecast-scenarios/${scenarioId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "sales_forecast");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

function findActiveInventoryAction(actionId) {
  return activeReport?.sections
    ?.find((section) => section.type === "inventory_suggestion")
    ?.actions?.find((action) => action.id === actionId);
}

function inventoryActionText(action) {
  return [
    `${action.name} 备货动作`,
    `数量：${action.quantity}`,
    `时机：${action.timing}`,
    `触发条件：${action.trigger}`,
    `决策理由：${action.rationale}`,
    `状态：${workflowStatusLabel(action.status)}`
  ].join("\n");
}

async function copyInventoryAction(actionId) {
  const action = findActiveInventoryAction(actionId);

  if (!action) {
    return;
  }

  await navigator.clipboard.writeText(inventoryActionText(action));
}

async function saveInventoryAction(actionId) {
  if (!activeReport?.id) {
    return;
  }

  const card = reportSections.querySelector(`[data-inventory-action-card="${actionId}"]`);

  if (!card) {
    return;
  }

  const payload = {};
  card.querySelectorAll("[data-inventory-action-field]").forEach((field) => {
    payload[field.dataset.inventoryActionField] = field.value;
  });

  const saveButton = card.querySelector("[data-save-inventory-action]");
  saveButton.disabled = true;
  saveButton.textContent = "保存中...";

  try {
    const response = await requestJson(`/api/launch-reports/${activeReport.id}/inventory-actions/${actionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    activeReport = response.report;
    renderReportModules(activeReport.sections || [], "inventory_suggestion");
  } catch {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
}

async function regenerateReportSection(sectionType) {
  if (!activeReport?.id) {
    return;
  }

  reportSections.querySelectorAll("[data-regenerate-section]").forEach((button) => {
    button.disabled = true;
    button.textContent = "重新生成中...";
  });

  try {
    const payload = await requestJson(`/api/launch-reports/${activeReport.id}/sections/${sectionType}/regenerate`, {
      method: "POST",
      body: JSON.stringify({
        generationMode: "local"
      })
    });
    activeReport = payload.report;
    renderReportModules(activeReport.sections || [], sectionType);
  } catch {
    renderReportModules(activeReport.sections || [], sectionType);
  }
}

async function openReport(reportId) {
  const payload = await requestJson(`/api/launch-reports/${reportId}`);
  renderLaunchReportV2(payload);
  switchPanel("report-panel");
}

async function generateLaunchReport() {
  if (!activeProject) {
    return;
  }

  generateReportButton.disabled = true;
  generateReportButton.textContent = "生成中...";
  reportMessage.textContent = "正在生成打品报告...";
  document.body.classList.add("is-generating");

  try {
    const payload = await requestJson(`/api/product-projects/${activeProject.id}/launch-report/generate`, {
      method: "POST",
      body: "{}"
    });
    await refreshProjects();
    renderProjectDetail(payload.project);
    renderLaunchReportV2(payload);
    switchPanel("report-panel");
  } catch (error) {
    reportMessage.textContent = error.message;
    reportMessage.classList.add("is-error");
    generateReportButton.disabled = false;
    generateReportButton.textContent = activeProject.latestReportId ? "重新生成" : "生成报告";
  } finally {
    document.body.classList.remove("is-generating");
  }
}

function showApp(payload) {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  logoutButton.classList.add("hidden");

  workspaceTitle.textContent = payload.workspace?.name || "打品工作台";
  workspaceSubtitle.textContent = `${payload.user.name} - ${payload.user.email} - ${payload.workspace?.plan || "free"} 方案`;
  switchPanel("dashboard-panel");
  refreshProjects().catch(() => {
    projectList.innerHTML = '<p class="form-message">项目加载失败。</p>';
    projectListFull.innerHTML = '<p class="form-message">项目加载失败。</p>';
  });

  if (window.location.pathname !== "/app") {
    window.history.replaceState({}, "", "/app");
  }
}

async function refreshSession() {
  try {
    const payload = await requestJson("/api/auth/me");
    showApp(payload);
  } catch (error) {
    authView.classList.add("hidden");
    statusRow.classList.add("is-error");
    statusText.textContent = `系统暂时无法进入工作台：${error.message}`;
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "处理中...";

  const formData = new FormData(authForm);
  const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
  const body = {
    email: formData.get("email"),
    password: formData.get("password")
  };

  if (authMode === "register") {
    body.name = formData.get("name");
    body.workspaceName = formData.get("workspaceName");
  }

  try {
    const payload = await requestJson(endpoint, {
      method: "POST",
      body: JSON.stringify(body)
    });
    authForm.reset();
    showApp(payload);
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  projectMessage.textContent = "正在创建项目...";

  const formData = new FormData(projectForm);
  const body = {
    productName: formData.get("productName"),
    category: formData.get("category"),
    targetMarket: formData.get("targetMarket"),
    platforms: formData.getAll("platforms"),
    competitorLinks: formData.get("competitorLinks"),
    targetPrice: formData.get("targetPrice"),
    costPrice: formData.get("costPrice"),
    inventory: formData.get("inventory"),
    leadTimeDays: formData.get("leadTimeDays")
  };
  persistProjectFormDraft();

  try {
    const payload = await requestJson("/api/product-projects", {
      method: "POST",
      body: JSON.stringify(body)
    });
    projectMessage.textContent = "";
    await refreshProjects();
    renderProjectDetail(payload.project);
    switchPanel("detail-panel");
  } catch (error) {
    projectMessage.textContent = error.message;
  }
});

modeToggle.addEventListener("click", () => {
  setMode(authMode === "register" ? "login" : "register");
});

logoutButton.addEventListener("click", async () => {
  await requestJson("/api/auth/logout", {
    method: "POST",
    body: "{}"
  });
  window.history.replaceState({}, "", "/");
  showAuth();
});

navItems.forEach((item) => {
  item.addEventListener("click", () => switchPanel(item.dataset.targetView));
});

newProjectButton.addEventListener("click", () => switchPanel("create-panel"));
openCreateButtons.forEach((button) => {
  button.addEventListener("click", () => switchPanel("create-panel"));
});
cancelCreateButton.addEventListener("click", () => switchPanel("dashboard-panel"));
backToProjectsButton.addEventListener("click", () => switchPanel("projects-panel"));
generateReportButton.addEventListener("click", generateLaunchReport);
viewReportButton.addEventListener("click", () => {
  if (activeProject?.latestReportId) {
    openReport(activeProject.latestReportId);
  }
});
backToDetailButton.addEventListener("click", () => {
  if (activeProject?.id) {
    openProjectDetail(activeProject.id);
  } else {
    switchPanel("projects-panel");
  }
});

setMode("register");
setupProjectDraftPersistence();
refreshHealth();
refreshSession();
