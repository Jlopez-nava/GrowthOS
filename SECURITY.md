# Security and privacy

GrowthOS is a work-in-progress prototype. The included controls are not a guarantee that the application is production-ready or an independent security audit.

## What this source release contains

Application source, migrations, tests with dummy values, blank environment examples, licensed fonts, branding assets, and explicitly fictional sample data. The export starts with fresh repository history. Production configuration, customer reports, uploaded files, screenshots of connected accounts, runtime logs, private credentials, and the original deployment ID/history are excluded.

## Keep secrets and customer information out of Git

- Set server credentials in your hosting service's secret manager. Never use `NEXT_PUBLIC_` for confidential values.
- `.env*` files (except `.env.example`), `.openai/`, `.dev.vars*`, common private-key files, credential JSON files, local databases, uploads, exports, and logs are ignored.
- Git ignores do not remove already tracked files. Inspect staged changes and run a secret scanner before every public push.
- Never commit Zapier connection tokens, OAuth client secrets, refresh/access tokens, encryption keys, service-role keys, real account IDs, report exports, or customer/teammate details.
- Use GitHub's privacy-preserving commit email. Inspect author/committer metadata as well as file contents.
- If a secret is exposed, revoke or rotate it first; deleting a file does not remove it from Git history or existing clones.

## Runtime boundaries

The company backend trusts identity headers supplied by its hosting authentication layer. An unprotected port that accepts caller-supplied identity headers is unsafe. See [deployment requirements](docs/DEPLOYMENT.md).

Provider tokens and reports are encrypted in server storage using a deployment-specific key. Each deployment needs its own identity, storage, and credentials. Backend authorization checks company membership and brand ownership. Company teammates currently share access to every brand; this is not a client-restricted portal.

The Zapier adapter uses a fixed endpoint and fixed reporting tools. Recommendations do not execute ad changes. Google Ads OAuth has a broad scope even though the code exposes reporting operations only.

## Reporting problems

Do not include private keys, real customer data, raw provider responses, or authenticated screenshots in public issues. For a non-sensitive bug, submit a fictional reproduction. For a security issue, use GitHub's private vulnerability reporting if the repository offers it; otherwise contact the maintainer through a private channel before disclosing details. Do not assume private reporting has been enabled merely because this file exists.
