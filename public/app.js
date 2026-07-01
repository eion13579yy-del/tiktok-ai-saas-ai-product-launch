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
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "请求失败。");
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  generateReportButton.disabled = false;
  generateReportButton.textContent = project.latestReportId ? "重新生成报告" : "生成报告";
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
  activeReport = report;
  activeProject = project || activeProject;
  ensureDownloadReportButton();
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
      <strong>${escapeHtml(report.productEvaluationModel?.conclusion || "待评估")}</strong>
      <p>数据可信度：${escapeHtml(report.dataCredibilityScore ?? "未评分")} / 100</p>
      <p>打品评分：${escapeHtml(report.productEvaluationModel?.totalScore ?? "未评分")} / 100</p>
    </article>
  `;
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
  downloadReportButton.className = "ghost-button";
  downloadReportButton.type = "button";
  downloadReportButton.textContent = "下载PDF";
  downloadReportButton.addEventListener("click", () => {
    if (!activeReport?.id) {
      return;
    }

    window.open(`/api/launch-reports/${activeReport.id}/pdf`, "_blank");
  });
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

function renderEvaluationLayer(report) {
  const model = report.productEvaluationModel;
  const breakdown = report.dataSourceBreakdown || {};

  if (!model) {
    return "";
  }

  return `
    <section class="evaluation-layer">
      <div class="evaluation-header">
        <div>
          <span>产品智能评估模型层</span>
          <h3>${escapeHtml(model.conclusion)}</h3>
          <p>${escapeHtml(model.conclusionReason)}</p>
        </div>
        <div class="evaluation-score">
          <span>打品评分</span>
          <strong>${escapeHtml(model.totalScore)}</strong>
          <p>数据可信度 ${escapeHtml(report.dataCredibilityScore)} / 100</p>
        </div>
      </div>

      <div class="evaluation-grid">
        ${(model.dimensions || [])
          .map(
            (dimension) => `
              <article class="evaluation-card">
                <div class="evaluation-card-top">
                  <span>${escapeHtml(dimension.label)}</span>
                  <strong>${escapeHtml(dimension.score)}</strong>
                </div>
                <p>${escapeHtml(dimension.reason)}</p>
                <div class="data-badge ${dataTypeClass(dimension.dataType)}">${escapeHtml(dimension.dataType)}</div>
                <small>下一步验证：${escapeHtml(dimension.validationNeeded)}</small>
              </article>
            `
          )
          .join("")}
      </div>

      <div class="evidence-grid">
        <section>
          <h4>已验证数据</h4>
          ${renderEvidenceItems(breakdown.verifiedData)}
        </section>
        <section>
          <h4>AI推测数据</h4>
          ${renderEvidenceItems(breakdown.aiInferredData)}
        </section>
        <section>
          <h4>人工假设数据</h4>
          ${renderEvidenceItems(breakdown.humanAssumptions, "assumption")}
        </section>
      </div>

      <div class="role-review-grid">
        ${(report.roleReviews || [])
          .map(
            (review) => `
              <article class="role-review-card">
                <h4>${escapeHtml(review.role)}</h4>
                <div>
                  <span>支持理由</span>
                  ${(review.supportReasons || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                </div>
                <div>
                  <span>反对理由</span>
                  ${(review.objectionReasons || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
                </div>
              </article>
            `
          )
          .join("")}
      </div>

      <div class="validation-checklist">
        <h4>待验证数据清单</h4>
        ${(report.validationChecklist || [])
          .map(
            (item) => `
              <article>
                <span>${escapeHtml(item.priority)} · ${escapeHtml(item.owner)}</span>
                <strong>${escapeHtml(item.item)}</strong>
                <p>${escapeHtml(item.method)}</p>
                <small>${item.blocksScaling ? "放量前必须完成" : "建议进入下一轮前完成"}</small>
              </article>
            `
          )
          .join("")}
      </div>

      <p class="fact-safety-rule">${escapeHtml(report.factSafetyRule)}</p>
    </section>
  `;
}

function renderReportModules(sections, activeType) {
  const activeSection = sections.find((section) => section.type === activeType) || sections[0];
  const canRegenerate = ["market_analysis", "customer_persona"].includes(activeSection?.type);

  reportModuleNav.innerHTML = sections
    .map(
      (section, index) => `
        <button class="module-nav-item ${section.type === activeSection?.type ? "is-active" : ""}" type="button" data-section-type="${escapeHtml(section.type)}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          ${escapeHtml(moduleLabel(section.type))}
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
    generateReportButton.disabled = false;
    generateReportButton.textContent = "生成报告";
  }
}

function showApp(payload) {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");

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
  } catch {
    showAuth();
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

  try {
    const payload = await requestJson("/api/product-projects", {
      method: "POST",
      body: JSON.stringify(body)
    });
    projectForm.reset();
    projectForm.elements.targetMarket.value = "美国";
    projectForm.querySelector('input[value="TikTok"]').checked = true;
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
refreshHealth();
refreshSession();
