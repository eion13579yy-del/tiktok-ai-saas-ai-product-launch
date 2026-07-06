import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");

  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? { key, value } : null;
}

export function loadEnvFile(filePath = path.join(rootDir, ".env")) {
  if (!existsSync(filePath)) {
    return {
      loaded: false,
      path: filePath,
      keys: []
    };
  }

  const keys = [];
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }

    keys.push(parsed.key);
  }

  return {
    loaded: true,
    path: filePath,
    keys
  };
}

export const envStatus = loadEnvFile();

export function openAiConfigStatus() {
  const provider = (process.env.AI_PROVIDER || "deepseek").toLowerCase();
  const providerConfig = {
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat"
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
    }
  };
  const active = providerConfig[provider] || providerConfig.deepseek;

  return {
    configured: active.apiKey.trim().length > 0,
    model: active.model,
    provider: providerConfig[provider] ? provider : "deepseek",
    supportedProviders: Object.keys(providerConfig),
    envFileLoaded: envStatus.loaded,
    envFilePath: envStatus.path
  };
}
