import { openAiConfigStatus } from "../server/env.js";

const config = openAiConfigStatus();

function print(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

if (!config.configured) {
  print({
    ok: false,
    configured: false,
    message: "OPENAI_API_KEY is not configured. Add it to .env or the process environment.",
    envFileLoaded: config.envFileLoaded,
    envFilePath: config.envFilePath
  });

  if (process.env.REQUIRE_OPENAI === "1") {
    process.exit(1);
  }

  process.exit(0);
}

const timeoutMs = 60_000;
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

let response;

try {
  response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: "Return a short JSON health check for AI Product Launch OS.",
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
    })
  });
} catch (error) {
  print({
    ok: false,
    configured: true,
    model: config.model,
    timeoutMs,
    message: "OpenAI API request failed. Check network connectivity, proxy settings, or firewall rules.",
    errorName: error.name,
    errorCode: error.cause?.code,
    errorMessage: error.cause?.message || error.message
  });
  process.exit(1);
} finally {
  clearTimeout(timeout);
}

if (!response.ok) {
  const body = await response.text();
  print({
    ok: false,
    configured: true,
    model: config.model,
    status: response.status,
    message: body
  });
  process.exit(1);
}

const payload = await response.json();
const outputText = payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.text)?.text;

print({
  ok: true,
  configured: true,
  model: config.model,
  responseId: payload.id,
  output: outputText ? JSON.parse(outputText) : null
});
