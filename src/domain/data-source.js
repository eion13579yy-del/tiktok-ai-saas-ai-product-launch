export const SOURCE_TYPES = [
  "user_input",
  "competitor_page",
  "platform_data",
  "review_analysis",
  "industry_benchmark",
  "ai_estimate",
  "unverified"
];

export const SOURCE_TYPE_LABELS = {
  user_input: "用户确认",
  competitor_page: "竞品页面",
  platform_data: "平台数据",
  review_analysis: "评论分析",
  industry_benchmark: "行业基准",
  ai_estimate: "AI估算",
  unverified: "待验证"
};

export function createDataPoint(value, options = {}) {
  const hasValue = value !== undefined && value !== null && value !== "";
  const sourceType = SOURCE_TYPES.includes(options.sourceType)
    ? options.sourceType
    : hasValue
      ? "user_input"
      : "unverified";

  return {
    value: hasValue ? value : null,
    currency: options.currency || "",
    unit: options.unit || "",
    sourceType,
    sourceUrl: options.sourceUrl || "",
    sourceDate: options.sourceDate || "",
    sampleSize: options.sampleSize ?? null,
    confidenceLevel: clampConfidence(options.confidenceLevel ?? (hasValue ? 80 : 0)),
    note: options.note || "",
    isConfirmed: Boolean(options.isConfirmed ?? (sourceType === "user_input" && hasValue))
  };
}

export function dataPointValue(dataPoint, fallback = null) {
  if (!dataPoint || dataPoint.value === undefined || dataPoint.value === null || dataPoint.value === "") {
    return fallback;
  }

  return dataPoint.value;
}

export function dataPointNumber(dataPoint, fallback = null) {
  const value = dataPointValue(dataPoint, fallback);
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

export function dataPointLabel(dataPoint) {
  return SOURCE_TYPE_LABELS[dataPoint?.sourceType] || SOURCE_TYPE_LABELS.unverified;
}

function clampConfidence(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}
