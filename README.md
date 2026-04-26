# Multi-Account Mail Manager

A web-based email client for managing multiple email accounts across different providers.

## Features

- **Multi-account support** - Add and manage multiple email accounts in one interface
- **Multiple protocols** - IMAP, POP3, and Microsoft Graph API
- **Provider presets** - Pre-configured settings for Gmail, Outlook, Yahoo, QQ, 163, iCloud, and custom servers
- **Send & receive emails** - Full email functionality including compose, reply, and folder management
- **Token authentication** - API access secured with admin token
- **Flexible storage** - JSON file storage by default, optional Redis for production

## Tech Stack

- Next.js 15, React, TypeScript, Tailwind CSS
- IMAP (imapflow), POP3, SMTP (nodemailer)
- mailparser for email parsing
- Redis (optional)

## Installation


Open http://localhost:3000 and enter your admin token.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `X_ADMIN_TOKEN` | Required admin token for API authentication |
| `REDIS_URL` | Redis connection URL (optional) |
| `REDIS_PREFIX` | Redis key prefix (default: "mail") |
| `REDIS_TTL` | Redis TTL in seconds (default: 2592000) |

## Supported Providers

| Provider | IMAP | POP3 | Graph |
|----------|------|------|-------|
| Gmail | ✓ | ✓ | - |
| Outlook | ✓ | ✓ | ✓ |
| Yahoo | ✓ | ✓ | - |
| QQ Mail | ✓ | ✓ | - |
| 163.com | ✓ | ✓ | - |
| iCloud | ✓ | - | - |
| Custom | ✓ | ✓ | ✓ |

## Project Structure


## API Endpoints

All endpoints require `X-ADMIN-TOKEN` header.

- `GET /api/accounts` - List accounts
- `POST /api/accounts` - Add account
- `DELETE /api/accounts/:id` - Remove account
- `GET /api/mail/:accountId/:folder` - Get emails
- `POST /api/mail/send` - Send email
- `POST /api/mail/sync/:accountId` - Sync emails
- `POST /api/mail/import` - Bulk import accounts

## License

Private
