function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text(value) {
  if (value === null || value === undefined || value === "") {
    return "待确认";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosTime, dosDate };
}

export function createZip(entries) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), "utf8");
    const checksum = crc32(dataBuffer);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);

    fileParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...fileParts, centralDirectory, end]);
}

export function buildExportPayload(project, report) {
  return {
    product: project || null,
    report: {
      id: report.id,
      version: report.version,
      status: report.status,
      generatedAt: report.generatedAt,
      summary: report.summary,
      recommendation: report.recommendation,
      decisionDashboard: report.decisionDashboard || null,
      financialModel: report.financialModel || null,
      scenarioSimulation: report.scenarioSimulation || null,
      annualPlan: report.annualPlan || null,
      channelBreakdown: report.channelBreakdown || null,
      gateDecision: report.gateDecision || null,
      riskRegister: report.riskRegister || null,
      dataSourceMap: report.dataSourceMap || null,
      changeLog: report.changeLog || [],
      sections: report.sections || []
    }
  };
}

function paragraph(value, style = "") {
  const styleXml = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";

  return `<w:p>${styleXml}<w:r><w:t xml:space="preserve">${escapeXml(text(value))}</w:t></w:r></w:p>`;
}

function table(rows) {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows
    .map((row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join("")}</w:tr>`)
    .join("")}</w:tbl>`;
}

export function buildDocx(project, report) {
  const dashboard = report.decisionDashboard || {};
  const financial = report.financialModel?.formulas || {};
  const risks = report.riskRegister?.risks || [];
  const sections = report.sections || [];
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph(`${project?.productName || "产品"} AI Product Launch Report`, "Title")}
    ${paragraph(`报告版本：${report.version || 1}  生成时间：${report.generatedAt || ""}`)}
    ${paragraph("最终决策", "Heading1")}
    ${table([
      ["项目推荐等级", dashboard.recommendationGrade],
      ["建议动作", dashboard.suggestedAction],
      ["建议首批备货量", dashboard.suggestedFirstBatchInventory],
      ["建议测试预算", dashboard.suggestedTestBudget],
      ["最大风险", dashboard.biggestRisk],
      ["下一步验证动作", dashboard.nextValidationAction]
    ])}
    ${paragraph("财务模型", "Heading1")}
    ${table([
      ["单台落地成本", financial.landedCost],
      ["单台出仓成本", financial.fulfillmentCost],
      ["单台完整成本", financial.totalCostPerUnit],
      ["单台净利润", financial.netProfitPerUnit],
      ["净利润率", financial.netMargin],
      ["盈亏平衡 ROAS", financial.breakEvenRoas]
    ])}
    ${paragraph("风险清单", "Heading1")}
    ${table([["风险", "等级", "依据", "措施"], ...risks.map((risk) => [risk.name, risk.level, risk.basis, risk.mitigation])])}
    ${paragraph("报告模块", "Heading1")}
    ${sections.map((section) => `${paragraph(section.title || section.type, "Heading2")}${paragraph(section.content || section.purpose || "")}`).join("")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  return createZip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    },
    {
      name: "word/document.xml",
      data: documentXml
    }
  ]);
}

function worksheet(rows) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows
    .map((row, rowIndex) => `<row r="${rowIndex + 1}">${row
      .map((cell, columnIndex) => `<c r="${columnName(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(text(cell))}</t></is></c>`)
      .join("")}</row>`)
    .join("")}</sheetData>
</worksheet>`;
}

function columnName(index) {
  let name = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

export function buildXlsx(project, report) {
  const sheets = [
    ["产品输入", [["字段", "值"], ["产品名称", project?.productName], ["类目", project?.category], ["目标市场", project?.targetMarket], ["平台", (project?.platforms || []).join(", ")]]],
    ["成本模型", [["指标", "值"], ...Object.entries(report.financialModel?.formulas || {})]],
    ["情景模拟", [["情景", "销售额", "营销费用", "净利润", "净利润率"], ...(report.scenarioSimulation?.scenarios || []).map((item) => [item.name, item.outputs?.revenue, item.outputs?.totalMarketingCost, item.outputs?.netProfit, item.outputs?.netMargin])]],
    ["年度规划", [["阶段", "销量", "销售额", "备货", "现金需求"], ...(report.annualPlan?.phases || []).map((item) => [item.name, item.unitTarget, item.revenueTarget, item.stockQty, item.cashNeed])]],
    ["渠道预算", [["渠道", "销售额", "销量", "曝光", "点击", "成交"], ...(report.channelBreakdown?.channels || []).map((item) => [item.name, item.revenueTarget, item.unitTarget, item.funnel?.exposure, item.funnel?.clicks, item.funnel?.orders])]],
    ["库存计划", [["字段", "值"], ["建议首批备货", report.decisionDashboard?.suggestedFirstBatchInventory], ["现金占用", report.financialModel?.formulas?.firstBatchCashNeed], ["未售库存潜在损失", report.financialModel?.formulas?.unsoldInventoryPotentialLoss]]],
    ["风险清单", [["风险", "等级", "概率", "影响", "依据", "措施"], ...(report.riskRegister?.risks || []).map((item) => [item.name, item.level, item.probability, item.impact, item.basis, item.mitigation])]],
    ["数据来源", [["字段", "来源类型", "值", "置信度"], ...dataSourceRows(report.dataSourceMap)]]
  ];
  const workbookSheets = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet[0])}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  const relationships = sheets
    .map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`)
    .join("");
  const contentTypes = sheets
    .map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");

  return createZip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${contentTypes}</Types>`
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`
    },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: worksheet(sheet[1])
    }))
  ]);
}

function dataSourceRows(dataSourceMap = {}) {
  const rows = [];

  for (const [groupName, group] of Object.entries(dataSourceMap || {})) {
    if (!group || typeof group !== "object") {
      continue;
    }

    for (const [fieldName, value] of Object.entries(group)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      rows.push([`${groupName}.${fieldName}`, value.sourceType, value.value, value.confidence]);
    }
  }

  return rows;
}
