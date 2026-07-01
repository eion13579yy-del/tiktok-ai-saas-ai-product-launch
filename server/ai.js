import {
  AI_ENGINE_REPORT_SCHEMA,
  generateAiEngineReport,
  generateAiEngineSection
} from "../src/ai-engine/index.js";
import { openAiConfigStatus } from "./env.js";

export const LAUNCH_REPORT_SCHEMA = AI_ENGINE_REPORT_SCHEMA;
export const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

export function getAiServiceStatus() {
  return openAiConfigStatus();
}

export async function generateWithOpenAI(project) {
  return await generateAiEngineReport(project);
}

export async function generateLaunchReportContent(project, options = {}) {
  return await generateAiEngineReport(project);
}

export async function generateReportSectionContent(project, sectionType, options = {}) {
  return await generateAiEngineSection(project, sectionType);
}
