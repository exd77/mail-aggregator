# Mail Aggregator

A self-hosted, macOS-inspired mail aggregator that unifies multiple email accounts into a single dashboard. Built with Vue 3 + Element Plus on the frontend and Express.js + SQLite on the backend.

![Vue 3](https://img.shields.io/badge/Vue-3-42b883)
![Element Plus](https://img.shields.io/badge/Element_Plus-2.x-409eff)
![Node](https://img.shields.io/badge/Node.js-22+-339933)
![SQLite](https://img.shields.io/badge/SQLite-3-003b57)
![License](https://img.shields.io/badge/License-Private-red)

## Features

- **Multi-account IMAP** — connect Gmail, Outlook, or any IMAP provider
- **OAuth 2.0 support** — Gmail OAuth with auto token refresh
- **Real-time sync** — IMAP IDLE push + manual refresh
- **Folder management** — browse and sync IMAP folders
- **Multi-language** — English, Chinese, Javanese, Sundanese
- **Responsive** — works on desktop and mobile
- **Self-hosted** — your data stays on your server
- **Encrypted storage** — refresh tokens encrypted at rest with AES-256

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, Element Plus, Pinia, Vue Router, Vue i18n |
| Backend | Express.js, SQLite (better-sqlite3), ImapFlow, MailParser |
| Auth | JWT (dashboard login), OAuth 2.0 (Gmail) |
| Encryption | AES-256-CBC for token storage |

## Quick Start

### Prerequisites

- Node.js 22+
- npm 10+
- A Gmail account with OAuth credentials (or any IMAP provider)

### 1. Clone the repository

```bash
git clone https://github.com/exd77/mail-aggregator.git
cd mail-aggregator
```

### 2. Setup backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=8787
JWT_SECRET=your_random_secret_here
ADMIN_USER=admin
ADMIN_PASSWORD=your_secure_password
ENCRYPTION_KEY=your_32_char_encryption_key_here

# Gmail OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OAUTH_CALLBACK_PORT=8788
PUBLIC_BASE_URL=
```

### 3. Setup frontend

```bash
cd ../frontend
npm install
```

### 4. Run in development

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

### 5. Login

Use the admin credentials from your `.env` file (default: `admin` / password you set).

## Production Build

### Build frontend

```bash
cd frontend
npm run build
```

This outputs static files to `frontend/dist/`.

### Run production server

The backend serves the built frontend automatically:

```bash
cd backend
NODE_ENV=production node src/index.js
```

The app will be available at `http://localhost:8787`.

### Using PM2 (recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the backend
cd backend
pm2 start src/index.js --name mail-aggregator

# Save process list and enable startup
pm2 save
pm2 startup
```

### Using systemd

```ini
[Unit]
Description=Mail Aggregator
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/mail-aggregator/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Project Structure

```
mail-aggregator/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server entry
│   │   ├── config.js         # Environment config
│   │   ├── db.js             # SQLite database setup
│   │   ├── auth.js           # JWT authentication
│   │   ├── crypto.js         # AES-256 encryption
│   │   ├── accountManager.js # Account CRUD + IMAP connections
│   │   ├── folderManager.js  # IMAP folder operations
│   │   ├── imapService.js    # IMAP sync engine
│   │   ├── googleService.js  # Gmail OAuth flow
│   │   ├── oauthFlow.js      # OAuth loopback handler
│   │   └── oauthConstants.js # OAuth provider configs
│   ├── data/                 # SQLite database (gitignored)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/            # Page components
│   │   │   ├── Dashboard.vue # Overview dashboard
│   │   │   ├── Inbox.vue     # Unified inbox
│   │   │   └── Accounts.vue  # Account management
│   │   ├── components/       # Reusable components
│   │   ├── composables/      # Vue composables
│   │   ├── i18n/             # Multi-language support
│   │   ├── store/            # Pinia state management
│   │   ├── api/              # API client layer
│   │   ├── router/           # Vue Router config
│   │   └── layout/           # App layout shell
│   ├── dist/                 # Build output (gitignored)
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/accounts` | List all accounts |
| POST | `/api/accounts` | Add new account |
| DELETE | `/api/accounts/:id` | Remove account |
| POST | `/api/accounts/:id/sync` | Sync account |
| GET | `/api/accounts/:id/folders` | List folders |
| GET | `/api/accounts/:id/messages` | Get messages |
| GET | `/api/messages/:id` | Get single message |
| POST | `/api/messages/:id/read` | Mark as read |
| POST | `/api/messages/:id/star` | Toggle star |
| DELETE | `/api/messages/:id` | Delete message |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8787` | Server port |
| `JWT_SECRET` | **Yes** | — | Secret for JWT signing |
| `ADMIN_USER` | No | `admin` | Dashboard username |
| `ADMIN_PASSWORD` | **Yes** | — | Dashboard password |
| `ENCRYPTION_KEY` | **Yes** | — | 32+ char key for token encryption |
| `GOOGLE_CLIENT_ID` | **Yes** | — | Gmail OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | **Yes** | — | Gmail OAuth client secret |
| `OAUTH_CALLBACK_PORT` | No | `8788` | OAuth loopback port |
| `PUBLIC_BASE_URL` | No | — | Public URL for remote OAuth |

## License

Private — All rights reserved.
