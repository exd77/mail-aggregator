#!/usr/bin/env bash
# ============================================================================
# Mail Aggregator — Production Setup Script
# ============================================================================
# Usage:  sudo bash setup-production.sh [--domain your.domain.com]
#
# What this script does (in order):
#   1. Install system dependencies (Node.js 22 LTS, build tools)
#   2. Clone / update repo
#   3. Install backend + frontend npm dependencies
#   4. Generate .env with auto-generated secrets
#   5. Configure Mozilla Thunderbird OAuth client ID (Gmail)
#   6. Build frontend (Vite → dist/)
#   7. Create systemd service (auto-restart, auto-start on boot)
#   8. Setup Caddy reverse proxy with auto-HTTPS (if --domain given)
#   9. Configure UFW firewall
#
# Thunderbird OAuth:
#   Uses Mozilla's public OAuth client ID for Thunderbird.
#   No Google Cloud Console setup needed — just click "Add Gmail Account"
#   in the app and authorize in the browser popup.
#
# Tested on: Ubuntu 22.04/24.04, Debian 12
# ============================================================================

set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR!]${NC}  $*" >&2; }
step()  { echo -e "\n${BOLD}━━━ Step $1: $2 ━━━${NC}"; }

# ─── Config ───────────────────────────────────────────────────────────────────
APP_NAME="mail-aggregator"
APP_USER="root"
APP_DIR="/root/${APP_NAME}"
REPO_URL="https://github.com/exd77/mail-aggregator.git"
BRANCH="main"
NODE_MAJOR=22
BACKEND_PORT=8787
DOMAIN=""

# ─── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain) DOMAIN="$2"; shift 2 ;;
        --port)   BACKEND_PORT="$2"; shift 2 ;;
        --dir)    APP_DIR="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [--domain your.domain.com] [--port 8787] [--dir /path/to/app]"
            exit 0 ;;
        *) err "Unknown option: $1"; exit 1 ;;
    esac
done

# ─── Pre-flight checks ──────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "Run as root: sudo bash $0"
    exit 1
fi

ARCH=$(uname -m)
OS_ID=""
if [[ -f /etc/os-release ]]; then
    OS_ID=$(grep ^ID= /etc/os-release | cut -d= -f2 | tr -d '"')
fi
info "Architecture: ${ARCH} | OS: ${OS_ID:-unknown}"

# ============================================================================
# Step 1: System Dependencies
# ============================================================================
step 1 "Installing system dependencies"

apt-get update -qq

apt-get install -y -qq \
    curl git build-essential python3 ca-certificates gnupg \
    unzip jq lsof > /dev/null 2>&1

ok "Build tools installed"

# Install Node.js 22 LTS
if command -v node &>/dev/null; then
    CURRENT_NODE=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$CURRENT_NODE" -ge "$NODE_MAJOR" ]]; then
        ok "Node.js $(node -v) already OK (>= v${NODE_MAJOR})"
    else
        warn "Node.js $(node -v) too old, upgrading..."
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs > /dev/null 2>&1
        ok "Upgraded to Node.js $(node -v)"
    fi
else
    info "Installing Node.js ${NODE_MAJOR}.x..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs > /dev/null 2>&1
    ok "Node.js $(node -v) installed"
fi

info "npm $(npm -v)"

# Install Caddy if domain specified
if [[ -n "$DOMAIN" ]]; then
    if ! command -v caddy &>/dev/null; then
        info "Installing Caddy..."
        apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https > /dev/null 2>&1
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
            | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
            | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
        apt-get update -qq > /dev/null 2>&1
        apt-get install -y -qq caddy > /dev/null 2>&1
        ok "Caddy installed"
    else
        ok "Caddy already installed"
    fi
fi

# ============================================================================
# Step 2: Clone / Update Repository
# ============================================================================
step 2 "Setting up repository"

if [[ -d "${APP_DIR}/.git" ]]; then
    info "Repo exists, pulling latest ${BRANCH}..."
    cd "$APP_DIR"
    git fetch origin "$BRANCH" --quiet
    git reset --hard "origin/${BRANCH}" --quiet
    ok "Updated to latest"
else
    info "Cloning..."
    git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$APP_DIR" --quiet
    ok "Cloned to ${APP_DIR}"
fi

cd "$APP_DIR"

# ============================================================================
# Step 3: Install Dependencies
# ============================================================================
step 3 "Installing npm dependencies"

cd "${APP_DIR}/backend"
info "Backend..."
npm install --production --quiet 2>&1 | tail -1
ok "Backend deps done"

cd "${APP_DIR}/frontend"
info "Frontend..."
npm install --quiet 2>&1 | tail -1
ok "Frontend deps done"

# ============================================================================
# Step 4: Generate Secrets & Configure .env
# ============================================================================
step 4 "Configuring environment (.env)"

ENV_FILE="${APP_DIR}/backend/.env"

# Helper: generate alphanumeric secret
gen_secret() {
    openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c "$1"
}

