import assert from "node:assert/strict";
import { createDataPoint } from "../src/domain/data-source.js";
import { calculateFinancialModel } from "../src/domain/financial-engine.js";
import { buildDecisionDashboard } from "../src/domain/decision-engine.js";
import { buildOperatingPlan } from "../src/domain/operating-engine.js";
import { buildVisualizationReport } from "../src/domain/visualization-report.js";

function point(value) {
  return createDataPoint(value, { sourceType: "user_input", isConfirmed: true });
}

const project = {
  productName: "高端测试产品",
  category: "Home",
  targetMarket: "United States",
  platforms: ["TikTok", "Amazon"]
};

const structuredInput = {
  basicInfo: {
    productName: point(project.productName),
    category: point(project.category),
    targetPlatforms: point(project.platforms)
  },
  supplyChain: {
    factoryPrice: point(28),
    currentInventory: point(300),
    productionLeadTimeDays: point(25),
    maxFirstBatchSupply: point(220)
  },
  salesFees: {
    targetPrice: point(89),
    discountRate: point(5),
    dutyRate: point(8),
    internationalFreight: point(5),
    customsFee: point(1.5),
    lastMileFee: point(8),
    warehouseFee: point(1),
    platformFeeRate: point(10),
    creatorCommissionRate: point(12),
    baseRoas: point(3.5),
    returnRate: point(8),
    averageReturnLoss: point(16),
    paymentFeeRate: point(3),
    otherVariableCost: point(1.2)
  },
  goals: {
    annualUnitTarget: point(1200),
    annualRevenueTarget: point(106800),
    firstBatchInventoryBudget: point(9000),
    totalMarketingBudget: point(15000),
    targetInventoryTurnoverDays: point(35)
  }
};

const generated = {
  opportunityScore: 78,
  riskLevel: "medium",
  status: "completed",
  summary: "测试报告",
  recommendation: "谨慎测试",
  dataCredibilityScore: 72,
  productEvaluationModel: {
    totalScore: 78,
    dimensions: [
      { key: "demandScore", score: 82 },
      { key: "competitionScore", score: 66 },
      { key: "viralityScore", score: 84 },
      { key: "marginScore", score: 71 },
      { key: "riskScore", score: 68 }
    ]
  }
};

const financialModel = calculateFinancialModel(structuredInput);
const consistencyChecks = [];
const decisionDashboard = buildDecisionDashboard(project, structuredInput, financialModel, generated, consistencyChecks);
const operatingPlan = buildOperatingPlan(structuredInput, financialModel, generated);
const report = {
  ...generated,
  version: 1,
  generatedAt: "2026-07-13T00:00:00.000Z",
  financialModel,
  decisionDashboard,
  consistencyChecks,
  ...operatingPlan
};

const visualization = buildVisualizationReport(project, report, { timestamp: report.generatedAt });

assert.equal(visualization.dashboardConfig.navigation.length, 14);
assert.ok(visualization.theme.themes.length >= 3);
assert.ok(visualization.metrics.length >= 8);
assert.ok(visualization.charts.length >= 7);
assert.ok(visualization.charts.every((chart) => chart.id && chart.type && chart.summary));
assert.ok(visualization.charts.every((chart) => chart.series.every((serie) => Array.isArray(serie.data))));
assert.ok(
  visualization.charts
    .flatMap((chart) => chart.series)
    .flatMap((serie) => serie.data)
    .every((point) => Object.hasOwn(point, "sourceType") && Object.hasOwn(point, "confidenceLevel") && Object.hasOwn(point, "isEstimated"))
);

console.log("visualization-report-test passed");
