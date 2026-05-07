# Self-Hosting Design: Traccar Backend + TrackMe Frontend

**Date:** 2026-05-07  
**Status:** Approved

## Problem

`demo2.traccar.org` is an unstable public demo server. Devices get stuck due to TCP half-open session drops, and there is no control over uptime or data. The goal is to self-host both the Traccar backend and the TrackMe React frontend on a single Hostinger KVM VPS for stability and full ownership.

---

## Architecture: Option A — Single VPS

Everything runs on one Hostinger KVM VPS (Ubuntu 22.04 LTS).

```
┌─────────────────────────────────────────────────────┐
│              Hostinger KVM VPS (Ubuntu 22.04)        │
│                                                     │
│  ┌──────────┐    ┌──────────────────────────────┐   │
│  │ Traccar  │    │          nginx               │   │
│  │ :8082    │◄───│  yourdomain.com → /var/www/  │   │
│  │ (Java)   │    │  /traccar/* → localhost:8082  │   │
│  └──────────┘    └──────────────────────────────┘   │
│       ▲                      ▲                      │
│  Port 5027              Port 80/443                 │
└───────┼──────────────────────┼─────────────────────┘
        │                      │
  FMC920 GPS device       Browser / User
```

---

## Section 1: Infrastructure

| Component | Detail |
|---|---|
| Provider | Hostinger KVM VPS |
| OS | Ubuntu 22.04 LTS |
| Backend | Traccar (Java, systemd service) on port 8082 (internal) |
| Frontend | React `dist/` served by nginx from `/var/www/trackme` |
| Reverse proxy | nginx — serves frontend + proxies `/traccar/*` → `localhost:8082` |
| SSL | Let's Encrypt via Certbot (requires domain A-record → VPS IP) |
| GPS port | 5027 TCP/UDP open in ufw firewall (Teltonika protocol) |

### Firewall rules (ufw)

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (redirects to HTTPS) |
| 443 | TCP | HTTPS |
| 5027 | TCP+UDP | Teltonika FMC920 GPS data |

---

## Section 2: Traccar Configuration

Traccar is installed from the official `.deb` package. Config lives at `/opt/traccar/conf/traccar.xml`.

```xml
<entry key='database.driver'>org.h2.Driver</entry>
<entry key='database.url'>jdbc:h2:/opt/traccar/data/database</entry>
<entry key='web.origin'>https://yourdomain.com</entry>
<entry key='server.port'>8082</entry>
<entry key='teltonika.port'>5027</entry>
```

- **Database:** H2 embedded (default). Sufficient for small fleets. Migratable to MySQL/PostgreSQL later if needed.
- **First-run setup:** Admin account created via Traccar web UI at `http://VPS_IP:8082` before nginx is configured.
- **Device registration:** FMC920 IMEI registered in Traccar admin panel. Teltonika configurator used to update APN server IP → VPS public IP, port 5027.
- **Service:** Traccar runs as `traccar.service` via systemd — starts on boot, restarts on failure.

---

## Section 3: nginx Configuration

nginx serves two responsibilities from one server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Serve React SPA
    root /var/www/trackme;
    index index.html;
    try_files $uri $uri/ /index.html;

    # Proxy Traccar API — matches Vite dev proxy path
    location /traccar/ {
        proxy_pass http://127.0.0.1:8082/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
        # WebSocket support (for Traccar WS updates)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Key design decision:** The `/traccar/` proxy path in nginx matches exactly the `/traccar` Vite dev proxy path in `vite.config.ts`. This means the frontend code makes identical relative API calls in both dev and production — no environment-specific code or build flags needed.

---

## Section 4: Frontend Build & Deploy

### What changes in the codebase

**Nothing.** The frontend already uses relative `/traccar/...` API calls which work identically via:
- Vite proxy in dev (`vite.config.ts` forwards to `VITE_TRACCAR_URL`)
- nginx proxy in production (forwards to `localhost:8082`)

`VITE_TRACCAR_URL` in `.env.local` is only consumed by the Vite dev server — it is not embedded in the built output.

The only config update: **`CLAUDE.md`** should be updated to reflect the new target server URL.

### Deploy flow (manual)

```bash
# 1. On local machine — build
npm run build

# 2. Upload dist/ to server
rsync -avz dist/ user@VPS_IP:/var/www/trackme/

# 3. No nginx restart needed — static files are served immediately
```

---

## Section 5: FMC920 Device Reconfiguration

The Teltonika FMC920 must be reconfigured via Teltonika Configurator (Windows app) to point at the new server:

- **Server IP:** VPS public IP address
- **Server port:** 5027
- **Protocol:** TCP
- **APN:** unchanged (carrier-dependent)

After reconfiguring and sending the config to the device, the device will start sending GPS data to the VPS. Verify in Traccar's web UI — the device should appear online within a few minutes.

---

## Implementation Order

1. Provision / access Hostinger KVM VPS via SSH
2. Install dependencies: Java 17 JRE, nginx, ufw, certbot
3. Install Traccar from official `.deb`, configure `traccar.xml`, start service
4. Open firewall ports (22, 80, 443, 5027)
5. Point domain A-record → VPS IP, obtain Let's Encrypt cert
6. Write and enable nginx config
7. Build React app locally, rsync `dist/` to `/var/www/trackme/`
8. Verify frontend loads and API calls reach Traccar
9. Reconfigure FMC920 to point at VPS IP:5027
10. Verify device appears online in Traccar and TrackMe map
11. Update `CLAUDE.md` with new server URL
