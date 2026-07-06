# AI Product Launch OS

Sprint 0 establishes a runnable SaaS skeleton:

- Static web app shell
- Node HTTP API server
- Health check endpoint
- Local JSON data store check
- Environment variable example

## Run Locally

```powershell
node server/index.js
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

Sprint 1 smoke test:

```powershell
node scripts/sprint1-smoke-test.js
```

Sprint 2 smoke test:

```powershell
node scripts/sprint2-smoke-test.js
```

Sprint 3 smoke test:

```powershell
node scripts/sprint3-smoke-test.js
```

Sprint 4 smoke test:

```powershell
node scripts/sprint4-smoke-test.js
```

Sprint 5 smoke test:

```powershell
node scripts/sprint5-smoke-test.js
```

Sprint 6 smoke test:

```powershell
node scripts/sprint6-smoke-test.js
```

Sprint 7 smoke test:

```powershell
node scripts/sprint7-smoke-test.js
```

Sprint 8 smoke test:

```powershell
node scripts/sprint8-smoke-test.js
```

Sprint 9 smoke test:

```powershell
node scripts/sprint9-smoke-test.js
```

Sprint 10 smoke test:

```powershell
node scripts/sprint10-smoke-test.js
```

Sprint 11 smoke test:

```powershell
node scripts/sprint11-smoke-test.js
```

Sprint 12 smoke test:

```powershell
node scripts/sprint12-smoke-test.js
```

Sprint 13 smoke test:

```powershell
node scripts/sprint13-smoke-test.js
```

Sprint 14 smoke test:

```powershell
node scripts/sprint14-smoke-test.js
```

Sprint 15 smoke test:

```powershell
node scripts/sprint15-smoke-test.js
```

Sprint 16 smoke test:

```powershell
node scripts/sprint16-smoke-test.js
```

Sprint 17 smoke test:

```powershell
node scripts/sprint17-smoke-test.js
```

Sprint 18 smoke test:

```powershell
node scripts/sprint18-smoke-test.js
```

Sprint 19 smoke test:

```powershell
node scripts/sprint19-smoke-test.js
```

Sprint 20 smoke test:

```powershell
node scripts/sprint20-smoke-test.js
```

AI provider connectivity check:

```powershell
npm run ai:verify
```

China-friendly default provider:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat
```

Optional OpenAI fallback:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

## Current Sprint

Sprint 20: AI Intelligence Engine in /src/ai-engine.

## Deploy To Render

1. Open Render and create a new Blueprint from this repository.
2. Use `render.yaml` as the service configuration.
3. Set `DEEPSEEK_API_KEY` in Render environment variables.
4. Deploy the web service.
5. Confirm `/api/health` returns `status: ok`.

The app uses `PORT` from the hosting platform and initializes `data/db.json` automatically on first boot.
