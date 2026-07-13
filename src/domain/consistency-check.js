import { dataPointNumber } from "./data-source.js";

function number(input, group, field, fallback = null) {
  return dataPointNumber(input?.[group]?.[field], fallback);
}

function warning(id, label, expected, actual, difference, severity = "warning") {
  return {
    id,
    label,
    status: "failed",
    severity,
    expected,
    actual,
    difference
  };
}

export function runConsistencyChecks(structuredInput = {}, financialModel = {}) {
  const checks = [];
  const salePrice = number(structuredInput, "salesFees", "targetPrice", number(structuredInput, "legacy", "targetPrice", 0));
  const annualUnitTarget = number(structuredInput, "goals", "annualUnitTarget", 0);
  const annualRevenueTarget = number(structuredInput, "goals", "annualRevenueTarget", 0);
  const firstBatchBudget = number(structuredInput, "goals", "firstBatchInventoryBudget", 0);
  const maxFirstBatchSupply = number(structuredInput, "supplyChain", "maxFirstBatchSupply", 0);
  const landedCost = financialModel.formulas?.landedCost || 0;
  const expectedRevenue = salePrice * annualUnitTarget;

  if (annualRevenueTarget > 0 && expectedRevenue > 0) {
    const difference = Math.round((annualRevenueTarget - expectedRevenue) * 100) / 100;
    checks.push(
      Math.abs(difference) <= 1
        ? {
          id: "annual-revenue-math",
          label: "年度销售额 = 年度销量 × 售价",
          status: "passed",
          severity: "ok",
          expected: expectedRevenue,
          actual: annualRevenueTarget,
          difference
        }
        : warning("annual-revenue-math", "年度销售额 = 年度销量 × 售价", expectedRevenue, annualRevenueTarget, difference)
    );
  }

  if (firstBatchBudget > 0 && landedCost > 0 && maxFirstBatchSupply > 0) {
    const affordableUnits = Math.floor(firstBatchBudget / landedCost);
    const difference = affordableUnits - maxFirstBatchSupply;
    checks.push(
      affordableUnits >= maxFirstBatchSupply
        ? {
          id: "first-batch-budget",
          label: "首批备货预算支持最大可供货量",
          status: "passed",
          severity: "ok",
          expected: maxFirstBatchSupply,
          actual: affordableUnits,
          difference
        }
        : warning("first-batch-budget", "首批备货预算支持最大可供货量", maxFirstBatchSupply, affordableUnits, difference, "danger")
    );
  }

  if ((financialModel.formulas?.netMargin ?? null) !== null) {
    const targetNetMargin = number(structuredInput, "salesFees", "targetNetMargin", null);

    if (targetNetMargin !== null) {
      const targetRate = targetNetMargin > 1 ? targetNetMargin / 100 : targetNetMargin;
      const actual = financialModel.formulas.netMargin;
      const difference = Math.round((actual - targetRate) * 10000) / 10000;
      checks.push(
        actual >= targetRate
          ? {
            id: "target-margin",
            label: "基准净利润率达到目标",
            status: "passed",
            severity: "ok",
            expected: targetRate,
            actual,
            difference
          }
          : warning("target-margin", "基准净利润率达到目标", targetRate, actual, difference, "danger")
      );
    }
  }

  if (checks.length === 0) {
    checks.push({
      id: "data-completeness",
      label: "一致性校验",
      status: "pending",
      severity: "warning",
      expected: "需要销售额目标、销量目标、备货预算等数据",
      actual: "待确认",
      difference: "待确认"
    });
  }

  return checks;
}
