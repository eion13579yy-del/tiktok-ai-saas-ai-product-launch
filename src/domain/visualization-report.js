function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
}

function pct(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return round(parsed * 100, 2);
}

function chartPoint(label, value, options = {}) {
  const hasValue = value !== null && value !== undefined && value !== "";

  return {
    label,
    value: hasValue ? round(value, options.digits ?? 2) : null,
    unit: options.unit || "",
    sourceType: options.sourceType || "program_calculation",
    sourceUrl: options.sourceUrl || "",
    sourceDate: options.sourceDate || new Date().toISOString().slice(0, 10),
    confidenceLevel: options.confidenceLevel ?? (options.isEstimated ? 55 : 82),
    isEstimated: Boolean(options.isEstimated),
    note: options.note || ""
  };
}

function chartSummary(chart, businessMeaning = "") {
  const values = (chart.series || [])
    .flatMap((serie) => serie.data || [])
    .filter((point) => Number.isFinite(Number(point.value)));
  const sorted = [...values].sort((a, b) => Number(b.value) - Number(a.value));
  const peakPoint = sorted[0] || null;
  const lowestPoint = sorted[sorted.length - 1] || null;
  const estimatedCount = values.filter((point) => point.isEstimated).length;

  return {
    chartId: chart.id,
    chartType: chart.type,
    title: chart.title,
    primaryMetric: peakPoint ? `${peakPoint.label}: ${peakPoint.value}${peakPoint.unit || chart.unit || ""}` : "暂无足够数据",
    comparisonMetric: lowestPoint ? `${lowestPoint.label}: ${lowestPoint.value}${lowestPoint.unit || chart.unit || ""}` : "暂无足够数据",
    trend: chart.trend || "基于当前参数计算",
    peakPoint,
    lowestPoint,
    anomalyPoints: values.filter((point) => point.confidenceLevel < 60),
    businessMeaning,
    dataQuality: {
      status: values.length ? (estimatedCount ? "partial_estimated" : "calculated") : "insufficient",
      totalPoints: values.length,
      estimatedCount
    }
  };
}

function chartConfig(config) {
  return {
    id: config.id,
    type: config.type,
    title: config.title,
    subtitle: config.subtitle || "",
    dataSource: config.dataSource || {
      sourceType: "program_calculation",
      label: "由用户输入、公式引擎和报告数据库计算",
      updatedAt: config.updatedAt || new Date().toISOString()
    },
    xAxis: config.xAxis || null,
    yAxis: config.yAxis || null,
    series: config.series || [],
    unit: config.unit || "",
    filters: config.filters || ["timeRange", "platform", "channel", "scenario"],
    showLegend: config.showLegend ?? true,
    showTooltip: config.showTooltip ?? true,
    showDataTable: config.showDataTable ?? true,
    exportable: config.exportable ?? true,
    estimatedDataStyle: {
      strokeDasharray: "4 4",
      opacity: 0.62,
      label: "模型估算",
      ...(config.estimatedDataStyle || {})
    },
    insightConfig: config.insightConfig || {
      chartSummaryOnly: true,
      allowRawArrayToAI: false
    },
    emptyState: config.emptyState || {
      title: "暂无足够数据",
      missing: ["真实销量", "竞品价格", "历史趋势"],
      action: "补充数据后重新分析"
    }
  };
}

function metricCard(id, label, value, unit, options = {}) {
  return {
    id,
    label,
    value,
    unit,
    benchmark: options.benchmark ?? null,
    delta: options.delta ?? null,
    trend: options.trend || "flat",
    status: options.status || "待复核",
    tooltip: options.tooltip || "",
    sourceType: options.sourceType || "program_calculation",
    confidenceLevel: options.confidenceLevel ?? 80,
    isEstimated: Boolean(options.isEstimated)
  };
}

