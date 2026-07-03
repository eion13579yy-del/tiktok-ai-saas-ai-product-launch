# GitHub Handoff

Repository upload status:

- Initial project source has been pushed to `main`.
- Local-only runtime files are excluded by `.gitignore`.
- `.env.example` is committed as the environment template.
- `OPENAI_API_KEY` must be configured outside the repository before real AI report generation.

Suggested next checks:

- Run `npm run smoke:sprint20` after starting the app.
- Run `npm run ai:verify` after setting `OPENAI_API_KEY`.
- Confirm the app is reachable on the intended deployment port.
