# Paybox Account Registration Automation

Automation tool for Paybox (MoonPay/MoonX) account registration via REST API. No browser dependencies. Built for security research and authorized testing.

## Features

- Full API registration flow (no Puppeteer/Playwright/browser)
- Multi-target support (staging + production)
- Concurrent account creation with configurable pool size
- Automatic OTP retrieval via Mailinator public API
- JWT token decoding and persistence
- Rate limit (429) retry with backoff
- 2Captcha integration for CAPTCHA-protected endpoints
- Zero npm dependencies — Node.js built-in `https` only

## Requirements

- Node.js >= 14
- A Mailinator inbox (public, no account needed)
- MoonX publishableKey for the target environment
- (Optional) 2Captcha API key for CAPTCHA bypass

## Setup

```bash
git clone https://github.com/MasXzoom/paybox-reg-bot.git
cd paybox-reg-bot
cp config/settings.example.json config/settings.json
```

Edit `config/settings.json`:

| Field | Description |
|-------|-------------|
| `targets.staging.publishableKey` | MoonX publishable key for staging |
| `targets.prod.publishableKey` | MoonX publishable key for production |
| `twoCaptchaKey` | 2Captcha API key (only needed if CAPTCHA is enabled) |
| `maxConcurrent` | Parallel registration count (default: 3) |
| `otpTimeout` | Max seconds to wait for OTP email (default: 120) |
| `mailinatorApi` | Mailinator public inbox API URL |

Publishable keys can be extracted from the target app's iframe source:
```bash
curl -s https://app.paybox.sh/ | grep -oE 'moon_pk_[a-z0-9_]+'
curl -s https://staging.app.paybox.sh/ | grep -oE 'moon_pk_[a-z0-9_]+'
```

## Usage

```bash
# Register 1 account on staging
node index.js 1 --staging

# Register 5 accounts on staging (concurrent)
node index.js 5 --staging

# Register 3 accounts on production
node index.js 3 --prod

# List configured targets
node index.js --list
```

## How It Works

The registration flow uses MoonX's public SDK API:

```
1. GET  /v0/sdk/apps/public/config         Fetch app configuration
2. POST /v0/sdk/wallet/email/begin          Trigger OTP email to target address
3. GET  mailinator.com/api/v2/inboxes/<id>  Poll public inbox for 6-digit OTP
4. POST /v0/sdk/wallet/email/verify         Exchange OTP for JWT access token
5. GET  /v0/sdk/auth/users/public/me         Retrieve user profile
6. GET  /v0/sdk/auth/passkey/status          Check passkey enrollment status
7. GET  /v0/sdk/auth/oauth/google/begin      Probe Google OAuth availability
8. Save token to output/<target>/tokens.jsonl
```

All API calls use the `PublicToken` authorization header with the publishable key. No credentials are stored in the source code.

## Project Structure

```
paybox-reg-bot/
  index.js                      Entry point, CLI parsing
  config/
    settings.example.json       Template config (safe to commit)
    settings.json               Your local config (gitignored)
  src/
    http.js                     HTTPS client with MoonX header injection
    otp.js                      Mailinator OTP poller
    bot.js                      Registration logic + concurrent pool runner
    utils.js                    Helpers (email gen, JWT decode, file I/O)
  output/                       Generated tokens (gitignored)
  .gitignore
  LICENSE
```

## Output

`output/<target>/tokens.jsonl` — one JSON object per line:

```json
{"email":"user123@mailinator.com","access_token":"eyJ...","user_id":"019fb...","expires":"2026-07-30T04:22:12.000Z","created":"2026-07-30T03:22:12.000Z"}
```

`output/<target>/stats.json` — run summary:

```json
{"target":"Staging","total":5,"created":5,"failed":0,"rate_limited":0,"runtime_s":18}
```

## Rate Limiting

MoonX enforces a daily email cap per publishable key. If the cap is reached, the bot reports the error and exits cleanly. The cap resets daily.

The bot also handles HTTP 429 responses with automatic retry and backoff (configurable via `retryDelay` and `retryLimit`).

## Disclaimer

This tool is for authorized security testing only. Ensure you have permission to test the target environment. The author is not responsible for misuse.
