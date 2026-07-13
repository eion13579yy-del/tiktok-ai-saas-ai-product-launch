import assert from "node:assert/strict";
import { createDataPoint } from "../src/domain/data-source.js";
import { calculateFinancialModel } from "../src/domain/financial-engine.js";
import { runConsistencyChecks } from "../src/domain/consistency-check.js";
import { buildDecisionDashboard } from "../src/domain/decision-engine.js";

function point(value) {
  return createDataPoint(value, { sourceType: "user_input", isConfirmed: true });
}

const structuredInput = {
  basicInfo: {
    productName: point("测试产品"),
    category: point("Kitchen"),
    targetPlatforms: point(["TikTok", "Amazon"])
  },
  supplyChain: {
    factoryPrice: point(10),
    currentInventory: point(120),
    productionLeadTimeDays: point(21),
    maxFirstBatchSupply: point(100),
    hasBattery: point(false),
    needsSpecialCertification: point(false)
  },
  salesFees: {
    targetPrice: point(40),
    discountRate: point(0),
    dutyRate: point(10),
    internationalFreight: point(2),
    customsFee: point(1),
    lastMileFee: point(3),
    fuelSurcharge: point(0.5),
    warehouseFee: point(1),
    platformFeeRate: point(10),
    creatorCommissionRate: point(10),
    baseRoas: point(4),
    returnRate: point(5),
    averageReturnLoss: point(8),
    paymentFeeRate: point(3),
    otherVariableCost: point(1),
    targetNetMargin: point(2)
  },
  goals: {
    annualUnitTarget: point(100),
    annualRevenueTarget: point(4000),
    firstBatchInventoryBudget: point(1400),
    totalMarketingBudget: point(500),
    testCycleDays: point(14)
  }
};

const financialModel = calculateFinancialModel(structuredInput);

assert.equal(financialModel.formulas.landedCost, 14);
assert.equal(financialModel.formulas.fulfillmentCost, 18.5);
assert.equal(financialModel.formulas.platformFee, 4);
assert.equal(financialModel.formulas.creatorCommissionPerOrder, 4);
assert.equal(financialModel.formulas.adCostPerOrder, 10);
assert.equal(financialModel.formulas.returnLossPerUnit, 0.4);
assert.equal(financialModel.formulas.totalCostPerUnit, 39.1);
assert.equal(financialModel.formulas.netProfitPerUnit, 0.9);
assert.equal(financialModel.formulas.netMargin, 0.0225);
assert.equal(financialModel.formulas.firstBatchCashNeed, 1400);

const consistencyChecks = runConsistencyChecks(structuredInput, financialModel);
assert.equal(consistencyChecks.find((item) => item.id === "annual-revenue-math")?.status, "passed");
assert.equal(consistencyChecks.find((item) => item.id === "first-batch-budget")?.status, "passed");

const dashboard = buildDecisionDashboard(
  { productName: "测试产品", competitorLinks: ["https://example.com"] },
  structuredInput,
  financialModel,
  { aiEngine: { aiScore: { demandScore: 75, competitionScore: 68, viralityScore: 82, riskScore: 70 } } },
  consistencyChecks
);

assert.match(dashboard.recommendationGrade, /^[ABCD]$/);
assert.equal(dashboard.dimensions.length, 7);
assert.equal(dashboard.suggestedFirstBatchInventory, 100);

console.log("financial-engine-test passed");