if [[ -f "$ENV_FILE" ]] && grep -q "JWT_SECRET=" "$ENV_FILE" 2>/dev/null; then
    ok ".env already exists — keeping existing secrets"
    info "Delete ${ENV_FILE} and re-run to regenerate"
else
    info "Generating .env with secure random secrets..."

    JWT_SECRET=$(gen_secret 48)
    ENCRYPTION_KEY=$(gen_secret 32)
    ADMIN_PASSWORD=$(gen_secret 20)

    # Write .env
    cat > "$ENV_FILE" <<EOF
# ============================================================================
# Mail Aggregator — Environment Configuration
# Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# ============================================================================

# ─── Server ──────────────────────────────────────────────────────────────────
PORT=${BACKEND_PORT}
HOST=0.0.0.0

# ─── Authentication ──────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
ADMIN_USER=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ─── Encryption ──────────────────────────────────────────────────────────────
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ─── Gmail OAuth (Mozilla Thunderbird Public Client) ─────────────────────────
# These are PUBLIC values from Mozilla Thunderbird.
# Source: https://hg.mozilla.org/comm-central/
# No Google Cloud Console setup required.
GOOGLE_CLIENT_ID=406964657835-6k5q8h7qvvg0qs3cf4q1rhsc6s6bk829.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=
OAUTH_CALLBACK_PORT=8788

# ─── Deployment ──────────────────────────────────────────────────────────────
PUBLIC_BASE_URL=$( [[ -n "$DOMAIN" ]] && echo "https://${DOMAIN}" || echo "" )

# ─── Sync ────────────────────────────────────────────────────────────────────
AUTO_SYNC_INTERVAL_MS=30000
AUTO_SYNC_CONCURRENCY=10
EOF

    chmod 600 "$ENV_FILE"

    ok ".env generated"
    echo ""
    warn "╔══════════════════════════════════════════════════════════╗"
    warn "║  SAVE THESE CREDENTIALS — shown only once!               ║"
    warn "╠══════════════════════════════════════════════════════════╣"
    warn "║  Admin User:     admin                                   ║"
    printf "${YELLOW}║  Admin Password: %-40s║${NC}\n" "$ADMIN_PASSWORD"
    printf "${YELLOW}║  JWT Secret:     %-40s║${NC}\n" "${JWT_SECRET:0:24}..."
    printf "${YELLOW}║  Encryption Key: %-40s║${NC}\n" "${ENCRYPTION_KEY:0:24}..."
    warn "╚══════════════════════════════════════════════════════════╝"
    echo ""
fi

# Ensure Thunderbird OAuth is set (idempotent)
if ! grep -q "406964657835-6k5q8h7qvvg0qs3cf4q1rhsc6s6bk829" "$ENV_FILE" 2>/dev/null; then
    info "Setting Thunderbird OAuth client ID..."
    sed -i 's|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=406964657835-6k5q8h7qvvg0qs3cf4q1rhsc6s6bk829.apps.googleusercontent.com|' "$ENV_FILE"
    sed -i 's|^GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=|' "$ENV_FILE"
    ok "Thunderbird OAuth configured"
else
    ok "Thunderbird OAuth already configured"
fi

# ============================================================================
# Step 5: Build Frontend
# ============================================================================
step 5 "Building frontend (Vite → dist/)"

cd "${APP_DIR}/frontend"
rm -rf dist/

info "Running build..."
BUILD_OUTPUT=$(npm run build 2>&1)
if echo "$BUILD_OUTPUT" | grep -qi "error"; then
    err "Build errors detected:"
    echo "$BUILD_OUTPUT" | grep -i "error" | head -5
    err "Check: cd ${APP_DIR}/frontend && npm run build"
    exit 1
fi

if [[ -d "dist" ]] && [[ -f "dist/index.html" ]]; then
    BUILD_SIZE=$(du -sh dist/ | cut -f1)
    ok "Frontend built (${BUILD_SIZE})"
else
    err "Build failed — dist/index.html not found"
    exit 1
fi

# ============================================================================
# Step 6: Systemd Service
# ============================================================================
step 6 "Creating systemd service"

SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Mail Aggregator — Self-hosted email client
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=5
EnvironmentFile=${APP_DIR}/backend/.env
Environment=NODE_ENV=production

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/backend/data
ProtectHome=false

# Resources
LimitNOFILE=65536
TimeoutStartSec=30
TimeoutStopSec=15

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}" --quiet 2>&1

# Kill existing process on port if any
if lsof -i ":${BACKEND_PORT}" -t &>/dev/null; then
    info "Stopping existing process on port ${BACKEND_PORT}..."
    kill $(lsof -i ":${BACKEND_PORT}" -t) 2>/dev/null || true
    sleep 2
fi

systemctl restart "${APP_NAME}"
sleep 3

if systemctl is-active --quiet "${APP_NAME}"; then
    ok "Service running"
else
    err "Service failed to start!"
    journalctl -u "${APP_NAME}" -n 20 --no-pager
    exit 1
fi

