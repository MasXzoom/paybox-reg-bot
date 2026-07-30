# Paybox Registration Automation

A Node.js automation tool for account registration on Paybox (MoonPay/MoonX) platforms via REST API. Designed for security research, penetration testing, and authorized assessment of MoonX SDK authentication flows.

## Overview

This tool automates the complete account registration lifecycle on Paybox without requiring a browser environment. It interacts directly with MoonX's public SDK API endpoints to perform email-based OTP authentication, token acquisition, and user profile retrieval.

**No browser dependencies. No Puppeteer. No Playwright. Zero npm installs.**

## Features

- **Full API Registration** — Complete email OTP flow via MoonX REST API
- **Multi-Target Support** — Switch between staging and production environments
- **Concurrent Execution** — Configurable parallel account creation pool
- **Automatic OTP Retrieval** — Polls Mailinator public API for verification codes
- **JWT Token Decoding** — Extracts user_id, app_id, and expiry from access tokens
- **Rate Limit Handling** — Automatic retry with backoff on HTTP 429 responses
- **CAPTCHA Fallback** — 2Captcha integration for CAPTCHA-protected endpoints
- **Token Persistence** — Saves all acquired tokens to JSONL format for downstream use
- **Zero Dependencies** — Uses only Node.js built-in `https` module

## Requirements

- Node.js >= 14
- Network access to `api.moonx-dev.com` and target Paybox instance
- MoonX publishable key for the target environment
- Mailinator public inbox (no account required)
- (Optional) 2Captcha API key for CAPTCHA bypass

## Installation

```bash
git clone https://github.com/MasXzoom/paybox-reg-bot.git
cd paybox-reg-bot
cp config/settings.example.json config/settings.json
```

## Configuration

Edit `config/settings.json` with your target parameters:

```json
{
  "defaultTarget": "staging",
  "maxConcurrent": 3,
  "otpTimeout": 120,
  "twoCaptchaKey": "YOUR_2CAPTCHA_API_KEY",
  "targets": {
    "staging": {
      "publishableKey": "YOUR_STAGING_PUBLISHABLE_KEY",
      "origin": "https://staging.app.paybox.sh",
      "apiBase": "https://api.paybox.sh",
      "moonxBase": "https://api.moonx-dev.com"
    },
    "prod": {
      "publishableKey": "YOUR_PROD_PUBLISHABLE_KEY",
      "origin": "https://app.paybox.sh",
      "apiBase": "https://api.paybox.sh",
      "moonxBase": "https://api.moonx-dev.com"
    }
  }
}
```

### Obtaining Publishable Keys

Publishable keys are embedded in the target application's iframe source and can be extracted with:

```bash
curl -s https://app.paybox.sh/ | grep -oE 'moon_pk_[a-z0-9_]+'
curl -s https://staging.app.paybox.sh/ | grep -oE 'moon_pk_[a-z0-9_]+'
```

## Usage

```bash
# Register a single account on staging
node index.js 1 --staging

# Register 5 accounts concurrently on staging
node index.js 5 --staging

# Register 3 accounts on production
node index.js 3 --prod

# List configured targets
node index.js --list

# Show help
node index.js --help
```

## How It Works

The registration flow leverages MoonX's public SDK authentication endpoints:

| Step | Method | Endpoint | Description |
|------|--------|----------|-------------|
| 1 | `GET` | `/v0/sdk/apps/public/config` | Fetch application configuration and detect CAPTCHA |
| 2 | `POST` | `/v0/sdk/wallet/email/begin` | Trigger OTP email to the target address |
| 3 | `GET` | `mailinator.com/api/v2/...` | Poll public inbox for 6-digit verification code |
| 4 | `POST` | `/v0/sdk/wallet/email/verify` | Exchange OTP for JWT access token |
| 5 | `GET` | `/v0/sdk/auth/users/public/me` | Retrieve authenticated user profile |
| 6 | `POST` | `/v0/sdk/auth/passkey/status` | Check passkey enrollment status |
| 7 | `GET` | `/v0/sdk/auth/oauth/google/begin` | Probe Google OAuth availability |
| 8 | — | File I/O | Persist token to `output/<target>/tokens.jsonl` |

All API requests include the `Authorization: PublicToken <publishableKey>` header. No private credentials are stored in the repository.

## Project Structure

```
paybox-reg-bot/
├── index.js                        Entry point, CLI argument parsing
├── config/
│   ├── settings.example.json       Configuration template (committed)
│   └── settings.json               Local configuration (gitignored)
├── src/
│   ├── http.js                     HTTPS client with MoonX header injection
│   ├── otp.js                      Mailinator inbox OTP poller
│   ├── bot.js                      Registration logic and concurrent pool runner
│   └── utils.js                    Helpers (email generation, JWT decode, I/O)
├── output/                         Generated tokens (gitignored)
├── .gitignore
├── LICENSE
└── README.md
```

## Output Format

### tokens.jsonl

Each line contains a complete account record:

```json
{
  "email": "user123456@mailinator.com",
  "access_token": "eyJhbGciOiJFUzI1NiIs...",
  "user_id": "019fb100-9fe3-74c0-a268-5229db32e279",
  "expires": "2026-07-30T04:22:12.000Z",
  "created": "2026-07-30T03:22:12.000Z"
}
```

### stats.json

Run summary after each execution:

```json
{
  "target": "Staging",
  "total": 5,
  "created": 5,
  "failed": 0,
  "rate_limited": 0,
  "runtime_s": 18,
  "tokens": [...]
}
```

## Rate Limiting

MoonX enforces a daily email cap per publishable key. When the cap is reached, the tool reports the error and exits cleanly. The cap resets on a daily cycle.

HTTP 429 responses are handled automatically with configurable retry attempts and backoff delay between requests.

## Security Notes

- Publishable keys are public by design (embedded in client-side JavaScript). They grant access to SDK endpoints but cannot be used to access other users' data without valid authentication tokens.
- Access tokens are JWT (ES256 signed) and are audience-bound to the specific MoonX application. Tokens issued for staging are not valid against production and vice versa.
- This tool does not bypass any authentication mechanism. It automates the same flow that a browser-based user would complete manually.

## Disclaimer

This tool is intended for authorized security testing and research purposes only. Ensure you have explicit permission to test the target environment before use. The author assumes no responsibility for misuse or unauthorized deployment of this software.

## License

MIT License — see [LICENSE](LICENSE) for details.
