import { openAiConfigStatus } from "../../server/env.js";
import { parseOpenAiOutputJson, requestOpenAiResponses } from "./openai-client.js";

const AI_ENGINE_SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "title",
    "purpose",
    "dataSource",
    "modelReasoning",
    "findings",
    "recommendations",
    "risks"
  ],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    purpose: { type: "string" },
    dataSource: { type: "string" },
    modelReasoning: { type: "string" },
    findings: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } }
  }
};

export const AI_ENGINE_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "productProfile",
    "reportArchitecture",
    "aiScore",
    "scoreInsight",
    "finalConclusion",
    "sections"
  ],
  properties: {
    productProfile: {
      type: "object",
      additionalProperties: false,
      required: [
        "productCategory",
        "lifecycle",
        "useScenarios",
        "consumerSegments",
        "priceBand",
        "decisionFactors",
        "returnRisk",
        "contentViralityAttributes",
        "tiktokFit",
        "amazonFit",
        "afterSalesRisk",
        "complianceRisk",
        "logisticsRisk"
      ],
      properties: {
        productCategory: { type: "string" },
        lifecycle: { type: "string" },
        useScenarios: { type: "array", items: { type: "string" } },
        consumerSegments: { type: "array", items: { type: "string" } },
        priceBand: { type: "string" },
        decisionFactors: { type: "array", items: { type: "string" } },
        returnRisk: { type: "string" },
        contentViralityAttributes: { type: "array", items: { type: "string" } },
        tiktokFit: { type: "string" },
        amazonFit: { type: "string" },
        afterSalesRisk: { type: "string" },
        complianceRisk: { type: "string" },
        logisticsRisk: { type: "string" }
      }
    },
    reportArchitecture: {
      type: "object",
      additionalProperties: false,
      required: ["strategy", "sectionCountReason", "excludedSectionsReason"],
      properties: {
        strategy: { type: "string" },
        sectionCountReason: { type: "string" },
        excludedSectionsReason: { type: "string" }
      }
    },
    aiScore: {
      type: "object",
      additionalProperties: false,
      required: [
        "demandScore",
        "competitionScore",
        "viralityScore",
        "marginScore",
        "riskScore",
        "overallScore"
      ],
      properties: {
        demandScore: { type: "number" },
        competitionScore: { type: "number" },
        viralityScore: { type: "number" },
        marginScore: { type: "number" },
        riskScore: { type: "number" },
        overallScore: { type: "number" }
      }
    },
    scoreInsight: { type: "string" },
    finalConclusion: {
      type: "object",
      additionalProperties: false,
      required: [
        "worthTesting",
        "firstBatchInventory",
        "testingCycle",
        "creatorStrategy",
        "shortVideoDirection",
        "liveDirection",
        "biggestRisk"
      ],
      properties: {
        worthTesting: { type: "string" },
        firstBatchInventory: { type: "string" },
        testingCycle: { type: "string" },
        creatorStrategy: { type: "string" },
        shortVideoDirection: { type: "string" },
        liveDirection: { type: "string" },
        biggestRisk: { type: "string" }
      }
    },
    sections: {
      type: "array",
      minItems: 4,
      maxItems: 12,
      items: AI_ENGINE_SECTION_SCHEMA
    }
  }
};

function requireAiConfig() {
  const config = openAiConfigStatus();

  if (!config.configured) {
    throw new Error(`${config.provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"} is not configured.`);
  }

  return config;
}

function clampScore(value) {
  const numeric = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(numeric) ? Math.round(numeric) : 0));
}

function riskLevelFromScore(riskScore) {
  if (riskScore >= 72) {
    return "low";
  }

  if (riskScore >= 45) {
    return "medium";
  }

  return "high";
}

function toLegacySection(section) {
  return {
    type: section.id,
    title: section.title,
    confidence: "high",
    content: section.purpose,
    bullets: [
      `Data Source: ${section.dataSource}`,
      `Model Reasoning: ${section.modelReasoning}`,
      ...section.findings.map((item) => `结论：${item}`),
      ...section.recommendations.map((item) => `建议：${item}`),
      ...section.risks.map((item) => `风险：${item}`)
    ],
    dataSource: section.dataSource,
    modelReasoning: section.modelReasoning,
    findings: section.findings,
    recommendations: section.recommendations,
    risks: section.risks
  };
}

