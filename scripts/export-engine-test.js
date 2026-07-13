import assert from "node:assert/strict";
import { buildDocx, buildExportPayload, buildXlsx } from "../src/domain/export-engine.js";

const project = {
  id: "project-1",
  productName: "测试产品",
  category: "Kitchen",
  targetMarket: "美国",
  platforms: ["TikTok", "Amazon"]
};
const report = {
  id: "report-1",
  version: 2,
  status: "completed",
  generatedAt: "2026-07-13T00:00:00.000Z",
  summary: "测试摘要",
  recommendation: "小测",
  decisionDashboard: {
    recommendationGrade: "B",
    suggestedAction: "小测",
    suggestedFirstBatchInventory: 100,
    suggestedTestBudget: "$1,000.00",
    biggestRisk: "退货风险",
    nextValidationAction: "验证真实订单"
  },
  financialModel: {
    formulas: {
      landedCost: 12,
      fulfillmentCost: 18,
      totalCostPerUnit: 30,
      netProfitPerUnit: 8,
      netMargin: 0.2,
      breakEvenRoas: 2.5
    }
  },
  scenarioSimulation: {
    scenarios: [{ name: "基准", outputs: { revenue: 4000, totalMarketingCost: 500, netProfit: 800, netMargin: 0.2 } }]
  },
  annualPlan: {
    phases: [{ name: "新品测试期", unitTarget: 100, revenueTarget: 4000, stockQty: 120, cashNeed: 2000 }]
  },
  channelBreakdown: {
    channels: [{ name: "达人短视频", revenueTarget: 1000, unitTarget: 25, funnel: { exposure: 10000, clicks: 200, orders: 25 } }]
  },
  riskRegister: {
    risks: [{ name: "市场需求风险", level: "中", probability: 0.4, impact: 0.6, basis: "待验证", mitigation: "小测" }]
  },
  dataSourceMap: {
    salesFees: {
      targetPrice: { sourceType: "user_input", value: 40, confidenceLevel: 80 }
    }
  },
  sections: [{ type: "decision_center", title: "决策中心", content: "测试内容" }]
};

const payload = buildExportPayload(project, report);
assert.equal(payload.product.productName, "测试产品");
assert.equal(payload.report.version, 2);

const docx = buildDocx(project, report);
assert.equal(docx.readUInt32LE(0), 0x04034b50);
assert.ok(docx.length > 1000);

const xlsx = buildXlsx(project, report);
assert.equal(xlsx.readUInt32LE(0), 0x04034b50);
assert.ok(xlsx.length > 2000);

console.log("export-engine-test passed");
