import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const baseUrl = process.env.APP_URL || "http://localhost:3000";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const aiSource = await readFile("server/ai.js", "utf8");
const verifySource = await readFile("scripts/verify-openai.js", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

assert(aiSource.includes("json_schema"), "OpenAI generation should use structured output json_schema.");
assert(aiSource.includes("LAUNCH_REPORT_SCHEMA"), "AI service should define launch report schema.");
assert(aiSource.includes("https://api.openai.com/v1/responses"), "AI service should call OpenAI Responses API.");
assert(aiSource.includes("generationSource: \"openai\""), "OpenAI reports should be marked as OpenAI generated.");
assert(verifySource.includes("https://api.openai.com/v1/responses"), "OpenAI verification script should call Responses API.");
assert(packageJson.scripts["ai:verify"] === "node scripts/verify-openai.js", "Package should expose ai:verify script.");

const healthResponse = await fetch(`${baseUrl}/api/health`);
const health = await healthResponse.json();
assert(healthResponse.status === 200, "Health endpoint should succeed.");
assert(["Sprint 18", "Sprint 19", "Sprint 20"].includes(health.sprint), "Health endpoint should report Sprint 18 or later.");
assert(health.services.openai && typeof health.services.openai.configured === "boolean", "Health endpoint should expose OpenAI config status.");

const { stdout } = await execFileAsync("node", ["scripts/verify-openai.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    OPENAI_API_KEY: ""
  }
});
const verification = JSON.parse(stdout);
assert(verification.ok === false, "Verification script should not fake success without a key.");
assert(verification.configured === false, "Verification script should report missing key.");

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: [
        "structured OpenAI output",
        "Responses API generation path",
        "ai:verify script",
        "OpenAI health status",
        "missing key verification behavior"
      ],
      openaiConfigured: health.services.openai.configured
    },
    null,
    2
  )
);
