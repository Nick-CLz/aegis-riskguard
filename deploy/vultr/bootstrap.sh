#!/usr/bin/env bash
# Aegis-RiskGuard — one-shot Vultr bootstrap
# Run as root on a fresh Ubuntu 22.04 VM:
#   curl -fsSL https://raw.githubusercontent.com/YOUR-USER/aegis-riskguard/main/deploy/vultr/bootstrap.sh | bash
# OR copy this file up and run: bash bootstrap.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Nick-CLz/aegis-riskguard.git}"
INSTALL_DIR="/opt/aegis-riskguard"

echo "==> Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Cloning repo"
if [ ! -d "$INSTALL_DIR" ]; then
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

echo "==> Setting up env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "🛑  Created .env from template."
  echo "   Edit it now:  nano $INSTALL_DIR/.env"
  echo "   Set GEMINI_API_KEY and LOBSTERTRAP_AUDIT_HMAC_KEY"
  echo "   Then re-run:  bash $INSTALL_DIR/deploy/vultr/bootstrap.sh"
  exit 0
fi

if grep -q "your-key-here" .env; then
  echo "🛑  GEMINI_API_KEY still has placeholder value. Edit .env first."
  exit 1
fi

echo "==> Building + starting container"
docker compose up -d --build

echo "==> Waiting for health check"
sleep 5
if curl -sf http://localhost/api/health >/dev/null; then
  echo ""
  echo "✅  Aegis-RiskGuard is up."
  echo "   Open:  http://$(curl -s ifconfig.me)/"
else
  echo "❌  Health check failed. Check logs:  docker compose logs"
  exit 1
fi
