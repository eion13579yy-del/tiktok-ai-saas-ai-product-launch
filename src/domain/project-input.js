import { createDataPoint } from "./data-source.js";

const FIELD_GROUPS = {
  basicInfo: [
    "productName",
    "category",
    "description",
    "targetCountry",
    "targetPlatforms",
    "targetLaunchDate",
    "productImageUrl",
    "manualUrl",
    "competitorLinks"
  ],
  supplyChain: [
    "factoryPrice",
    "moq",
    "productionLeadTimeDays",
    "packageLength",
    "packageWidth",
    "packageHeight",
    "grossWeight",
    "netWeight",
    "hasBattery",
    "isLiquid",
    "isChildrenProduct",
    "needsSpecialCertification",
    "currentInventory",
    "overseasWarehouseInventory",
    "maxFirstBatchSupply",
    "qualityOwner"
  ],
  salesFees: [
    "targetPrice",
    "minimumPrice",
    "discountRate",
    "dutyRate",
    "internationalFreight",
    "customsFee",
    "lastMileFee",
    "fuelSurcharge",
    "warehouseFee",
    "platformFeeRate",
    "creatorCommissionRate",
    "adBudgetRate",
    "baseRoas",
    "returnRate",
    "averageReturnLoss",
    "paymentFeeRate",
    "otherVariableCost",
    "targetNetMargin"
  ],
  goals: [
    "testCycleDays",
    "annualRevenueTarget",
    "annualUnitTarget",
    "firstBatchInventoryBudget",
    "totalMarketingBudget",
    "maxAcceptableLoss",
    "targetInventoryTurnoverDays"
  ]
};

const NUMERIC_FIELDS = new Set([
  "factoryPrice",
  "moq",
  "productionLeadTimeDays",
  "packageLength",
  "packageWidth",
  "packageHeight",
  "grossWeight",
  "netWeight",
  "currentInventory",
  "overseasWarehouseInventory",
  "maxFirstBatchSupply",
  "targetPrice",
  "minimumPrice",
  "discountRate",
  "dutyRate",
  "internationalFreight",
  "customsFee",
  "lastMileFee",
  "fuelSurcharge",
  "warehouseFee",
  "platformFeeRate",
  "creatorCommissionRate",
  "adBudgetRate",
  "baseRoas",
  "returnRate",
  "averageReturnLoss",
  "paymentFeeRate",
  "otherVariableCost",
  "targetNetMargin",
  "testCycleDays",
  "annualRevenueTarget",
  "annualUnitTarget",
  "firstBatchInventoryBudget",
  "totalMarketingBudget",
  "maxAcceptableLoss",
  "targetInventoryTurnoverDays"
]);

const BOOLEAN_FIELDS = new Set(["hasBattery", "isLiquid", "isChildrenProduct", "needsSpecialCertification"]);
const MONEY_FIELDS = new Set([
  "factoryPrice",
  "targetPrice",
  "minimumPrice",
  "internationalFreight",
  "customsFee",
  "lastMileFee",
  "fuelSurcharge",
  "warehouseFee",
  "averageReturnLoss",
  "otherVariableCost",
  "annualRevenueTarget",
  "firstBatchInventoryBudget",
  "totalMarketingBudget",
  "maxAcceptableLoss"
]);
const RATE_FIELDS = new Set([
  "discountRate",
  "dutyRate",
  "platformFeeRate",
  "creatorCommissionRate",
  "adBudgetRate",
  "returnRate",
  "paymentFeeRate",
  "targetNetMargin"
]);

export function normalizeStructuredInput(body = {}) {
  const structuredInput = {};

  for (const [group, fields] of Object.entries(FIELD_GROUPS)) {
    structuredInput[group] = {};

    for (const field of fields) {
      const isConfirmed = body[`${field}IsConfirmed`] === undefined
        ? undefined
        : body[`${field}IsConfirmed`] === true || body[`${field}IsConfirmed`] === "on";

      structuredInput[group][field] = createDataPoint(normalizeFieldValue(body[field], field), {
        currency: MONEY_FIELDS.has(field) ? body[`${field}Currency`] || "USD" : "",
        unit: unitForField(field),
        sourceType: body[`${field}SourceType`],
        sourceUrl: body[`${field}SourceUrl`],
        sourceDate: body[`${field}SourceDate`],
        sampleSize: normalizeNumber(body[`${field}SampleSize`]),
        confidenceLevel: normalizeNumber(body[`${field}ConfidenceLevel`]),
        note: body[`${field}Note`] || "",
        isConfirmed
      });
    }
  }

  structuredInput.legacy = {
    targetPrice: createDataPoint(normalizeNumber(body.targetPrice), { currency: "USD", sourceType: "user_input" }),
    costPrice: createDataPoint(normalizeNumber(body.costPrice), { currency: "USD", sourceType: "user_input" }),
    inventory: createDataPoint(normalizeNumber(body.inventory), { unit: "unit", sourceType: "user_input" }),
    leadTimeDays: createDataPoint(normalizeNumber(body.leadTimeDays), { unit: "day", sourceType: "user_input" })
  };

  return structuredInput;
}

export function flattenProjectFromStructuredInput(structuredInput) {
  const platforms = structuredInput.basicInfo?.targetPlatforms?.value;

  return {
    productName: structuredInput.basicInfo?.productName?.value || "",
    category: structuredInput.basicInfo?.category?.value || "Uncategorized",
    targetMarket: structuredInput.basicInfo?.targetCountry?.value || "美国",
    platforms: Array.isArray(platforms) ? platforms : [],
    competitorLinks: Array.isArray(structuredInput.basicInfo?.competitorLinks?.value)
      ? structuredInput.basicInfo.competitorLinks.value
      : [],
    targetPrice: structuredInput.salesFees?.targetPrice?.value ?? structuredInput.legacy?.targetPrice?.value ?? null,
    costPrice: structuredInput.supplyChain?.factoryPrice?.value ?? structuredInput.legacy?.costPrice?.value ?? null,
    inventory: structuredInput.supplyChain?.currentInventory?.value ?? structuredInput.legacy?.inventory?.value ?? null,
    leadTimeDays: structuredInput.supplyChain?.productionLeadTimeDays?.value ?? structuredInput.legacy?.leadTimeDays?.value ?? null
  };
}

function normalizeFieldValue(value, field) {
  if (field === "targetPlatforms") {
    return Array.isArray(value) ? value : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  }

  if (field === "competitorLinks") {
    return Array.isArray(value)
      ? value.filter(Boolean)
      : String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  if (BOOLEAN_FIELDS.has(field)) {
    return value === true || value === "on" || value === "true";
  }

  if (NUMERIC_FIELDS.has(field)) {
    return normalizeNumber(value);
  }

  return String(value || "").trim();
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unitForField(field) {
  if (RATE_FIELDS.has(field)) {
    return "%";
  }

  if (field.endsWith("Days")) {
    return "day";
  }

  if (field.includes("Weight")) {
    return "kg";
  }

  if (field.includes("Length") || field.includes("Width") || field.includes("Height")) {
    return "cm";
  }

  if (["moq", "currentInventory", "overseasWarehouseInventory", "maxFirstBatchSupply", "annualUnitTarget"].includes(field)) {
    return "unit";
  }

  return "";
}