function normalizeAiEngineReport(raw, project, config) {
  const aiScore = {
    demandScore: clampScore(raw.aiScore?.demandScore),
    competitionScore: clampScore(raw.aiScore?.competitionScore),
    viralityScore: clampScore(raw.aiScore?.viralityScore),
    marginScore: clampScore(raw.aiScore?.marginScore),
    riskScore: clampScore(raw.aiScore?.riskScore),
    overallScore: clampScore(raw.aiScore?.overallScore)
  };
  const sections = raw.sections.map(toLegacySection);
  const scoreInsight =
    raw.scoreInsight ||
    `${config.provider} AI Intelligence Engine 基于 Product Profile 完成评分推理，建议优先用最高分维度设计测品动作，用最低分维度作为上线前复核重点。`;

  return {
    status: "completed",
    generationSource: config.provider,
    model: config.model,
    opportunityScore: aiScore.overallScore,
    riskLevel: riskLevelFromScore(aiScore.riskScore),
    productProfile: raw.productProfile,
    aiEngine: {
      productProfile: raw.productProfile,
      reportArchitecture: raw.reportArchitecture,
      aiScore,
      scoreInsight,
      finalConclusion: raw.finalConclusion
    },
    differentiationAnalysis: {
      scores: [
        { label: "Demand Score", value: aiScore.demandScore, reason: `${config.provider} AI Engine output` },
        { label: "Competition Score", value: aiScore.competitionScore, reason: `${config.provider} AI Engine output` },
        { label: "Virality Score", value: aiScore.viralityScore, reason: `${config.provider} AI Engine output` },
        { label: "Margin Score", value: aiScore.marginScore, reason: `${config.provider} AI Engine output` },
        { label: "Risk Score", value: aiScore.riskScore, reason: `${config.provider} AI Engine output` },
        { label: "Overall Score", value: aiScore.overallScore, reason: `${config.provider} AI Engine output` }
      ],
      finalConclusion: raw.finalConclusion
    },
    productEvaluationModel: {
      totalScore: aiScore.overallScore,
      conclusion: raw.finalConclusion.worthTesting,
      conclusionReason: raw.reportArchitecture.strategy,
      scoreInsight,
      dimensions: Object.entries(aiScore).map(([key, value]) => ({
        key,
        label: key,
        score: value
      }))
    },
    dataCredibilityScore: 65,
    dataSourceBreakdown: {
      verifiedData: [
        { field: "产品名称", value: project.productName, source: "用户输入", note: "输入事实，不代表市场已验证。" },
        { field: "目标售价", value: String(project.targetPrice ?? ""), source: "用户输入", note: "用于毛利推理。" },
        { field: "成本", value: String(project.costPrice ?? ""), source: "用户输入", note: "用于毛利推理。" },
        { field: "目标市场", value: project.targetMarket || "", source: "用户输入", note: "用于区域化判断。" },
        { field: "平台", value: (project.platforms || []).join(", "), source: "用户输入", note: "用于渠道适配判断。" }
      ],
      aiInferredData: [
        { field: "Product Profile", value: `${config.provider} inference`, basis: "产品输入与平台上下文", caution: "需要真实市场数据复核。" },
        { field: "AI Score", value: `${config.provider} scoring`, basis: "Product Profile 和动态章节推理", caution: "不能作为确定销量承诺。" }
      ],
      humanAssumptions: [
        { field: "竞品链接", assumption: (project.competitorLinks || []).join(", ") || "未提供", owner: "运营", validationMethod: "人工核验链接产品是否为直接竞品。" }
      ]
    },
    roleReviews: [],
    validationChecklist: [],
    factSafetyRule: "所有未接入真实平台数据的结论必须标注 Data Source 或 Model Reasoning，禁止写成确定事实。",
    summary: `${project.productName} 已由 ${config.provider} AI Intelligence Engine 生成动态报告结构。`,
    recommendation: raw.finalConclusion.worthTesting,
    sections
  };
}

function buildPrompt(project) {
  return `
你是 AI Product Launch OS 的 AI Intelligence Engine。

必须遵守：
1. 先生成 Product Profile，再决定报告章节。
2. 不允许固定模板。不同产品的章节数量、章节名称、风险重点、打法必须不同。
3. 每一个结论必须写明 Data Source 或 Model Reasoning。
4. 如果没有真实外部数据，只能写 Model Reasoning，不能伪造市场事实。
5. 输出必须是简体中文。

产品输入：
${JSON.stringify(project, null, 2)}

Product Profile 必须分析：
- 产品类别
- 生命周期
- 使用场景
- 消费人群
- 价格带
- 内容传播属性
- TikTok适配程度
- Amazon适配程度
- 售后风险
- 合规风险
- 物流风险

然后根据 Product Profile 自动决定报告章节。
示例只是方向，不要照抄：
- 珠宝盒可以关注市场容量、送礼需求、女性消费心理、达人打法、收纳场景
- 枪柜可以关注 Second Amendment、家庭安全、合规、物流、高客单打法
- 球冰机可以关注夏季趋势、鸡尾酒文化、Party场景、酒吧达人

AI Score 必须包含：
Demand Score, Competition Score, Virality Score, Margin Score, Risk Score, Overall Score。
`.trim();
}

export async function generateAiEngineReport(project) {
  const config = requireAiConfig();
  const payload = await requestOpenAiResponses({
    model: config.model,
    input: `${buildPrompt(project)}

scoreInsight 必须是一句简体中文点评，由 DeepSeek AI Intelligence Engine 基于 Product Profile 推理生成，只说明评分背后的核心判断，不要重复每个评分维度的通用说明。`,
    text: {
      format: {
        type: "json_schema",
        name: "ai_intelligence_engine_report",
        strict: true,
        schema: AI_ENGINE_REPORT_SCHEMA
      }
    }
  });
  const parsed = parseOpenAiOutputJson(payload);

  return normalizeAiEngineReport(parsed, project, config);
}

export async function generateAiEngineSection(project, sectionType) {
  const report = await generateAiEngineReport(project);
  const section = report.sections.find((item) => item.type === sectionType);

  if (!section) {
    throw new Error(`AI Engine did not return section: ${sectionType}`);
  }

  return {
    ...section,
    regeneratedAt: new Date().toISOString()
  };
}
