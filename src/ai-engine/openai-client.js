import { spawn } from "node:child_process";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function extractOutputText(payload) {
  return payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.text)?.text;
}

async function requestWithFetch(body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`OpenAI request failed: ${message}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function requestWithPowerShell(body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const script = `
$ErrorActionPreference = "Stop"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$body = [Console]::In.ReadToEnd()
$headers = @{
  Authorization = "Bearer $env:OPENAI_API_KEY"
  "Content-Type" = "application/json"
}
try {
  $response = Invoke-RestMethod -Uri "${OPENAI_RESPONSES_URL}" -Method Post -Headers $headers -Body $body -ContentType "application/json" -TimeoutSec ${Math.ceil(timeoutMs / 1000)}
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
        reject(new Error(stderr.trim() || `OpenAI PowerShell request failed with exit code ${code}.`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`OpenAI PowerShell response was not valid JSON: ${error.message}`));
      }
    });

    child.stdin.end(JSON.stringify(body), "utf8");
  });
}

export async function requestOpenAiResponses(body, options = {}) {
  const timeoutMs = options.timeoutMs || 120_000;

  try {
    return await requestWithFetch(body, timeoutMs);
  } catch (error) {
    if (process.platform !== "win32") {
      throw error;
    }

    return await requestWithPowerShell(body, timeoutMs);
  }
}

export function parseOpenAiOutputJson(payload) {
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  return JSON.parse(outputText);
}