function costStructure(financial) {
  const formulas = financial?.formulas || {};

  return [
    chartPoint("落地成本", formulas.landedCost, { unit: "$" }),
    chartPoint("平台佣金", formulas.platformFee, { unit: "$" }),
    chartPoint("达人佣金", formulas.creatorCommissionPerOrder, { unit: "$" }),
    chartPoint("广告费用", formulas.adCostPerOrder, { unit: "$", isEstimated: true }),
    chartPoint("退货损耗", formulas.returnLossPerUnit, { unit: "$", isEstimated: true }),
    chartPoint("其他履约", number(formulas.totalCostPerUnit) - number(formulas.landedCost) - number(formulas.platformFee) - number(formulas.creatorCommissionPerOrder) - number(formulas.adCostPerOrder) - number(formulas.returnLossPerUnit), { unit: "$" })
  ].filter((point) => point.value !== null);
}

function profitWaterfall(financial) {
  const inputs = financial?.inputs || {};
  const formulas = financial?.formulas || {};

  return [
    chartPoint("销售价格", inputs.salePrice, { unit: "$" }),
    chartPoint("落地成本", -number(formulas.landedCost), { unit: "$" }),
    chartPoint("履约成本", -Math.max(0, number(formulas.fulfillmentCost) - number(formulas.landedCost)), { unit: "$" }),
    chartPoint("平台佣金", -number(formulas.platformFee), { unit: "$" }),
    chartPoint("达人佣金", -number(formulas.creatorCommissionPerOrder), { unit: "$" }),
    chartPoint("广告费用", -number(formulas.adCostPerOrder), { unit: "$", isEstimated: true }),
    chartPoint("退货损耗", -number(formulas.returnLossPerUnit), { unit: "$", isEstimated: true }),
    chartPoint("单台净利润", formulas.netProfitPerUnit, { unit: "$" })
  ];
}

function monthlyTrend(annualPlan) {
  const phases = annualPlan?.phases || [];

  if (!phases.length) {
    return [];
  }

  return phases.map((phase) => chartPoint(phase.name, phase.revenueTarget, { unit: "$", isEstimated: true }));
}

function monthlyUnits(annualPlan) {
  return (annualPlan?.phases || []).map((phase) => chartPoint(phase.name, phase.unitTarget, { unit: "件", isEstimated: true }));
}

function channelShare(channelBreakdown) {
  return (channelBreakdown?.channels || []).slice(0, 6).map((channel) => chartPoint(channel.name, channel.revenueTarget, { unit: "$", isEstimated: true }));
}

function radarScores(report) {
  const dimensions = report.productEvaluationModel?.dimensions || [];
  const byKey = new Map(dimensions.map((item) => [item.key, item.score]));

  return [
    chartPoint("市场需求", byKey.get("demandScore") ?? report.decisionDashboard?.dimensionScores?.marketDemand?.score, { unit: "分", isEstimated: true }),
    chartPoint("产品差异化", byKey.get("competitionScore") ?? report.decisionDashboard?.dimensionScores?.competitiveProof?.score, { unit: "分", isEstimated: true }),
    chartPoint("内容传播", byKey.get("viralityScore") ?? report.decisionDashboard?.dimensionScores?.contentVirality?.score, { unit: "分", isEstimated: true }),
    chartPoint("财务健康", byKey.get("marginScore") ?? report.decisionDashboard?.dimensionScores?.marginHealth?.score, { unit: "分" }),
    chartPoint("供应链", report.decisionDashboard?.dimensionScores?.supplyChain?.score ?? 70, { unit: "分", isEstimated: true }),
    chartPoint("合规安全", report.decisionDashboard?.dimensionScores?.riskControl?.score ?? byKey.get("riskScore"), { unit: "分", isEstimated: true })
  ];
}

function riskDistribution(riskRegister) {
  const buckets = { high: 0, medium: 0, low: 0 };

  for (const risk of riskRegister?.risks || []) {
    const level = ["high", "medium", "low"].includes(risk.level) ? risk.level : "medium";
    buckets[level] += 1;
  }

  return [
    chartPoint("高风险", buckets.high, { unit: "项" }),
    chartPoint("中风险", buckets.medium, { unit: "项" }),
    chartPoint("低风险", buckets.low, { unit: "项" })
  ];
}

function scenarioComparison(scenarioSimulation) {
  return (scenarioSimulation?.scenarios || []).map((scenario) => chartPoint(scenario.name, scenario.outputs?.netProfit, { unit: "$", isEstimated: true }));
}

