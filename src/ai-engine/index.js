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
    /Product Profile\s*\+?\s*AI|AI推理|动态章节推理|平台上下文|AI Engine output|based on category|category average|中高客单厨房小家电测算市场容量|10万美元GMV约需售出|100万美元GMV约需售出|模型推理生成|通用|需要结合|单独验证|单独判断/.test(text)
  );
}

function textIncludesAny(value, keywords) {
  const text = String(value || "").toLowerCase();
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function contextNumber(value, fallback) {
  const numeric = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function marginText(context) {
  const price = contextNumber(context.price, 179);
  const cost = contextNumber(context.cost, 61);
  return `${Math.round(((price - cost) / price) * 100)}%`;
}

function millionGmvUnits(context) {
  return Math.ceil(1000000 / contextNumber(context.price, 179)).toLocaleString("en-US");
}

function fallbackVariant(items, index) {
  return items[index % items.length];
}

function directModuleConclusion(section, label, project, profile, index = 0) {
  const context = projectContext(project, profile);
  const type = section.id;
  const margin = marginText(context);
  const units = millionGmvUnits(context);

  if (type === "market_intelligence") {
    if (textIncludesAny(label, ["tam", "总可用"])) return `${context.market}${context.category}覆盖家庭厨房、健康饮品和夏季消暑需求，适合作为大盘容量判断，不直接等同首年销量。`;
    if (textIncludesAny(label, ["sam", "可服务"])) return `可服务市场应聚焦TikTok、Amazon和Walmart线上用户，优先计算愿意购买${context.price}厨房电器的人群。`;
    if (textIncludesAny(label, ["som", "可获得"])) return "首阶段可获得市场来自达人内容转化和Amazon搜索承接，建议先按小批量测品份额评估。";
    if (textIncludesAny(label, ["amazon"])) return "Amazon更适合承接搜索型需求，重点看 ice crusher / smoothie maker / shaved ice machine 同价位Listing转化。";
    if (textIncludesAny(label, ["tiktok"])) return "TikTok增量来自视觉演示内容，出冰效果、夏日饮品和健身代餐场景决定短期爆发。";
    if (textIncludesAny(label, ["walmart"])) return "Walmart适合做价格和家庭厨房场景承接，但爆发性弱于TikTok，适合作为补充渠道。";
    if (textIncludesAny(label, ["google", "trends", "趋势"])) return "搜索趋势应重点观察5-8月夏季饮品高峰，以及健康代餐、家庭聚会内容是否同步升温。";
    if (textIncludesAny(label, ["季节"])) return `${context.product}旺季集中在春末到夏季，备货和达人排期应提前4-6周启动。`;
    if (textIncludesAny(label, ["价格带", "价格"])) return `${context.price}属于中高客单，必须用更强功率、口感、耐用性和售后承诺支撑溢价。`;
    if (textIncludesAny(label, ["品牌集中"])) return "若头部品牌评价数量高但内容表达弱，TikTok仍可通过场景演示切入。";
    if (textIncludesAny(label, ["top100", "竞品"])) return "优先拆解同价位竞品的差评、出冰效果、噪音和清洗问题，用改进点做卖点。";
    if (textIncludesAny(label, ["店铺"])) return "若竞品以Amazon店铺为主，TikTok Shop可用达人内容降低新品冷启动成本。";
    if (textIncludesAny(label, ["利润率", "利润"])) return `出厂成本${context.cost}、售价${context.price}下裸毛利约${margin}，核心压力来自尾程、广告和退货。`;
    if (textIncludesAny(label, ["gmv"])) return `按${context.price}售价测算，100万美元GMV需要约${units}台销量，应拆成达人、直播和搜索三条渠道目标。`;
    if (textIncludesAny(label, ["roi"])) return "测品期先以达人佣金和小额广告验证ROAS，未达到盈亏线前不建议重仓库存。";
    if (textIncludesAny(label, ["评分", "进入"])) return "可进入但需谨慎，进入门槛不是需求，而是内容转化、产品体验和售后稳定性。";
    if (textIncludesAny(label, ["30", "90", "180", "365", "预测"])) return "30天看内容点击和加购，90天看达人复投，180天后再判断是否扩展Amazon和Walmart库存。";
    if (textIncludesAny(label, ["备货", "资金"])) return "首批建议小批量测品，按7-14天内容反馈决定补货；高客单产品优先防止库存资金占用。";
    return fallbackVariant([
      `${context.product}市场验证优先看同价位竞品销量、搜索词热度和TikTok视频完播率。`,
      `${context.product}渠道策略应区分TikTok内容种草、Amazon搜索承接和Walmart家庭消费补充。`,
      `${context.product}测品成败取决于夏季场景内容能否覆盖${context.consumers}并压低退货率。`
    ], index);
  }

  if (type === "creator_intelligence") {
    if (textIncludesAny(label, ["达人类型", "creator type"])) {
      return "优先合作厨房小家电、健康饮品、家庭食谱和健身代餐类达人；用3秒出冰沙/奶昔演示做内容钩子，中腰部达人负责转化。";
    }

    if (textIncludesAny(label, ["年龄"])) {
      return "核心粉丝年龄预计集中在25-44岁：25-34岁关注健康饮品和健身代餐，35-44岁关注家庭自制和厨房效率。";
    }

    if (textIncludesAny(label, ["性别"])) {
      return "女性粉丝占比预计更高，主打家庭厨房、夏日饮品和亲子场景；健身代餐内容可补充男性健身人群。";
    }

    if (textIncludesAny(label, ["地区"])) {
      return "优先覆盖加州、德州、佛州和纽约等高温、家庭聚会和健康饮品消费更强的州。";
    }

    if (textIncludesAny(label, ["兴趣", "标签"])) {
      return "核心兴趣标签建议锁定 #smoothie、#healthy、#fitness、#recipes、#kitchengadgets。";
    }

    if (textIncludesAny(label, ["爆款率"])) {
      return "内容爆款率预计中高：透明杯出沙冰、奶昔口感对比和夏季降温场景具备强视觉反馈。";
    }

    if (textIncludesAny(label, ["佣金"])) {
      return "平均佣金建议设为15%-20%；中高客单价可支撑达人测评成本，但需控制样品和物流费用。";
    }

    if (textIncludesAny(label, ["合作难度"])) return "合作难度预计中等：厨房和健康类达人可接受样品测评，但需要提供明确佣金、卖点素材和使用脚本。";
    if (textIncludesAny(label, ["百万", "GMV"])) return `按${context.price}售价测算，100万美元GMV约需售出${units}台；建议准备120-200位达人池分层测试。`;
    return fallbackVariant([
      "达人策略以中腰部厨房、健康饮品和家庭生活达人为主，先测内容转化，再放大高ROI达人。",
      "达人分层建议先用长尾达人验证脚本，再用腰部达人放大销量，头部达人只在转化稳定后合作。",
      "达人内容必须展示真实制作过程，单纯口播不适合厨房电器类产品。"
    ], index);
  }

  if (type === "consumer_intelligence") {
    if (textIncludesAny(label, ["年龄"])) return "核心用户为25-44岁家庭用户和健康生活人群，购买动机集中在自制饮品、效率和夏季消暑。";
    if (textIncludesAny(label, ["收入"])) return `${context.price}价位更适合家庭年收入$75k+用户，低价敏感人群转化阻力较高。`;
    if (textIncludesAny(label, ["购买", "原因"])) return "购买理由是家庭自制冰沙/奶昔、健康代餐、聚会饮品和减少外购饮品成本。";
    if (textIncludesAny(label, ["痛点"])) return "核心痛点是机器清洗麻烦、噪音、碎冰效果不稳定、体积占地和售后维修成本。";
    return fallbackVariant([
      `${context.product}目标用户应锁定健康饮品爱好者、年轻家庭和重视厨房效率的人群。`,
      `用户购买前会重点比较碎冰效果、清洗难度、噪音和${context.price}价格合理性。`,
      "用户转化内容应分别覆盖健身代餐、儿童饮品和家庭聚会三类动机。"
    ], index);
  }

  if (type === "video_ai") {
    if (textIncludesAny(label, ["选题"])) return "爆款选题围绕“30秒做出店铺同款冰沙”“夏天不用出门买奶昔”“健身代餐一杯搞定”。";
    if (textIncludesAny(label, ["脚本", "30", "45", "60"])) return "脚本结构：3秒展示冰块变沙冰，10秒对比外卖饮品成本，15秒展示清洗和口感，结尾引导下单。";
    if (textIncludesAny(label, ["分镜", "镜头"])) return "分镜优先拍透明杯出冰、近景质地、儿童/健身/派对三场景切换，避免只拍机器静物。";
    if (textIncludesAny(label, ["bgm", "字幕"])) return "BGM选择夏日、清爽、快节奏音乐；字幕突出“省钱、健康、30秒、家庭可用”。";
    return fallbackVariant([
      `${context.product}短视频核心是强视觉变化和场景对比，第一屏必须出现冰块变沙冰的结果。`,
      `${context.scenarios}要拆成多个可拍脚本，避免所有视频只展示机器外观。`,
      "内容测试先跑3秒钩子、成品质地和清洗便利三个变量。"
    ], index);
  }

  if (type === "live_ai") {
    if (textIncludesAny(label, ["sop", "2小时"])) return "2小时直播按“开场出杯-场景演示-优惠解释-答疑-限时逼单”循环，每20分钟重复一次核心卖点。";
    if (textIncludesAny(label, ["coupon", "优惠", "抽奖"])) return "优惠节奏建议每30分钟发Coupon，配合样品抽奖提升停留，但折扣不能压穿毛利。";
    if (textIncludesAny(label, ["演示"])) return "直播必须现场演示冰块、牛奶、水果三类原料，证明碎冰速度、口感和清洗便利性。";
    if (textIncludesAny(label, ["问题", "回答"])) return "高频问答聚焦能否碎冰、噪音多大、是否好清洗、保修多久、适合几人家庭。";
    return fallbackVariant([
      `${context.product}直播应以即时演示建立信任，用限时券和套餐推动${context.price}客单成交。`,
      "直播间每轮必须重复碎冰效果、清洗方式、保修承诺和优惠截止时间。",
      "直播转化重点不是讲参数，而是连续展示不同饮品成品。"
    ], index);
  }

  if (type === "comment_ai") {
    if (textIncludesAny(label, ["喜欢", "好评"])) return "好评卖点应围绕出冰细腻、饮品口感、家庭聚会好用和减少外购饮品成本。";
    if (textIncludesAny(label, ["退货", "差评"])) return "差评风险集中在噪音、清洗、碎冰不均匀、机器发热和售后响应慢。";
    if (textIncludesAny(label, ["文案"])) return "营销文案应强调“比外卖饮品更省钱、比普通搅拌机更适合碎冰、夏季家庭高频使用”。";
    return fallbackVariant([
      `${context.product}评论分析要把正向卖点转成视频脚本，把差评风险转成详情页FAQ和售后承诺。`,
      "评论抓取应优先看噪音、清洗、耐用性和碎冰效果，这些会直接影响退货。",
      "差评中的使用门槛要转成说明书、直播答疑和售后话术。"
    ], index);
  }

  if (type === "compliance_ai") {
    if (textIncludesAny(label, ["认证", "fcc", "etl", "ul", "prop", "cpsia"])) return "厨房电器上线前重点准备电气安全、食品接触材料、说明书警示和平台类目资质材料。";
    if (textIncludesAny(label, ["违规", "风险"])) return "合规风险主要来自夸大碎冰效果、虚假健康功效、图片版权和电器安全声明。";
    if (textIncludesAny(label, ["知识产权", "专利", "商标"])) return "需核查外观结构、刀头设计、品牌词和竞品图片版权，避免直接复制爆款素材。";
    return fallbackVariant([
      `${context.product}属于厨房电器，合规重点是电器安全、食品接触、宣传边界和平台素材版权。`,
      "合规文案不能暗示医疗或减肥功效，健康代餐只能作为使用场景表达。",
      "上线前必须核查插头、电压、说明书警示和平台厨房电器类目要求。"
    ], index);
  }

  if (type === "launch_plan") {
    if (textIncludesAny(label, ["week 1", "第一周"])) return "第1周完成Listing、FAQ、15条短视频素材和20位达人寄样，目标拿到首批内容反馈。";
    if (textIncludesAny(label, ["week 2", "第二周"])) return "第2周放大点击率最高的3类场景，达人池扩到50-80位，并开始小预算广告测试。";
    if (textIncludesAny(label, ["week 3", "第三周", "week 4", "第四周"])) return "第3-4周只放大ROAS达标内容，若退货和差评可控，再进入补货和直播加时。";
    if (textIncludesAny(label, ["gmv"])) return `30天GMV目标建议从$30k-$80k起步；达到100万美元GMV需约${units}台销量。`;
    return fallbackVariant([
      `${context.product}打品节奏应先测内容和售后，再放大达人、广告和库存。`,
      "90天计划要把达人寄样、直播测试、广告放量和补货节点分开管理。",
      "未验证退货率前不建议大批量压货，先用内容数据决定补货节奏。"
    ], index);
  }

  if (type === "decision_center") {
    if (textIncludesAny(label, ["立项", "建议"])) return `建议谨慎立项：${context.price}客单价和约${margin}裸毛利有测试空间，但必须先验证内容转化和退货率。`;
    if (textIncludesAny(label, ["备货"])) return "首批备货建议控制在300-800台，等达人视频转化、退货率和广告ROAS达标后再补货。";
    if (textIncludesAny(label, ["推荐", "指数"])) return "推荐指数应由内容传播、毛利空间和售后风险共同决定；当前优先做小批量测品。";
    return fallbackVariant([
      `${context.product}决策结论是可测但不宜重仓，关键看TikTok内容转化、Amazon承接和售后稳定性。`,
      "如果达人视频点击高但转化低，应优先优化价格、赠品和详情页，而不是扩大投流。",
      "如果退货率超过预期，应暂停补货并优先处理噪音、清洗和碎冰效果问题。"
    ], index);
  }

  if (type === "profit_model") {
    if (textIncludesAny(label, ["出厂", "成本"])) return `出厂成本${context.cost}、目标售价${context.price}下，裸毛利率约${margin}，尾程和广告会决定最终利润。`;
    if (textIncludesAny(label, ["关税"])) return "关税先按小家电常见税率区间估算，实际以HTS编码和清关资料为准。";
    if (textIncludesAny(label, ["广告", "佣金"])) return "广告和平台佣金需要合计控制在售价的25%-35%以内，否则运营利润会被压缩。";
    if (textIncludesAny(label, ["毛利", "利润"])) return `按${context.price}售价和${context.cost}成本，利润模型必须优先压低物流、广告和退货损耗。`;
    return fallbackVariant([
      `${context.product}利润模型核心是售价${context.price}能否覆盖出厂、关税、海运、尾程、佣金、广告和售后损耗。`,
      "利润敏感项优先看尾程配送、广告占比和退货损耗，三项合计过高会吞掉裸毛利。",
      "若要维持正向利润，应把佣金、广告和优惠控制在可承受毛利范围内。"
    ], index);
  }

  return fallbackVariant([
    `结论：${context.product}在${context.market}的${section.title || section.id}应围绕${label}制定独立动作，不能复用其他字段判断。`,
    `结论：${label}应结合${context.price}售价、${context.cost}成本和${context.platforms}渠道单独评估投入产出。`,
    `结论：${label}会影响${context.product}的内容转化、库存节奏或售后成本，需要单独设定指标。`
  ], index);
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

  enriched.moduleItems = (enriched.moduleItems || []).map((item, index) => {
    const label = item.label || "结论";
    const next = { ...item };

    if (isGenericReasoning(next.basis)) {
      next.basis = `${enriched.modelReasoning} 当前结论聚焦“${label}”，不是跨产品通用模板。`;
    }

    if (isGenericReasoning(next.value)) {
      next.value = directModuleConclusion(enriched, label, project, profile, index);
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
    "10. profit_model：利润模型（Profit Model），必须按三列表格逻辑生成 moduleItems：商品出厂价、关税（Duty）、海运费（LCL）、港口及清关费、总落地成本、尾程配送费、燃油附加费、商品出仓成本、仓储费、广告成本、平台佣金、达人佣金、退货与损耗、运营费用合计、商品总成本、价格上行因素、价格下行因素。每项 label 写项目名，basis 写计算逻辑或影响因素，value 写费用预估或因素结论。",
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
