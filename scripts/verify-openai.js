import { openAiConfigStatus } from "../server/env.js";
import { parseOpenAiOutputJson, requestOpenAiResponses } from "../src/ai-engine/openai-client.js";

const config = openAiConfigStatus();

function print(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

if (!config.configured) {
  print({
    ok: false,
    configured: false,
    provider: config.provider,
    model: config.model,
    message: `${config.provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"} is not configured. Add it to .env or the process environment.`,
    envFileLoaded: config.envFileLoaded,
    envFilePath: config.envFilePath
  });

  if (process.env.REQUIRE_AI === "1" || process.env.REQUIRE_OPENAI === "1") {
    process.exit(1);
  }

  process.exit(0);
}

try {
  const payload = await requestOpenAiResponses(
    {
      model: config.model,
      input: "Return a short JSON health check for AI Product Launch OS. Return JSON only.",
      text: {
        format: {
          type: "json_schema",
          name: "openai_health_check",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["ok", "message"],
            properties: {
              ok: { type: "boolean" },
              message: { type: "string" }
            }
          }
        }
      }
    },
    { timeoutMs: 120_000 }
  );

  print({
    ok: true,
    configured: true,
    provider: config.provider,
    model: config.model,
    responseId: payload.id,
    output: parseOpenAiOutputJson(payload)
  });
} catch (error) {
  print({
    ok: false,
    configured: true,
    provider: config.provider,
    model: config.model,
    timeoutMs: 120_000,
    message: "AI provider request failed. Check network connectivity, proxy settings, firewall rules, API key permissions, quota, or rate limits.",
    errorName: error.name,
    errorCode: error.cause?.code,
    errorMessage: error.cause?.message || error.message
  });
  process.exit(1);
}
