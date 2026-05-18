# Vultr deployment runbook for Aegis-RiskGuard

This is the **fastest** path to a public demo URL. Assumes you already have a
Vultr account and a Gemini API key.

## 1. Spin up a Vultr VM (5 minutes)

In the Vultr UI:

1. Deploy New Server → **Cloud Compute - Shared CPU**
2. Server location: **Frankfurt** or **Amsterdam** (low latency to Gemini EU + Milan judges)
3. Image: **Ubuntu 22.04 LTS x64**
4. Plan: **$6/mo** (1 vCPU, 1 GB RAM) is sufficient for the demo. Bump to $12 if you want headroom.
5. Add SSH key (or set a root password)
6. Hostname: `aegis-riskguard`
7. Click **Deploy Now**

Copy the public IPv4 address. We'll call it `$VULTR_IP` below.

## 2. SSH in and install Docker (3 minutes)

```bash
ssh root@$VULTR_IP

# One-liner to install Docker + Compose
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

## 3. Get the code onto the VM (2 minutes)

Easiest path — clone from GitHub once you've pushed:

```bash
cd /opt
git clone https://github.com/Nick-CLz/aegis-riskguard.git
cd aegis-riskguard
```

Or, if you haven't pushed yet, scp it up from your laptop:

```bash
# From your laptop:
scp -r ./aegis-riskguard root@$VULTR_IP:/opt/
```

## 4. Configure environment (1 minute)

```bash
cd /opt/aegis-riskguard
cp .env.example .env
nano .env
```

Set:
- `GEMINI_API_KEY=` your real key from https://aistudio.google.com/apikey
- `LOBSTERTRAP_AUDIT_HMAC_KEY=` paste `$(openssl rand -hex 32)`

## 5. Build and run (5 minutes — first build is the slow step)

```bash
docker compose up -d --build

# Watch logs
docker compose logs -f
# Ctrl-C to detach (container keeps running)
```

## 6. Verify

```bash
curl http://localhost/api/health
# expect: {"ok":true,"service":"aegis-riskguard",...}
```

Open `http://$VULTR_IP/` in your browser. You should see the Aegis-RiskGuard UI.

## 7. (Optional) Add a domain + HTTPS

If you have a domain handy, point an A record at `$VULTR_IP`, then:

```bash
# Install caddy for auto-HTTPS
apt-get update && apt-get install -y caddy

cat > /etc/caddy/Caddyfile <<EOF
your-domain.com {
  reverse_proxy localhost:3000
}
EOF

systemctl reload caddy
```

That's it. Don't burn time on this if you don't already have a domain — the
raw IP works fine for hackathon submissions.

## Cost watchpoint

The $6/mo VM is billed hourly. **Destroy it after the hackathon** if you don't
need it, or you'll keep getting charged at ~$0.20/day. You can snapshot first
if you want to keep the demo state.

## Troubleshooting

**Container won't start:** `docker compose logs` — usually a missing env var.

**Gemini calls all fail:** check your API key is valid and you haven't hit the
free-tier quota. Set `DEMO_OFFLINE_MODE=true` in `.env` to fall back to
canned outputs for the live demo.

**Port 80 already in use:** `lsof -i :80` to find the culprit; usually nginx
or apache from a fresh Ubuntu install. `systemctl stop nginx`.