function buildCharts(report, timestamp) {
  const charts = [
    chartConfig({
      id: "monthly-sales-units",
      type: "combo",
      title: "月度销售额与销量趋势",
      subtitle: "用于判断年度目标节奏、备货压力和现金回收窗口",
      unit: "$",
      updatedAt: timestamp,
      series: [
        { name: "销售额", unit: "$", data: monthlyTrend(report.annualPlan) },
        { name: "销量", unit: "件", axis: "right", data: monthlyUnits(report.annualPlan) }
      ],
      trend: "按阶段目标推演"
    }),
    chartConfig({
      id: "capability-radar",
      type: "radar",
      title: "项目综合能力雷达图",
      subtitle: "仅用于维度对比，不作为唯一评分依据",
      unit: "分",
      updatedAt: timestamp,
      series: [{ name: "当前产品", data: radarScores(report) }]
    }),
    chartConfig({
      id: "channel-share",
      type: "donut",
      title: "销售渠道占比",
      subtitle: "展示 TikTok、Amazon、直播、达人等渠道的收入贡献假设",
      unit: "$",
      updatedAt: timestamp,
      series: [{ name: "渠道收入", data: channelShare(report.channelBreakdown) }]
    }),
    chartConfig({
      id: "unit-profit-waterfall",
      type: "waterfall",
      title: "单台利润瀑布图",
      subtitle: "从售价逐项扣除成本、佣金、广告和退货损耗",
      unit: "$",
      updatedAt: timestamp,
      series: [{ name: "单台利润", data: profitWaterfall(report.financialModel) }]
    }),
    chartConfig({
      id: "cost-structure",
      type: "donut",
      title: "单台成本结构",
      subtitle: "区分已计算成本和模型估算成本",
      unit: "$",
      updatedAt: timestamp,
      series: [{ name: "成本", data: costStructure(report.financialModel) }]
    }),
    chartConfig({
      id: "scenario-comparison",
      type: "scenario",
      title: "保守 / 基准 / 乐观情景对比",
      subtitle: "对比不同经营假设下的净利润结果",
      unit: "$",
      updatedAt: timestamp,
      series: [{ name: "净利润", data: scenarioComparison(report.scenarioSimulation) }]
    }),
    chartConfig({
      id: "risk-distribution",
      type: "bar",
      title: "风险等级分布",
      subtitle: "按高、中、低风险聚合项目风险清单",
      unit: "项",
      updatedAt: timestamp,
      series: [{ name: "风险数量", data: riskDistribution(report.riskRegister) }]
    })
  ];

  return charts.map((chart) => ({
    ...chart,
    summary: chartSummary(chart, chart.subtitle)
  }));
}

function reportPages() {
  return [
    { id: "overview", number: "01", title: "决策总览", mode: "dashboard", completion: 92 },
    { id: "market", number: "02", title: "市场机会", mode: "report", completion: 72 },
    { id: "competitors", number: "03", title: "竞品分析", mode: "report", completion: 58 },
    { id: "consumer", number: "04", title: "用户需求", mode: "report", completion: 68 },
    { id: "finance", number: "05", title: "财务模型", mode: "finance", completion: 88 },
    { id: "scenario", number: "06", title: "情景模拟", mode: "finance", completion: 80 },
    { id: "content", number: "07", title: "内容策略", mode: "dashboard", completion: 66 },
    { id: "creator", number: "08", title: "达人策略", mode: "dashboard", completion: 64 },
    { id: "live", number: "09", title: "直播策略", mode: "dashboard", completion: 60 },
    { id: "annual", number: "10", title: "年度计划", mode: "planning", completion: 84 },
    { id: "inventory", number: "11", title: "库存计划", mode: "planning", completion: 82 },
    { id: "risk", number: "12", title: "风险中心", mode: "risk", completion: 78 },
    { id: "evidence", number: "13", title: "数据来源", mode: "evidence", completion: 70 },
    { id: "actions", number: "14", title: "执行清单", mode: "dashboard", completion: 76 }
  ];
}