# ============================================================================
# Step 7: Caddy Reverse Proxy (if domain)
# ============================================================================
if [[ -n "$DOMAIN" ]]; then
    step 7 "Configuring Caddy → ${DOMAIN}"

    CADDYFILE="/etc/caddy/Caddyfile"
    [[ -f "$CADDYFILE" ]] && cp "$CADDYFILE" "${CADDYFILE}.bak"

    if ! grep -q "$DOMAIN" "$CADDYFILE" 2>/dev/null; then
        cat >> "$CADDYFILE" <<EOF

# Mail Aggregator
${DOMAIN} {
    reverse_proxy localhost:${BACKEND_PORT}
    encode gzip

    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    try_files {path} /index.html
}
EOF
        ok "Caddy config written"
    fi

    systemctl reload caddy 2>/dev/null || systemctl restart caddy
    ok "Caddy running with auto-HTTPS"

    # Update PUBLIC_BASE_URL
    sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=https://${DOMAIN}|" "$ENV_FILE"
    systemctl restart "${APP_NAME}"
    ok "Backend restarted with PUBLIC_BASE_URL=https://${DOMAIN}"
else
    step 7 "Skipping reverse proxy (no --domain)"
    IP_ADDR=$(hostname -I | awk '{print $1}')
    info "Direct access: http://${IP_ADDR}:${BACKEND_PORT}"
fi

# ============================================================================
# Step 8: Firewall
# ============================================================================
step 8 "Configuring firewall"

if command -v ufw &>/dev/null; then
    ufw allow 22/tcp comment "SSH" >/dev/null 2>&1
    if [[ -n "$DOMAIN" ]]; then
        ufw allow 80/tcp comment "HTTP" >/dev/null 2>&1
        ufw allow 443/tcp comment "HTTPS" >/dev/null 2>&1
    else
        ufw allow "${BACKEND_PORT}/tcp" comment "Mail Aggregator" >/dev/null 2>&1
    fi
    if ! ufw status | grep -q "Status: active"; then
        echo "y" | ufw enable >/dev/null 2>&1
    fi
    ok "Firewall configured"
else
    warn "UFW not installed — skipping"
fi

# ============================================================================
# Step 9: Health Check
# ============================================================================
step 9 "Health checks"

CHECKS_PASS=0
CHECKS_TOTAL=4

if systemctl is-active --quiet "${APP_NAME}"; then
    ok "✅ Service: running"; ((CHECKS_PASS++))
else
    err "❌ Service: not running"
fi

if ss -tlnp | grep -q ":${BACKEND_PORT}"; then
    ok "✅ Port ${BACKEND_PORT}: listening"; ((CHECKS_PASS++))
else
    warn "⚠️  Port ${BACKEND_PORT}: not listening"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${BACKEND_PORT}/" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
    ok "✅ HTTP: ${HTTP_CODE}"; ((CHECKS_PASS++))
else
    warn "⚠️  HTTP: ${HTTP_CODE}"
fi

DB_FILE="${APP_DIR}/backend/data/mail.db"
if [[ -f "$DB_FILE" ]]; then
    ok "✅ Database: $(du -sh "$DB_FILE" | cut -f1)"; ((CHECKS_PASS++))
else
    info "Database: will be created on first request"; ((CHECKS_PASS++))
fi

# ============================================================================
# Done!
# ============================================================================
IP_ADDR=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           ✅  Mail Aggregator Setup Complete!                ║${NC}"
echo -e "${GREEN}${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"
if [[ -n "$DOMAIN" ]]; then
echo -e "${GREEN}${BOLD}║${NC}  🌐 URL:      https://${DOMAIN}"
else
echo -e "${GREEN}${BOLD}║${NC}  🌐 URL:      http://${IP_ADDR}:${BACKEND_PORT}"
fi
echo -e "${GREEN}${BOLD}║${NC}  📁 App:      ${APP_DIR}"
echo -e "${GREEN}${BOLD}║${NC}  📋 Logs:     journalctl -u ${APP_NAME} -f"
echo -e "${GREEN}${BOLD}║${NC}  🔧 Service:  systemctl {start|stop|restart} ${APP_NAME}"
echo -e "${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  🔑 Gmail OAuth: Thunderbird public client (auto-configured)"
echo -e "${GREEN}${BOLD}║${NC}     → Just click 'Add Gmail Account' in the app"
echo -e "${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}║${NC}  Health: ${CHECKS_PASS}/${CHECKS_TOTAL} checks passed"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Quick Commands:${NC}"
echo "  systemctl status ${APP_NAME}         # Check status"
echo "  systemctl restart ${APP_NAME}        # Restart"
echo "  journalctl -u ${APP_NAME} -f         # Live logs"
echo "  nano ${APP_DIR}/backend/.env         # Edit config"
echo ""
echo -e "${BOLD}Adding Gmail:${NC}"
echo "  1. Open app URL → login with admin credentials"
echo "  2. Click 'Add Account' → Gmail"
echo "  3. Authorize in browser popup → done!"
echo "  4. Emails auto-sync every 30 seconds"
echo ""
