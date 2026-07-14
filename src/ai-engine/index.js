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
    "moduleItems",
    "findings",
    "recommendations",
    "risks"
  ],
  properties: {
    id: {
      type: "string",
      enum: [
        "market_intelligence",
        "creator_intelligence",
        "consumer_intelligence",
        "video_ai",
        "live_ai",
        "comment_ai",
        "compliance_ai",
        "launch_plan",
        "decision_center",
        "profit_model"
      ]
    },
    title: { type: "string" },
    purpose: { type: "string" },
    dataSource: { type: "string" },
    modelReasoning: { type: "string" },
    moduleItems: {
      type: "array",
      minItems: 6,
      maxItems: 14,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "basis"],
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          basis: { type: "string" }
        }
      }
    },
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
      minItems: 10,
      maxItems: 10,
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

function compactList(value, fallback = "待识别") {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter(Boolean).slice(0, 3).join("、");
  }

  return value || fallback;
}

function projectContext(project, profile = {}) {
  return {
    product: project.productName || "该产品",
    category: profile.productCategory || project.category || "待识别品类",
    scenarios: compactList(profile.useScenarios, "待识别使用场景"),
    consumers: compactList(profile.consumerSegments, "待识别消费人群"),
    price: project.targetPrice ? `$${project.targetPrice}` : profile.priceBand || "待确认价格带",
    cost: project.costPrice ? `$${project.costPrice}` : "待确认成本",
    platforms: compactList(project.platforms, "TikTok / Amazon / Walmart"),
    market: project.targetMarket || "目标市场"
  };
}

function isGenericReasoning(value) {
  const text = String(value || "");

  return (
    !text.trim() ||
    text.length < 18 ||
    /Product Profile\s*\+?\s*AI|AI推理|动态章节推理|平台上下文|AI Engine output|模型推理生成|通用/.test(text)
  );
}

function contextualDataSource(section, project, profile) {
  const context = projectContext(project, profile);

  return `用户输入（${context.product}、目标售价${context.price}、成本${context.cost}、${context.platforms}、${context.market}） + Product Profile（${context.category}、${context.scenarios}、${context.consumers}） + ${section.title || section.id} AI模型推理。`;
}

function contextualReasoning(section, project, profile) {
  const context = projectContext(project, profile);

  return `围绕${context.product}的${context.category}属性、${context.scenarios}场景、${context.consumers}人群、${context.price}价格带和${context.platforms}渠道，对${section.title || section.id}进行差异化推理，所有预计值需上线后用真实销量、广告、达人和竞品数据复核。`;
}

