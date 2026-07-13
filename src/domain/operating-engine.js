import { dataPointNumber } from "./data-source.js";

function inputNumber(input, group, field, fallback = 0) {
  return dataPointNumber(input?.[group]?.[field], fallback);
}

function rate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number > 1 ? number / 100 : number;
}

function roundMoney(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function roundNumber(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

  return Number.isFinite(diff) && diff > 0 ? diff : 30;
}

export function buildScenarioSimulation(structuredInput = {}, financialModel = {}) {
  const baseSalePrice = inputNumber(structuredInput, "salesFees", "targetPrice", inputNumber(structuredInput, "legacy", "targetPrice", 0));
  const baseRoas = inputNumber(structuredInput, "salesFees", "baseRoas", 3);
  const baseReturnRate = rate(inputNumber(structuredInput, "salesFees", "returnRate", 8));
  const baseCreatorRate = rate(inputNumber(structuredInput, "salesFees", "creatorCommissionRate", 10));
  const baseLastMileFee = inputNumber(structuredInput, "salesFees", "lastMileFee", 0);
  const baseDiscountRate = rate(inputNumber(structuredInput, "salesFees", "discountRate", 0));
  const inventory = financialModel.inputs?.suggestedFirstBatchInventory || inputNumber(structuredInput, "supplyChain", "currentInventory", 0);
  const baseUnits = Math.max(1, Math.round(inventory * 0.6));

  const scenarioParams = [
    {
      id: "conservative",
      name: "保守",
      salePrice: baseSalePrice * 0.92,
      units: Math.max(1, Math.round(baseUnits * 0.55)),
      roas: Math.max(0.5, baseRoas * 0.72),
      conversionRate: 0.015,
      returnRate: Math.min(0.35, baseReturnRate * 1.45),
      creatorCommissionRate: baseCreatorRate * 1.15,
      lastMileFee: baseLastMileFee * 1.08,
      discountRate: Math.min(0.35, baseDiscountRate + 0.08),
      sellThroughRate: 0.45
    },
    {
      id: "base",
      name: "基准",
      salePrice: baseSalePrice,
      units: baseUnits,
      roas: baseRoas,
      conversionRate: 0.025,
      returnRate: baseReturnRate,
      creatorCommissionRate: baseCreatorRate,
      lastMileFee: baseLastMileFee,
      discountRate: baseDiscountRate,
      sellThroughRate: 0.65
    },
    {
      id: "optimistic",
      name: "乐观",
      salePrice: baseSalePrice * 1.04,
      units: Math.max(1, Math.round(baseUnits * 1.65)),
      roas: baseRoas * 1.35,
      conversionRate: 0.04,
      returnRate: Math.max(0, baseReturnRate * 0.78),
      creatorCommissionRate: baseCreatorRate,
      lastMileFee: baseLastMileFee,
      discountRate: Math.max(0, baseDiscountRate - 0.03),
      sellThroughRate: 0.9
    }
  ];

  return {
    scenarios: scenarioParams.map((params) => ({
      ...params,
      outputs: calculateScenarioOutputs(params, financialModel)
    }))
  };
}

export function calculateScenarioOutputs(params, financialModel = {}) {
  const landedCost = financialModel.formulas?.landedCost || 0;
  const fulfillmentCost = financialModel.formulas?.fulfillmentCost || landedCost;
  const platformFeeRate = params.platformFeeRate ?? 0.1;
  const paymentFeeRate = params.paymentFeeRate ?? 0.03;
  const salePrice = Number(params.salePrice) || 0;
  const units = Number(params.units) || 0;
  const roas = Number(params.roas) || 0;
  const discountRate = rate(params.discountRate);
  const returnRate = rate(params.returnRate);
  const creatorCommissionRate = rate(params.creatorCommissionRate);
  const averageReturnLoss = financialModel.formulas?.returnLossPerUnit && returnRate > 0
    ? financialModel.formulas.returnLossPerUnit / returnRate
    : 0;
  const netRevenuePerUnit = salePrice * (1 - discountRate);
  const revenue = netRevenuePerUnit * units;
  const adCost = roas > 0 ? salePrice * units / roas : 0;
  const creatorCost = revenue * creatorCommissionRate;
  const platformFee = salePrice * platformFeeRate * units;
  const paymentFee = salePrice * paymentFeeRate * units;
  const returnLoss = returnRate * averageReturnLoss * units;
  const fulfillment = (fulfillmentCost + (Number(params.lastMileFee) || 0)) * units;
  const totalCost = fulfillment + platformFee + paymentFee + adCost + creatorCost + returnLoss;
  const netProfit = revenue - totalCost;
  const inventoryBase = Math.max(units, Math.round(units / Math.max(0.01, rate(params.sellThroughRate) || 0.65)));
  const inventoryRemaining = Math.max(0, inventoryBase - units);

  return {
    revenue: roundMoney(revenue),
    totalMarketingCost: roundMoney(adCost + creatorCost),
    netProfit: roundMoney(netProfit),
    netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 10000 : null,
    cashOccupied: roundMoney(inventoryBase * landedCost + adCost + creatorCost),
    inventoryRemaining,
    maxLoss: roundMoney(Math.max(0, -netProfit) + inventoryRemaining * landedCost),
    breakEvenDate: netProfit > 0 ? "测试期内可回正" : "待优化ROAS/售价后复核"
  };
}

export function buildAnnualPlan(structuredInput = {}, financialModel = {}) {
  const annualUnits = inputNumber(structuredInput, "goals", "annualUnitTarget", 0);
  const annualRevenue = inputNumber(structuredInput, "goals", "annualRevenueTarget", 0);
  const salePrice = inputNumber(structuredInput, "salesFees", "targetPrice", inputNumber(structuredInput, "legacy", "targetPrice", 0));
  const totalMarketingBudget = inputNumber(structuredInput, "goals", "totalMarketingBudget", 0);
  const landedCost = financialModel.formulas?.landedCost || 0;
  const profitPerUnit = financialModel.formulas?.netProfitPerUnit || 0;
  const unitsBase = annualUnits || (salePrice > 0 ? Math.round(annualRevenue / salePrice) : 0);
  const today = new Date();
  const startYear = today.getFullYear();
  const phases = [
    { name: "新品测试期", startDate: `${startYear}-08-01`, endDate: `${startYear}-08-31`, unitShare: 0.08, budgetShare: 0.18, stockFactor: 1.4, roas: 2.2, returnRate: 0.1 },
    { name: "放量期", startDate: `${startYear}-09-01`, endDate: `${startYear}-10-15`, unitShare: 0.28, budgetShare: 0.28, stockFactor: 1.25, roas: 3.0, returnRate: 0.08 },
    { name: "黑五爆发期", startDate: `${startYear}-10-16`, endDate: `${startYear}-11-30`, unitShare: 0.38, budgetShare: 0.34, stockFactor: 1.18, roas: 3.4, returnRate: 0.09 },
    { name: "圣诞销售/清库存期", startDate: `${startYear}-12-01`, endDate: `${startYear}-12-31`, unitShare: 0.26, budgetShare: 0.2, stockFactor: 1.05, roas: 2.8, returnRate: 0.11 }
  ].map((phase, index) => {
    const unitTarget = Math.round(unitsBase * phase.unitShare);
    const revenueTarget = roundMoney(unitTarget * salePrice);
    const adBudget = roundMoney(totalMarketingBudget * phase.budgetShare);
    const creatorCommission = roundMoney(revenueTarget * rate(inputNumber(structuredInput, "salesFees", "creatorCommissionRate", 10)));
    const fixedSpend = index === 0 ? 500 : 300;
    const stockQty = Math.ceil(unitTarget * phase.stockFactor);
    const endingInventory = Math.max(0, stockQty - unitTarget);
    const days = daysBetween(phase.startDate, phase.endDate);

    return {
      ...phase,
      unitTarget,
      revenueTarget,
      targetPrice: salePrice,
      stockQty,
      replenishmentQty: index === 0 ? 0 : Math.ceil(unitTarget * 0.35),
      fixedSpend,
      creatorCommission,
      adBudget,
      originalVideoCount: Math.max(10, Math.round(unitTarget / 20)),
      sampleCreatorCount: Math.max(5, Math.round(unitTarget / 30)),
      creatorDeliveredVideoCount: Math.max(3, Math.round(unitTarget / 45)),
      liveSessions: Math.max(2, Math.round(days / 7)),
      liveHours: Math.max(4, Math.round(days / 3)),
      targetRoas: phase.roas,
      targetReturnRate: phase.returnRate,
      targetInventoryTurnoverDays: inputNumber(structuredInput, "goals", "targetInventoryTurnoverDays", 30),
      marketingCost: roundMoney(adBudget + creatorCommission),
      marketingCostRate: revenueTarget > 0 ? Math.round(((adBudget + creatorCommission) / revenueTarget) * 10000) / 10000 : null,
      estimatedProfit: roundMoney(unitTarget * profitPerUnit - fixedSpend),
      cashNeed: roundMoney(stockQty * landedCost + adBudget + creatorCommission + fixedSpend),
      endingInventory,
      inventoryCoverageDays: unitTarget > 0 ? Math.round(endingInventory / (unitTarget / days)) : null
    };
  });

  return {
    phases,
    consistencyWarnings: buildAnnualPlanWarnings(phases, annualUnits, annualRevenue)
  };
}

function buildAnnualPlanWarnings(phases, annualUnits, annualRevenue) {
  const plannedUnits = phases.reduce((sum, phase) => sum + phase.unitTarget, 0);
  const plannedRevenue = phases.reduce((sum, phase) => sum + (phase.revenueTarget || 0), 0);
  const warnings = [];

  if (annualUnits > 0 && Math.abs(plannedUnits - annualUnits) > 2) {
    warnings.push({
      label: "年度阶段销量合计不等于年度销量目标",
      difference: plannedUnits - annualUnits
    });
  }

  if (annualRevenue > 0 && Math.abs(plannedRevenue - annualRevenue) > Math.max(1, annualRevenue * 0.03)) {
    warnings.push({
      label: "年度阶段销售额合计不等于年度销售额目标",
      difference: roundMoney(plannedRevenue - annualRevenue)
    });
  }

  for (const phase of phases) {
    const expectedRevenue = phase.unitTarget * phase.targetPrice;

    if (Math.abs((phase.revenueTarget || 0) - expectedRevenue) > 1) {
      warnings.push({
        label: `${phase.name} 销售额不等于销量乘以售价`,
        difference: roundMoney((phase.revenueTarget || 0) - expectedRevenue)
      });
    }

    if (phase.stockQty < phase.unitTarget) {
      warnings.push({
        label: `${phase.name} 备货量不足以支持销量目标`,
        difference: phase.stockQty - phase.unitTarget
      });
    }
  }

  return warnings;
}

export function buildChannelBreakdown(structuredInput = {}, annualPlan = {}) {
  const annualRevenue = annualPlan.phases?.reduce((sum, phase) => sum + (phase.revenueTarget || 0), 0) ||
    inputNumber(structuredInput, "goals", "annualRevenueTarget", 0);
  const salePrice = inputNumber(structuredInput, "salesFees", "targetPrice", inputNumber(structuredInput, "legacy", "targetPrice", 0));
  const channels = [
    ["商家原创短视频", 0.12, 0.018, 0.035],
    ["AI辅助视频", 0.08, 0.014, 0.025],
    ["达人短视频", 0.22, 0.022, 0.04],
    ["自营直播", 0.12, 0.03, 0.055],
    ["达人直播", 0.12, 0.028, 0.05],
    ["机构直播", 0.06, 0.026, 0.045],
    ["商品卡", 0.08, 0.016, 0.032],
    ["广告投放", 0.12, 0.02, 0.038],
    ["Amazon回流", 0.05, 0.018, 0.04],
    ["Walmart回流", 0.02, 0.015, 0.03],
    ["DTC沉淀", 0.01, 0.012, 0.025]
  ];

  return {
    channels: channels.map(([name, share, ctr, conversionRate]) => {
      const revenueTarget = annualRevenue * share;
      const unitTarget = salePrice > 0 ? Math.round(revenueTarget / salePrice) : 0;
      const visits = conversionRate > 0 ? Math.ceil(unitTarget / conversionRate) : 0;
      const clicks = visits;
      const exposure = ctr > 0 ? Math.ceil(clicks / ctr) : 0;
      const adCost = name === "广告投放" ? roundMoney(revenueTarget / 3) : 0;
      const commissionRate = rate(inputNumber(structuredInput, "salesFees", "creatorCommissionRate", 10));

      return {
        name,
        revenueTarget: roundMoney(revenueTarget),
        unitTarget,
        contentCount: Math.max(1, Math.round(unitTarget / 25)),
        trafficTarget: exposure,
        ctr,
        conversionRate,
        adCost,
        sampleCost: name.includes("达人") ? roundMoney(unitTarget * 1.5) : 0,
        fixedCooperationCost: name.includes("机构") ? 1000 : 0,
        commissionRate: name.includes("达人") || name.includes("直播") ? commissionRate : 0,
        funnel: {
          exposure,
          clicks,
          productPageVisits: visits,
          addToCart: Math.ceil(visits * 0.35),
          orders: unitTarget
        }
      };
    })
  };
}

export function evaluateGate(structuredInput = {}, financialModel = {}, actual = {}) {
  const breakEvenRoas = financialModel.formulas?.breakEvenRoas || 0;
  const rules = [
    ["累计完成100单", (actual.orders || 0) >= 100, `${actual.orders || 0}/100`],
    ["退货率低于8%", rate(actual.returnRate ?? inputNumber(structuredInput, "salesFees", "returnRate", 99)) < 0.08, `${((actual.returnRate ?? inputNumber(structuredInput, "salesFees", "returnRate", 99)) > 1 ? actual.returnRate ?? inputNumber(structuredInput, "salesFees", "returnRate", 99) : rate(actual.returnRate ?? inputNumber(structuredInput, "salesFees", "returnRate", 99)) * 100).toFixed(2)}%`],
    ["商品评分高于4.2", (actual.rating || 0) > 4.2, `${actual.rating || "待确认"}`],
    ["至少3条素材产生订单", (actual.orderingAssets || 0) >= 3, `${actual.orderingAssets || 0}/3`],
    ["至少5名达人产生订单", (actual.orderingCreators || 0) >= 5, `${actual.orderingCreators || 0}/5`],
    ["付费ROAS高于盈亏平衡ROAS", (actual.paidRoas || 0) > breakEvenRoas, `${actual.paidRoas || "待确认"} / ${breakEvenRoas || "待确认"}`],
    ["售后没有集中质量缺陷", actual.qualityIssueCluster === false, actual.qualityIssueCluster === false ? "未发现" : "待确认"]
  ].map(([label, passed, evidence]) => ({
    label,
    passed,
    evidence,
    reason: passed ? "达到进入下一阶段条件。" : "未达到或缺少真实测试数据。"
  }));
  const passedCount = rules.filter((item) => item.passed).length;
  const result = passedCount >= 6 ? "通过" : passedCount >= 4 ? "有条件通过" : passedCount >= 2 ? "暂停补货" : "建议终止项目";

  return {
    result,
    passedCount,
    totalRules: rules.length,
    failedReasons: rules.filter((item) => !item.passed).map((item) => item.label),
    rules
  };
}

export function buildRiskRegister(structuredInput = {}, financialModel = {}, aiReport = {}) {
  const returnRate = rate(inputNumber(structuredInput, "salesFees", "returnRate", 0));
  const hasBattery = Boolean(structuredInput.supplyChain?.hasBattery?.value);
  const isLiquid = Boolean(structuredInput.supplyChain?.isLiquid?.value);
  const needsCertification = Boolean(structuredInput.supplyChain?.needsSpecialCertification?.value);
  const netMargin = financialModel.formulas?.netMargin || 0;
  const category = structuredInput.basicInfo?.category?.value || "待确认";
  const baseRisks = [
    ["市场需求风险", 0.45, 0.65, "缺少真实销量、搜索和广告转化数据。", "7天点击率/加购率低于目标", "先小预算测试，不直接放量。", "运营负责人"],
    ["定价风险", netMargin < 0.15 ? 0.7 : 0.35, 0.7, `基准净利润率为 ${netMargin ? (netMargin * 100).toFixed(2) : "待确认"}%。`, "折扣后净利低于目标", "重算售价、佣金和ROAS。", "财务负责人"],
    ["产品同质化风险", 0.5, 0.55, "竞品差异仍需人工验证。", "评论中频繁出现可替代/太贵", "提炼可拍摄差异点。", "选品经理"],
    ["内容传播风险", 0.45, 0.6, aiReport.aiEngine?.scoreInsight || "短视频表现未验证。", "前20条素材无订单", "重做前三秒钩子和演示脚本。", "内容负责人"],
    ["达人履约风险", 0.4, 0.55, "达人寄样出单率未验证。", "寄样后7天未发视频", "设置履约节点和替补达人池。", "达人运营"],
    ["广告成本风险", 0.5, 0.7, "付费ROAS需要高于盈亏平衡ROAS。", "ROAS连续3天低于盈亏平衡", "暂停广告或降低出价。", "投放负责人"],
    ["退货售后风险", returnRate > 0.08 ? 0.75 : 0.35, 0.75, `输入退货率为 ${(returnRate * 100).toFixed(2)}%。`, "退货原因集中在质量/尺寸/效果", "优化详情页预期和售后SOP。", "客服负责人"],
    ["供应链风险", 0.38, 0.62, "生产周期、MOQ和首批供货量需要复核。", "补货周期超过销售窗口", "锁定备货上限和替代供应商。", "供应链负责人"],
    ["库存风险", 0.45, 0.7, "库存现金占用由公式测算，仍需真实周转验证。", "库存覆盖天数高于目标", "设置停止补货线。", "运营负责人"],
    ["平台合规风险", hasBattery || isLiquid || needsCertification ? 0.75 : 0.25, 0.8, "带电、液体或特殊认证会增加平台审核风险。", "资质/认证文件缺失", "上线前完成资质清单。", "风控负责人"],
    ["知识产权风险", 0.35, 0.75, "外观专利、商标和素材版权未扫描。", "竞品投诉/平台警告", "人工检索专利商标。", "法务/风控"],
    ["季节性风险", 0.4, 0.55, `${category} 是否强季节性需要Google Trends复核。`, "搜索热度下滑或销售窗口不足", "按阶段控制库存。", "运营负责人"]
  ];

  return {
    risks: baseRisks.map(([name, probability, impact, basis, warningSignal, mitigation, owner]) => ({
      name,
      level: probability * impact >= 0.45 ? "高" : probability * impact >= 0.25 ? "中" : "低",
      probability,
      impact,
      basis,
      warningSignal,
      mitigation,
      owner,
      dueDate: "上线前"
    }))
  };
}

export function buildOperatingPlan(structuredInput = {}, financialModel = {}, aiReport = {}) {
  const scenarioSimulation = buildScenarioSimulation(structuredInput, financialModel);
  const annualPlan = buildAnnualPlan(structuredInput, financialModel);
  const channelBreakdown = buildChannelBreakdown(structuredInput, annualPlan);
  const gateDecision = evaluateGate(structuredInput, financialModel);
  const riskRegister = buildRiskRegister(structuredInput, financialModel, aiReport);

  return {
    scenarioSimulation,
    annualPlan,
    channelBreakdown,
    gateDecision,
    riskRegister
  };
}
