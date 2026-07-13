import { dataPointNumber } from "./data-source.js";

function value(input, group, field, fallback = null) {
  return dataPointNumber(input?.[group]?.[field], fallback);
}

function roundMoney(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

function roundRate(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10000) / 10000;
}

function percentToRate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number > 1 ? number / 100 : number;
}

export function calculateFinancialModel(structuredInput = {}) {
  const salePrice = value(structuredInput, "salesFees", "targetPrice", value(structuredInput, "legacy", "targetPrice", 0));
  const factoryPrice = value(structuredInput, "supplyChain", "factoryPrice", value(structuredInput, "legacy", "costPrice", 0));
  const annualUnitTarget = value(structuredInput, "goals", "annualUnitTarget", 0);
  const firstBatchBudget = value(structuredInput, "goals", "firstBatchInventoryBudget", 0);
  const currentInventory = value(structuredInput, "supplyChain", "currentInventory", value(structuredInput, "legacy", "inventory", 0));
  const maxFirstBatchSupply = value(structuredInput, "supplyChain", "maxFirstBatchSupply", currentInventory || 0);
  const leadTimeDays = value(structuredInput, "supplyChain", "productionLeadTimeDays", value(structuredInput, "legacy", "leadTimeDays", 0));

  const dutyRate = percentToRate(value(structuredInput, "salesFees", "dutyRate", 0));
  const internationalFreight = value(structuredInput, "salesFees", "internationalFreight", 0);
  const customsFee = value(structuredInput, "salesFees", "customsFee", 0);
  const lastMileFee = value(structuredInput, "salesFees", "lastMileFee", 0);
  const fuelSurcharge = value(structuredInput, "salesFees", "fuelSurcharge", 0);
  const warehouseFee = value(structuredInput, "salesFees", "warehouseFee", 0);
  const platformFeeRate = percentToRate(value(structuredInput, "salesFees", "platformFeeRate", 0));
  const creatorCommissionRate = percentToRate(value(structuredInput, "salesFees", "creatorCommissionRate", 0));
  const roas = value(structuredInput, "salesFees", "baseRoas", 0);
  const returnRate = percentToRate(value(structuredInput, "salesFees", "returnRate", 0));
  const averageReturnLoss = value(structuredInput, "salesFees", "averageReturnLoss", 0);
  const paymentFeeRate = percentToRate(value(structuredInput, "salesFees", "paymentFeeRate", 0));
  const otherVariableCost = value(structuredInput, "salesFees", "otherVariableCost", 0);
  const discountRate = percentToRate(value(structuredInput, "salesFees", "discountRate", 0));

  const netRevenue = salePrice * (1 - discountRate);
  const duty = factoryPrice * dutyRate;
  const landedCost = factoryPrice + duty + internationalFreight + customsFee;
  const fulfillmentCost = landedCost + lastMileFee + fuelSurcharge + warehouseFee;
  const platformFee = salePrice * platformFeeRate;
  const creatorCommissionPerOrder = netRevenue * creatorCommissionRate;
  const adCostPerOrder = roas > 0 ? salePrice / roas : 0;
  const returnLossPerUnit = returnRate * averageReturnLoss;
  const paymentFee = salePrice * paymentFeeRate;
  const totalCostPerUnit =
    fulfillmentCost +
    platformFee +
    adCostPerOrder +
    creatorCommissionPerOrder +
    returnLossPerUnit +
    paymentFee +
    otherVariableCost;
  const netProfitPerUnit = netRevenue - totalCostPerUnit;
  const netMargin = netRevenue > 0 ? netProfitPerUnit / netRevenue : null;

  const preAdContribution =
    netRevenue -
    fulfillmentCost -
    platformFee -
    creatorCommissionPerOrder -
    returnLossPerUnit -
    paymentFee -
    otherVariableCost;
  const maxAdCostPerOrder = Math.max(0, preAdContribution);
  const breakEvenRoas = maxAdCostPerOrder > 0 ? salePrice / maxAdCostPerOrder : null;
  const maxCreatorCommissionRate = netRevenue > 0
    ? Math.max(0, (netRevenue - fulfillmentCost - platformFee - adCostPerOrder - returnLossPerUnit - paymentFee - otherVariableCost) / netRevenue)
    : null;
  const breakEvenSalePrice = totalCostPerUnit / Math.max(0.01, 1 - discountRate);
  const maxCustomerAcquisitionCost = maxAdCostPerOrder;
  const firstBatchInventoryUnits = landedCost > 0 && firstBatchBudget > 0
    ? Math.floor(firstBatchBudget / landedCost)
    : Math.min(currentInventory || 0, maxFirstBatchSupply || currentInventory || 0);
  const suggestedFirstBatchInventory = Math.max(0, Math.min(firstBatchInventoryUnits || 0, maxFirstBatchSupply || firstBatchInventoryUnits || 0));
  const firstBatchCashNeed = suggestedFirstBatchInventory * landedCost;
  const fullInventoryProfit = suggestedFirstBatchInventory * netProfitPerUnit;
  const unsoldInventoryPotentialLoss = suggestedFirstBatchInventory * landedCost;
  const dailyUnitTarget = annualUnitTarget > 0 ? annualUnitTarget / 365 : 0;
  const cashRecoveryDays = dailyUnitTarget > 0 && netProfitPerUnit > 0 ? firstBatchCashNeed / (dailyUnitTarget * netProfitPerUnit) : null;

  return {
    inputs: {
      salePrice,
      factoryPrice,
      roas,
      returnRate,
      suggestedFirstBatchInventory
    },
    formulas: {
      landedCost: roundMoney(landedCost),
      fulfillmentCost: roundMoney(fulfillmentCost),
      platformFee: roundMoney(platformFee),
      creatorCommissionPerOrder: roundMoney(creatorCommissionPerOrder),
      adCostPerOrder: roundMoney(adCostPerOrder),
      returnLossPerUnit: roundMoney(returnLossPerUnit),
      totalCostPerUnit: roundMoney(totalCostPerUnit),
      netRevenue: roundMoney(netRevenue),
      netProfitPerUnit: roundMoney(netProfitPerUnit),
      netMargin: roundRate(netMargin),
      breakEvenRoas: roundRate(breakEvenRoas),
      maxCreatorCommissionRate: roundRate(maxCreatorCommissionRate),
      breakEvenSalePrice: roundMoney(breakEvenSalePrice),
      maxCustomerAcquisitionCost: roundMoney(maxCustomerAcquisitionCost),
      firstBatchCashNeed: roundMoney(firstBatchCashNeed),
      fullInventoryProfit: roundMoney(fullInventoryProfit),
      unsoldInventoryPotentialLoss: roundMoney(unsoldInventoryPotentialLoss),
      cashRecoveryDays: cashRecoveryDays === null ? null : Math.ceil(cashRecoveryDays)
    },
    assumptions: {
      leadTimeDays,
      currentInventory,
      maxFirstBatchSupply
    }
  };
}
