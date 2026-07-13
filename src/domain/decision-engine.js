import { dataPointNumber } from "./data-source.js";

function inputNumber(input, group, field, fallback = null) {
  return dataPointNumber(input?.[group]?.[field], fallback);
}

function clampScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function percent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "待确认";
  }

  return `${(Number(value) * 100).toFixed(2)}%`;
}

function money(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "待确认";
  }

  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function riskPenalty(input) {
  const returnRate = inputNumber(input, "salesFees", "returnRate", 0);
  const hasBattery = Boolean(input?.supplyChain?.hasBattery?.value);
  const needsCertification = Boolean(input?.supplyChain?.needsSpecialCertification?.value);
  let penalty = 0;

  if (returnRate > 8 || (returnRate > 0.08 && returnRate <= 1)) {
    penalty += 12;
  }

  if (hasBattery) {
    penalty += 8;
  }

  if (needsCertification) {
    penalty += 10;
  }

  return penalty;
}

export function buildDecisionDashboard(project, structuredInput, financialModel, aiReport = {}, consistencyChecks = []) {
  const aiScores = aiReport.aiEngine?.aiScore || {};
  const netMargin = financialModel.formulas?.netMargin;
  const breakEvenRoas = financialModel.formulas?.breakEvenRoas;
  const salePrice = inputNumber(structuredInput, "salesFees", "targetPrice", inputNumber(structuredInput, "legacy", "targetPrice", 0));
  const targetPriceScore = salePrice >= 15 && salePrice <= 80 ? 78 : salePrice > 80 ? 68 : 58;
  const missingFinancials = !salePrice || !financialModel.inputs.factoryPrice;
  const failedConsistency = consistencyChecks.filter((item) => item.status === "failed").length;
  const financialScore = missingFinancials ? 35 : clampScore((netMargin ?? 0) * 180 + 45 - failedConsistency * 10);
  const complianceScore = clampScore(85 - riskPenalty(structuredInput));
  const supplyScore = clampScore(
    70 +
      (inputNumber(structuredInput, "supplyChain", "currentInventory", 0) > 0 ? 10 : 0) +
      (inputNumber(structuredInput, "supplyChain", "productionLeadTimeDays", 0) <= 30 ? 8 : -8)
  );

  const dimensions = [
    {
      key: "marketDemand",
      label: "市场需求",
      weight: 20,
      score: clampScore(aiScores.demandScore || 60),
      deductionReason: aiScores.demandScore ? "基于AI需求判断，仍需外部平台数据复核。" : "缺少外部销量和搜索数据，按待验证处理。",
      dataSource: "AI估算 + 用户输入",
      confidence: aiScores.demandScore ? 65 : 35
    },
    {
      key: "productDifferentiation",
      label: "产品差异化",
      weight: 15,
      score: clampScore(aiScores.competitionScore || targetPriceScore),
      deductionReason: "需要竞品页面、评论和价格带验证差异点是否真实存在。",
      dataSource: "竞品链接/AI差异推理",
      confidence: project.competitorLinks?.length ? 60 : 30
    },
    {
      key: "contentVirality",
      label: "内容传播性",
      weight: 15,
      score: clampScore(aiScores.viralityScore || 60),
      deductionReason: "尚未接入真实视频播放、点击和转化数据。",
      dataSource: "AI估算",
      confidence: 55
    },
    {
      key: "financialHealth",
      label: "财务健康度",
      weight: 20,
      score: financialScore,
      deductionReason: missingFinancials ? "缺少售价或出厂价，不能确认利润。" : `基准净利润率 ${percent(netMargin)}，盈亏平衡ROAS ${breakEvenRoas ?? "待确认"}。`,
      dataSource: "程序公式计算",
      confidence: missingFinancials ? 35 : 85
    },
    {
      key: "supplyChainStability",
      label: "供应链稳定性",
      weight: 10,
      score: supplyScore,
      deductionReason: "根据库存、生产周期和首批可供货量判断。",
      dataSource: "用户输入",
      confidence: 70
    },
    {
      key: "platformCompliance",
      label: "平台合规性",
      weight: 10,
      score: complianceScore,
      deductionReason: "带电、液体、儿童用品或特殊认证会降低合规确定性。",
      dataSource: "用户输入 + AI风险判断",
      confidence: 65
    },
    {
      key: "seasonWindow",
      label: "季节和销售窗口",
      weight: 10,
      score: clampScore(aiScores.riskScore || 62),
      deductionReason: "缺少Google Trends和平台季节数据，暂按AI推理评分。",
      dataSource: "AI估算",
      confidence: 45
    }
  ];
  const weightedScore = Math.round(
    dimensions.reduce((sum, item) => sum + item.score * (item.weight / 100), 0)
  );
  const recommendationGrade = weightedScore >= 85 ? "A" : weightedScore >= 70 ? "B" : weightedScore >= 55 ? "C" : "D";
  const suggestedAction =
    recommendationGrade === "A" ? "重仓" : recommendationGrade === "B" ? "小测" : recommendationGrade === "C" ? "观察" : "放弃";
  const nextValidationAction = missingFinancials
    ? "补齐出厂价、售价、平台佣金、退货率和基准ROAS。"
    : "用真实广告、达人、竞品价格和首批测试订单复核模型。";

  return {
    recommendationGrade,
    suggestedAction,
    weightedScore,
    suggestedFirstBatchInventory: financialModel.inputs?.suggestedFirstBatchInventory || "待确认",
    suggestedTestBudget: money(inputNumber(structuredInput, "goals", "totalMarketingBudget", financialModel.formulas?.firstBatchCashNeed || null)),
    suggestedTestCycle: `${inputNumber(structuredInput, "goals", "testCycleDays", 14) || 14}天`,
    baseNetMargin: percent(netMargin),
    breakEvenRoas: breakEvenRoas ?? "待确认",
    maxCustomerAcquisitionCost: money(financialModel.formulas?.maxCustomerAcquisitionCost),
    maxCreatorCommission: percent(financialModel.formulas?.maxCreatorCommissionRate),
    cashRecoveryCycle: financialModel.formulas?.cashRecoveryDays ? `${financialModel.formulas.cashRecoveryDays}天` : "待确认",
    maxPotentialLoss: money(financialModel.formulas?.unsoldInventoryPotentialLoss),
    coreOpportunity: aiReport.finalConclusion?.shortVideoDirection || aiReport.differentiationAnalysis?.finalConclusion?.shortVideoDirection || "待验证产品差异点和内容演示角度。",
    biggestRisk: aiReport.finalConclusion?.biggestRisk || aiReport.differentiationAnalysis?.finalConclusion?.biggestRisk || "当前最大风险是缺少真实销售和退货数据。",
    biggestDataGap: missingFinancials ? "财务参数不完整" : "外部销量、竞品转化、达人履约数据未验证",
    nextValidationAction,
    dimensions
  };
}
