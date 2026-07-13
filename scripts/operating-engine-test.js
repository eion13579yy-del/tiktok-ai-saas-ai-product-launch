import assert from "node:assert/strict";
import { createDataPoint } from "../src/domain/data-source.js";
import { calculateFinancialModel } from "../src/domain/financial-engine.js";
import {
  buildAnnualPlan,
  buildChannelBreakdown,
  buildOperatingPlan,
  buildRiskRegister,
  buildScenarioSimulation,
  calculateScenarioOutputs,
  evaluateGate
} from "../src/domain/operating-engine.js";

function point(value) {
  return createDataPoint(value, { sourceType: "user_input", isConfirmed: true });
}

const structuredInput = {
  basicInfo: {
    productName: point("季节性制冰机"),
    category: point("Seasonal appliance"),
    targetPlatforms: point(["TikTok", "Amazon"])
  },
  supplyChain: {
    factoryPrice: point(22),
    currentInventory: point(300),
    productionLeadTimeDays: point(28),
    maxFirstBatchSupply: point(240),
    hasBattery: point(false),
    isLiquid: point(false),
    needsSpecialCertification: point(true)
  },
  salesFees: {
    targetPrice: point(89),
    discountRate: point(5),
    dutyRate: point(8),
    internationalFreight: point(5),
    customsFee: point(1.5),
    lastMileFee: point(8),
    warehouseFee: point(1.2),
    platformFeeRate: point(12),
    creatorCommissionRate: point(12),
    baseRoas: point(3.2),
    returnRate: point(9),
    averageReturnLoss: point(18),
    paymentFeeRate: point(3),
    otherVariableCost: point(1.5)
  },
  goals: {
    annualUnitTarget: point(1000),
    annualRevenueTarget: point(89000),
    firstBatchInventoryBudget: point(7500),
    totalMarketingBudget: point(12000),
    targetInventoryTurnoverDays: point(35)
  }
};

const financialModel = calculateFinancialModel(structuredInput);
const scenarios = buildScenarioSimulation(structuredInput, financialModel);

assert.equal(scenarios.scenarios.length, 3);
assert.ok(scenarios.scenarios.every((scenario) => scenario.outputs.revenue !== null));

const recalculated = calculateScenarioOutputs(scenarios.scenarios[1], financialModel);
assert.equal(recalculated.revenue, scenarios.scenarios[1].outputs.revenue);

const annualPlan = buildAnnualPlan(structuredInput, financialModel);
assert.equal(annualPlan.phases.length, 4);
assert.ok(annualPlan.phases.every((phase) => phase.cashNeed !== null));

const channelBreakdown = buildChannelBreakdown(structuredInput, annualPlan);
assert.equal(channelBreakdown.channels.length, 11);
assert.ok(channelBreakdown.channels.every((channel) => channel.funnel.orders === channel.unitTarget));

const gate = evaluateGate(structuredInput, financialModel, {
  orders: 120,
  returnRate: 0.05,
  rating: 4.5,
  orderingAssets: 4,
  orderingCreators: 6,
  paidRoas: 5,
  qualityIssueCluster: false
});
assert.equal(gate.result, "通过");

const risks = buildRiskRegister(structuredInput, financialModel, {});
assert.equal(risks.risks.length, 12);
assert.ok(risks.risks.some((risk) => risk.name === "平台合规风险"));

const operatingPlan = buildOperatingPlan(structuredInput, financialModel, {});
assert.equal(operatingPlan.annualPlan.phases.length, 4);
assert.equal(operatingPlan.channelBreakdown.channels.length, 11);
assert.equal(operatingPlan.riskRegister.risks.length, 12);

console.log("operating-engine-test passed");