function buildMetrics(report) {
  const formulas = report.financialModel?.formulas || {};
  const inputs = report.financialModel?.inputs || {};
  const dashboard = report.decisionDashboard || {};

  return [
    metricCard("target-revenue", "目标销售额", dashboard.annualRevenueTarget ?? report.annualPlan?.totalRevenueTarget, "$", { tooltip: "来自经营目标或年度计划推演", isEstimated: true }),
    metricCard("target-units", "目标销量", dashboard.annualUnitTarget ?? report.annualPlan?.totalUnitTarget, "件", { tooltip: "年度销量目标", isEstimated: true }),
    metricCard("aov", "目标客单价", inputs.salePrice, "$", { tooltip: "用户录入目标售价" }),
    metricCard("total-cost", "单台完整成本", formulas.totalCostPerUnit, "$", { tooltip: "落地成本、履约、佣金、广告和退货损耗合计" }),
    metricCard("net-profit", "单台净利润", formulas.netProfitPerUnit, "$", { status: number(formulas.netProfitPerUnit) > 0 ? "健康" : "待优化" }),
    metricCard("net-margin", "净利润率", pct(formulas.netMargin), "%", { benchmark: "目标 15%", status: number(formulas.netMargin) >= 0.15 ? "健康" : "待优化" }),
    metricCard("break-even-roas", "盈亏平衡 ROAS", formulas.breakEvenRoas, "x", { status: "关键门槛" }),
    metricCard("cash-recovery", "现金回收周期", formulas.cashRecoveryDays, "天", { status: formulas.cashRecoveryDays ? "需跟踪" : "待确认" }),
    metricCard("market-score", "市场机会评分", dashboard.dimensionScores?.marketDemand?.score ?? report.opportunityScore, "分", { isEstimated: true }),
    metricCard("content-score", "内容传播评分", dashboard.dimensionScores?.contentVirality?.score, "分", { isEstimated: true }),
    metricCard("risk-score", "风险控制评分", dashboard.dimensionScores?.riskControl?.score, "分", { isEstimated: true }),
    metricCard("confidence", "结论置信度", report.dataCredibilityScore, "分", { sourceType: "report_database" })
  ];
}

export function buildVisualizationReport(project, report, options = {}) {
  const timestamp = options.timestamp || report.generatedAt || new Date().toISOString();
  const charts = buildCharts(report, timestamp);

  return {
    dashboardConfig: {
      modes: ["dashboard", "report", "finance", "planning", "evidence", "risk"],
      maxWidth: {
        dashboard: 1600,
        report: 1440
      },
      navigation: reportPages()
    },
    theme: {
      defaultTheme: "executive-orange",
      themes: [
        { id: "executive-orange", name: "Executive Orange" },
        { id: "corporate-navy", name: "Corporate Navy" },
        { id: "minimal-dark", name: "Minimal Dark" }
      ]
    },
    exportConfig: {
      defaultFormat: "pdf",
      pdfTheme: "executive-orange",
      orientation: "landscape",
      includePageNumber: true,
      includeDataSourceAppendix: true
    },
    reportMeta: {
      productName: project?.productName || "",
      productImageUrl: project?.structuredInput?.basicInfo?.productImageUrl?.value || "",
      version: report.version,
      generatedAt: report.generatedAt,
      updatedAt: timestamp,
      dataCompleteness: report.dataCredibilityScore ?? null,
      confidence: report.dataCredibilityScore ?? null,
      confidentiality: "Confidential"
    },
    metrics: buildMetrics(report),
    charts,
    pages: reportPages(),
    insights: charts.map((chart) => ({
      id: `${chart.id}-insight`,
      chartId: chart.id,
      title: chart.title,
      summary: chart.summary.primaryMetric,
      businessMeaning: chart.summary.businessMeaning,
      recommendation: chart.summary.dataQuality.estimatedCount
        ? "该图包含模型估算数据，上线前需要用真实平台数据复核。"
        : "该图由当前输入和公式计算生成，可作为经营讨论基线。",
      sourceType: chart.dataSource.sourceType,
      confidenceLevel: chart.summary.dataQuality.estimatedCount ? 65 : 82
    })),
    chartSummaries: charts.map((chart) => chart.summary)
  };
}