function enrichSection(section, project, profile) {
  const enriched = { ...section };

  if (isGenericReasoning(enriched.dataSource)) {
    enriched.dataSource = contextualDataSource(enriched, project, profile);
  }

  if (isGenericReasoning(enriched.modelReasoning)) {
    enriched.modelReasoning = contextualReasoning(enriched, project, profile);
  }

  enriched.moduleItems = (enriched.moduleItems || []).map((item) => {
    const label = item.label || "结论";
    const next = { ...item };

    if (isGenericReasoning(next.basis)) {
      next.basis = `${enriched.modelReasoning} 当前结论聚焦“${label}”，不是跨产品通用模板。`;
    }

    if (isGenericReasoning(next.value)) {
      const context = projectContext(project, profile);
      next.value = `预计${label}需要结合${context.product}的${context.category}属性、${context.scenarios}场景和${context.consumers}人群单独验证。`;
    }

    return next;
  });

  return enriched;
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
    moduleItems: section.moduleItems,
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
  const sections = raw.sections.map((section) => toLegacySection(enrichSection(section, project, raw.productProfile)));
  const context = projectContext(project, raw.productProfile);
  const scoreInsight =
    raw.scoreInsight ||
    `${config.provider} AI Intelligence Engine 结合${context.product}的${context.category}属性、${context.scenarios}场景、${context.consumers}人群和${context.platforms}渠道完成评分推理，建议优先验证最高分机会和最低分风险。`;

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
        { label: "Demand Score", value: aiScore.demandScore, reason: `${context.market}市场中${context.product}的${context.category}需求、${context.scenarios}场景和${context.consumers}人群推理。` },
        { label: "Competition Score", value: aiScore.competitionScore, reason: `${context.platforms}渠道下${context.category}竞品密度、价格带${context.price}和差异化空间推理。` },
        { label: "Virality Score", value: aiScore.viralityScore, reason: `${context.product}在${context.scenarios}内容场景、${context.consumers}人群触发点和TikTok表达方式上的推理。` },
        { label: "Margin Score", value: aiScore.marginScore, reason: `${context.price}售价、${context.cost}成本和${context.platforms}履约费用假设下的利润模型推理。` },
        { label: "Risk Score", value: aiScore.riskScore, reason: `${context.category}的售后、物流、合规和平台限制风险推理。` },
        { label: "Overall Score", value: aiScore.overallScore, reason: `${context.product}综合需求、内容、利润、竞品和风险后的AI模型判断。` }
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
        { field: "Product Profile", value: `${config.provider} inference`, basis: `${context.product}、${context.category}、${context.scenarios}、${context.consumers}和${context.platforms}组合推理。`, caution: "需要真实市场数据复核。" },
        { field: "AI Score", value: `${config.provider} scoring`, basis: `${context.price}价格带、${context.cost}成本、${context.platforms}渠道和各章节差异化结论综合评分。`, caution: "不能作为确定销量承诺。" }
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
6. 每个 section 的 dataSource、modelReasoning、findings、recommendations、risks 和 moduleItems 必须结合当前产品输入，不允许复用跨产品通用文案。
7. 每个 moduleItem 的 value 和 basis 至少结合以下两个要素：产品类别、使用场景、消费人群、目标售价、成本、平台、目标市场、竞品链接、物流风险、合规风险。
8. 禁止只写“Product Profile + AI推理”“平台上下文”“动态章节推理”等泛化来源；必须说明为什么这个产品会得出该结论。

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

async function requestAiEngineJson(config, modulePrompt) {
  const payload = await requestOpenAiResponses({
    model: config.model,
    input: modulePrompt,
    max_output_tokens: 8192,
    text: {
      format: {
        type: "json_schema",
        name: "ai_intelligence_engine_report",
        strict: true,
        schema: AI_ENGINE_REPORT_SCHEMA
      }
    }
  });

  return parseOpenAiOutputJson(payload);
}

export async function generateAiEngineReport(project) {
  const config = requireAiConfig();
  const modulePrompt = [
    buildPrompt(project),
    "scoreInsight 必须是一句简体中文点评，由 DeepSeek AI Intelligence Engine 基于 Product Profile 推理生成，只说明评分背后的核心判断，不要重复每个评分维度的通用说明。",
    "所有章节和每一条 moduleItem 必须针对当前产品单独推理。不同产品不能复用相同的数据来源、相同风险描述、相同打法或相同评分理由。",
    "dataSource 和 modelReasoning 必须写成该章节独立依据，至少包含产品品类、使用场景、目标人群、价格带、平台或竞品输入中的两个要素。",
    "sections 必须固定输出 10 个模块，id 和顺序必须完全如下：",
    "1. market_intelligence：市场分析（Market Intelligence），覆盖 TAM/SAM/SOM、Amazon/TikTok/Walmart销量预估、Google Trends近5年趋势、季节性、价格带、品牌集中度、TOP100竞品、店铺分布、利润率、预计GMV、预计ROI、市场进入评分、30/90/180/365天销量预测、备货建议、资金占用预测。",
    "2. creator_intelligence：达人画像（Creator Intelligence），覆盖达人类型、粉丝画像、年龄、性别、地区、消费能力、兴趣标签、爆款率、GMV、播放、CTR、CVR、佣金、竞品合作、合作难度、达人分层和百万GMV所需达人数量。",
    "3. consumer_intelligence：用户画像（Consumer Intelligence），覆盖年龄、性别、收入、职业、购买原因和核心痛点。",
    "4. video_ai：短视频AI（Video AI），覆盖爆款选题方向、30/45/60秒脚本、开头3秒、冲突、痛点、产品展示、CTA、分镜、字幕和BGM建议。",
    "5. live_ai：直播AI（Live AI），覆盖2小时直播SOP、抽奖、Coupon、演示、逼单、互动和常见直播问答。",
    "6. comment_ai：评论AI（Comment AI），覆盖 Amazon Review、TikTok评论、Reddit、YouTube、喜欢原因、退货原因、差评原因和营销文案。",
    "7. compliance_ai：风险合规（Compliance AI），覆盖 TikTok违规、医疗宣称、夸大宣传、品类限制、知识产权、专利、商标、版权、FCC/ETL/UL/Prop 65/CPSIA/电池运输/平台资质和风险评分。",
    "8. launch_plan：打品计划（Launch Plan），覆盖90天计划、每周视频数、达人、直播、广告预算、GMV目标、补货和放大规则。",
    "9. decision_center：AI决策中心（Decision Center），覆盖市场容量、利润空间、TikTok/Amazon/Walmart适配、达人适配、内容可玩性、合规风险、供应链成熟度、售后风险、推荐指数、是否立项、首批备货、达人合作、短视频产出、直播时长、30/90/365天GMV。",
    "10. profit_model：利润模型（Profit Model），必须按三列表格逻辑生成 moduleItems：商品出厂价、关税（Duty）、海运费（LCL）、港口及清关费、总落地成本、尾程配送费、燃油附加费、商品出仓成本、仓储费、广告成本、平台佣金、退货与损耗、运营费用合计、商品总成本、商品毛利、运营利润。每项 label 写项目名，basis 写计算逻辑，value 写费用预估或利润率。",
    "每个 section 的 moduleItems 必须逐项生成中文业务内容，每个模块控制在 6-10 项，避免长篇文章。没有真实外部数据时，value 必须写成 预计/待验证口径，不能写成确定事实。",
    "每个 moduleItem 的 basis 必须解释该字段如何由当前产品的 Product Profile、价格成本、平台渠道、目标市场或竞品输入推导出来，不能写通用模板。"
  ].join("\n\n");
  let parsed;

  try {
    parsed = await requestAiEngineJson(config, modulePrompt);
  } catch (error) {
    if (!String(error.message || "").includes("JSON 不完整")) {
      throw error;
    }

    parsed = await requestAiEngineJson(
      config,
      [
        modulePrompt,
        "上一轮返回的 JSON 被截断。请重新生成精简版：每个 section 的 moduleItems 只保留 6 项；findings、recommendations、risks 各 2 项；每个 value 和 basis 控制在 35 个中文字以内；仍然必须结合当前产品做差异化推理；必须返回完整闭合 JSON。"
      ].join("\n\n")
    );
  }

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
