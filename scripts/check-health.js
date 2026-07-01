const baseUrl = process.env.APP_URL || "http://localhost:3000";

try {
  const response = await fetch(`${baseUrl}/api/health`);
  const payload = await response.json();

  if (!response.ok || payload.status !== "ok") {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  console.error(`Health check failed: ${error.message}`);
  process.exit(1);
}
