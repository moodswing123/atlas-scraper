# ATLAS SCRAPER

A Node.js 20+ Telegram bot for bounded, responsible crawling of public websites. It collects data served through unauthenticated HTTP requests, updates a single Telegram status message during a scan, and writes offline HTML, JSON, CSV, and ZIP exports.

> This is a functional initial release, not the complete master-specification platform. The implementation and unimplemented features are listed below; do not use this as a vulnerability scanner or as a way to bypass access controls.

## Requirements and verified runtime

- Node.js 20 or newer (developed/tested on Node.js 22.23.4).
- A Telegram bot token created with [@BotFather](https://t.me/BotFather).
- `npm install`, `npm start`, `npm test`, `npm run lint`.
- Bot API integration uses Telegram's HTTPS Bot API directly, so no Telegram wrapper-library version is involved. Telegram's official changelog lists Bot API 10.5 dated 22 November 2026. This app uses established methods (getUpdates, sendMessage, editMessageText, getChatMember, sendDocument) and does not depend on features introduced in 10.5. See [official changelog](https://core.telegram.org/bots/api-changelog).

## Install and configure

```sh
unzip atlas-scraper.zip
cd atlas-scraper
npm ci
cp .env.example .env
# Set BOT_TOKEN and ADMIN_IDS in .env
npm start
```

Set these environment variables:

- `BOT_TOKEN` (required): secret token from BotFather. Never commit it.
- `ADMIN_IDS`: comma-separated numeric Telegram user IDs that may access the limited admin panel.
- `DATA_DIR`, `OUTPUT_DIR`: persistent state and export directories.
- `MAX_PAGES`, `MAX_DEPTH`, `MAX_RUNTIME_SECONDS`, `MAX_PAGE_BYTES`, `REQUEST_TIMEOUT_MS`, `CRAWL_DELAY_MS`, `MAX_CONCURRENT_JOBS`: bounded crawl settings; values are clamped in code.
- `TELEGRAM_MODE`: reserved; polling is currently the only supported mode.

Create the bot with BotFather, copy its token to `.env`, then run the project in a private Telegram chat. The bot uses long polling and does not require an inbound web server or webhook. Set the bot command list in BotFather if desired; commands are also described by `/help`.

## Commands and usage

`/start`, `/help`, `/scan <URL>`, `/scrape <URL>`, `/status`, `/jobs`, `/history`, `/pause`, `/resume`, `/cancel`, `/export <job-id>`, `/settings`, `/profile`, `/subscribe`, `/compare`, `/support`, `/privacy`, `/delete_data`, `/admin`.

A scan requires explicit confirmation in Telegram. Progress is edited in the original status message. The final message offers ZIP and standalone HTML reports. A completed job's export is also stored below `OUTPUT_DIR`.

## Admin force-subscription setup

Set your Telegram numeric user ID in `ADMIN_IDS`, start the bot, and run `/admin`. Open **Force subscription → Add channel**, then send a public `@ChannelName` or `https://t.me/ChannelName`. The bot verifies the channel through Telegram and checks that the bot is an administrator before saving it. The panel supports enabling/disabling saved channels and switching join-all/join-any policy. Users get join links and a membership verification button. Membership checks are done with Telegram `getChatMember`; bot administrator visibility is required. This admin panel does not provide the broader system-settings controls listed in the master brief.

## Deployment

### Ubuntu VPS

Install Node.js 20+, copy the project, run `npm ci`, configure `.env`, then use a process manager such as systemd or PM2 to run `npm start`. Keep `DATA_DIR` and `OUTPUT_DIR` on persistent storage with restricted permissions and sufficient disk space. Use a dedicated unprivileged OS account. Back up both directories while the bot is stopped (or copy the JSON state atomically); restore them before restart.

### Pterodactyl/Pelican

Use a Node.js 20+ egg/container, set the startup command to `npm start`, and set the environment variables in the panel. Ensure `DATA_DIR` and `OUTPUT_DIR` map to persistent server storage. No browser binaries or additional system packages are required.

Polling only is implemented; webhook mode is not. Restart recovery retains completed jobs and history in an atomic JSON file. A job that was running at shutdown is not resumed or automatically marked as interrupted in this initial release.

## Security and crawling behavior

Only HTTP/HTTPS on standard ports is accepted. The crawler rejects credentials, local/internal hostnames and non-public IP ranges, revalidates every redirect and checks all DNS answers before connecting. It respects robots.txt disallow directives (including failing closed for an explicitly disallowed start URL), limits redirects, request time, response bytes, page count, crawl depth and pacing. It stops on 403 and 429 and does not evade blocks. It never executes downloaded JavaScript or submits forms. Authorization, cookie, and similar response headers are redacted.

URLs that resemble login, account, logout, purchase or destructive paths are excluded. The parser extracts static HTML only; it does not render JavaScript. Resource URLs are inventoried but not downloaded or probed separately. DNS and TLS certificate inventory, status checking for every link, scheduled scans, paywall bypass, proxy rotation and stealth behavior are not included.

## Exports

Each scan creates a generated-name folder with `index.html`, structured JSON under `data/`, CSV tables under `tables/`, `logs/crawl.log`, a `README.txt`, and `manifest.json` with SHA-256 checksums. The HTML report is offline-friendly and escapes scraped values. A ZIP includes the report and data; paths are generated by the exporter rather than supplied by users. The sample report is at `output/sample-report.html`; the sample archive is `output/sample-scan.zip`.

## Implemented in version 1.0.0

- Telegram long polling and direct Bot API requests.
- Basic menu, commands, inline navigation, scan confirmation, editable progress, pause/resume/cancel controls, and per-user job lookup.
- Runtime admin allowlist, user/job counts, force-subscription public-channel add/validation, enable/disable, all/any, membership verification, and audit records.
- SSRF-aware public URL checks and bounded same-origin HTML crawling with sitemap URL discovery and robots handling.
- HTML metadata, headings, text, JSON-LD, forms metadata, links, images, and public resource references.
- Atomic JSON state, HTML/JSON/CSV/ZIP exports, checksums and a sample report.

## Not implemented or not fully implemented

No SQLite/database queue; jobs are stored in an atomic JSON file. No webhook mode, automatic retention/cleanup, automatic restart recovery of in-flight jobs, user quotas, per-user scan preferences, plan/payment processing, subscription controls, scheduled scans, compare/change detection, teams, broad admin configuration, channel removal, username-based admin management, domain allow/deny lists, full sitemap/robots parser, charset detection, browser rendering, individual page snapshots, asset downloads, DNS/TLS fingerprint reports, link status audits, RSS feeds, PDF reports, retry queue, pagination/search of exports, force-subscription grace periods/cache, or complete user interface ownership test suite. Some declared master-spec commands intentionally return “not implemented” guidance or only basic information. Integration behavior requiring a real Telegram token was not tested.

## Tests and quality checks

Automated local tests cover SSRF/private IP rejection, sensitive-header redaction, static extraction, user-owned data access, export output, report escaping, safe generated paths, and ZIP integrity. They do not require a live Telegram token or random external websites.

```sh
npm test
npm run lint
```

`npm audit --omit=dev` reports zero vulnerabilities for the checked dependency lockfile at release time. Re-run the audit when upgrading dependencies. No security claim should be interpreted as a guarantee against every target network edge case.

## Troubleshooting

- **Bot exits immediately:** set a valid `BOT_TOKEN` in `.env`; ensure it has no extra spaces.
- **Polling conflict:** stop other bot processes using the same token; Telegram allows only one active getUpdates consumer.
- **403 or 429 from a site:** the crawl reports the block and does not attempt evasion.
- **No channel verification:** make the channel public and give the bot administrator status; restart is not required after runtime configuration.
- **Disk full or export failure:** check persistent volume space and write permissions on `DATA_DIR`/`OUTPUT_DIR`.
- **Missing JavaScript-rendered content:** browser rendering is not implemented; only server-delivered HTML is parsed.

## Project structure

```text
src/bot/        Telegram API client and handlers
src/scraper/    URL safety, HTTP crawler, HTML extraction
src/exports/    Offline HTML, JSON, CSV, ZIP export
src/store/      Atomic JSON state store
tests/          Local deterministic tests
output/         Sample report and generated sample archive
```

## License

MIT. See `LICENSE`.
