import { spawn } from "node:child_process";

const PROVIDERS = {
  deepseek: {
    endpoint: "https://api.deepseek.com/chat/completions",
    keyName: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat"
  },
  openai: {
    endpoint: "https://api.openai.com/v1/responses",
    keyName: "OPENAI_API_KEY",
    defaultModel: "gpt-4.1-mini"
  }
};

function activeProvider() {
  const requested = (process.env.AI_PROVIDER || "deepseek").toLowerCase();
  return PROVIDERS[requested] ? requested : "deepseek";
}

function providerApiKey(provider) {
  return process.env[PROVIDERS[provider].keyName] || "";
}

function deepSeekBodyFromResponsesBody(body) {
  const schema = body.text?.format?.schema;
  const schemaInstruction = schema
    ? `\n\n只返回合法 JSON，不要使用 Markdown。JSON 必须符合以下 schema：\n${JSON.stringify(schema)}`
    : "\n\n只返回合法 JSON，不要使用 Markdown。";

  return {
    model: body.model || PROVIDERS.deepseek.defaultModel,
    messages: [
      {
        role: "user",
        content: `${body.input}${schemaInstruction}`
      }
    ],
    response_format: {
      type: "json_object"
    },
    temperature: 0.2,
    max_tokens: Math.min(Number(body.max_output_tokens) || 8192, 8192)
  };
}

function requestBodyForProvider(provider, body) {
  if (provider === "deepseek") {
    return deepSeekBodyFromResponsesBody(body);
  }

  return body;
}

function extractProviderOutputText(provider, payload) {
  if (provider === "deepseek") {
    return payload.choices?.[0]?.message?.content;
  }

  return payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.text)?.text;
}

async function requestWithFetch(provider, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const providerConfig = PROVIDERS[provider];

  try {
    const response = await fetch(providerConfig.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${providerApiKey(provider)}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBodyForProvider(provider, body))
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`${provider} request failed: ${message}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function requestWithPowerShell(provider, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const providerConfig = PROVIDERS[provider];
    const requestBody = requestBodyForProvider(provider, body);
    const script = `
$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$body = [Console]::In.ReadToEnd()
$headers = @{
  Authorization = "Bearer $env:${providerConfig.keyName}"
  "Content-Type" = "application/json"
}
try {
  $response = Invoke-RestMethod -Uri "${providerConfig.endpoint}" -Method Post -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec ${Math.ceil(timeoutMs / 1000)}
  $response | ConvertTo-Json -Depth 100 -Compress
} catch {
  $errorBody = ""
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $errorBody = $reader.ReadToEnd()
  }

  if (-not $errorBody) {
    $errorBody = $_.Exception.Message
  }

  [Console]::Error.WriteLine($errorBody)
  exit 1
}
`.trim();

    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${provider} PowerShell request failed with exit code ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`${provider} PowerShell response was not valid JSON: ${error.message}`));
      }
    });

    child.stdin.end(JSON.stringify(requestBody), "utf8");
  });
}

export async function requestOpenAiResponses(body, options = {}) {
  const timeoutMs = options.timeoutMs || 120_000;
  const provider = activeProvider();

  if (!providerApiKey(provider).trim()) {
    throw new Error(`${PROVIDERS[provider].keyName} is not configured.`);
  }

  try {
    const payload = await requestWithFetch(provider, body, timeoutMs);
    return {
      ...payload,
      provider,
      output_text: extractProviderOutputText(provider, payload)
    };
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }

    const payload = await requestWithPowerShell(provider, body, timeoutMs);
    return {
      ...payload,
      provider,
      output_text: extractProviderOutputText(provider, payload)
    };
  }
}

export function parseOpenAiOutputJson(payload) {
  const outputText = String(payload.output_text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  if (!outputText) {
    throw new Error("AI provider response did not include JSON output text.");
  }

  try {
    return JSON.parse(outputText);
  } catch (error) {
    const finishReason = payload.choices?.[0]?.finish_reason || payload.status || "";

    if (
      finishReason === "length" ||
      error.message.includes("Unterminated string") ||
      error.message.includes("Unexpected end")
    ) {
      throw new Error("AI 返回的 JSON 不完整，系统将自动重试生成精简版报告。");
    }

    throw error;
  }
}
