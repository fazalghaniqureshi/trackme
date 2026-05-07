# Self-Hosting Design: Traccar Backend + TrackMe Frontend

**Date:** 2026-05-07  
**Status:** Approved  
**Approach:** Vercel (frontend, free) + Oracle Cloud Always Free Tier (Traccar backend, free)

## Problem

`demo2.traccar.org` is an unstable public demo server. Devices get stuck due to TCP half-open session drops, and there is no control over uptime or data. The goal is to self-host both the Traccar backend and the TrackMe React frontend at zero monthly cost.

---

## Architecture: Vercel + Oracle Cloud

```
┌─────────────────────┐        ┌──────────────────────────────────────┐
│       Vercel        │        │     Oracle Cloud Always Free VPS     │
│                     │        │           (Ubuntu 22.04 ARM)         │
│  React dist/        │        │                                      │
│  (CDN, global)      │        │  ┌──────────┐   ┌────────────────┐  │
│                     │        │  │ Traccar  │   │     nginx      │  │
│  vercel.json proxy: │───────►│  │ :8082    │◄──│ :80 proxy only │  │
│  /traccar/* ──────► │        │  │ (Java)   │   └────────────────┘  │
│  Oracle IP/...      │        │  └──────────┘                       │
│                     │        │       ▲                             │
└─────────────────────┘        │  Port 5027                         │
         ▲                     └───────┼─────────────────────────────┘
         │                            │
    Browser / User            FMC920 GPS device
    (via trackme.vercel.app)
```

**Key design decision on proxying:** The frontend (Vercel) proxies all `/traccar/*` API calls and WebSocket connections server-side to the Oracle Cloud IP. This means:
- The browser never talks directly to Oracle Cloud
- No CORS issues
- No mixed-content issues (Vercel is HTTPS; Oracle is HTTP — but the proxy is server-side)
- Same relative URL pattern (`/traccar/...`) works in dev (Vite proxy) and prod (Vercel rewrite)

---

## Section 1: Infrastructure

| Component | Provider | Cost |
|---|---|---|
| Frontend hosting | Vercel (free tier) | $0 |
| Backend (Traccar) | Oracle Cloud Always Free ARM VM | $0 |
| SSL for frontend | Automatic via Vercel (`*.vercel.app`) | $0 |
| SSL for backend | Not needed (Vercel proxies server-side) | — |
| Domain | Skipped for now (use `*.vercel.app` subdomain) | $0 |
| **Total** | | **$0/mo** |

### Oracle Cloud VM specs (Always Free ARM)
- 4 ARM Ampere A1 vCPU
- 24 GB RAM
- 200 GB boot volume
- Ubuntu 22.04 ARM64
- Static public IP

### Firewall rules on Oracle Cloud (Security List + iptables/ufw)

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH |
| 5027 | TCP + UDP | Teltonika FMC920 GPS data |
| 8082 | TCP | Traccar web UI (admin access only, can restrict to your IP) |

Port 80/443 are not needed on Oracle Cloud — Vercel proxies all web traffic server-side.

---

## Section 2: Traccar Configuration (Oracle Cloud)

Traccar installed from official `.deb` package on Ubuntu 22.04 ARM64. Config at `/opt/traccar/conf/traccar.xml`:

```xml
<entry key='database.driver'>org.h2.Driver</entry>
<entry key='database.url'>jdbc:h2:/opt/traccar/data/database</entry>
<entry key='server.port'>8082</entry>
<entry key='teltonika.port'>5027</entry>
```

- **No `web.origin`** restriction needed since only Vercel's servers call Traccar (not browsers directly)
- **Database:** H2 embedded — sufficient for small fleets, migratable later
- **Service:** `traccar.service` systemd — starts on boot, auto-restarts on failure
- **First-run:** Admin account created via `http://ORACLE_IP:8082` before locking down ports

---

## Section 3: Vercel Configuration (Frontend)

### `vercel.json` — proxy rules

Add to project root. Routes `/traccar/*` to Oracle Cloud server-side:

```json
{
  "rewrites": [
    {
      "source": "/traccar/:path*",
      "destination": "http://ORACLE_IP/:path*"
    }
  ]
}
```

This mirrors the Vite dev proxy exactly — same path, same rewrite behaviour. No changes to any TypeScript or service files.

### Deployment method

Connect the GitHub repo to Vercel. Every push to `main` auto-builds and deploys. Or use Vercel CLI (`vercel --prod`) for manual deploys.

### Environment variables in Vercel

`VITE_TRACCAR_URL` is only used by the Vite dev server proxy — it is **not** embedded in the built output and does not need to be set in Vercel's dashboard.

---

## Section 4: Code Changes Required

Only **one new file** is needed:

| File | Change | Reason |
|---|---|---|
| `vercel.json` | **New file** — proxy rewrite config | Routes `/traccar/*` to Oracle Cloud in production |
| `vite.config.ts` | No change | Dev proxy continues to use `VITE_TRACCAR_URL` |
| All services | No change | Already use relative `/traccar/...` URLs |
| `.env.local` | Update `VITE_TRACCAR_URL` → Oracle Cloud IP | Dev server points to new backend |

---

## Section 5: FMC920 Device Reconfiguration

Reconfigure via Teltonika Configurator (Windows app):

- **Server IP:** Oracle Cloud public IP
- **Server port:** 5027
- **Protocol:** TCP

After applying config, device sends GPS data to Oracle Cloud. Verify in Traccar admin at `http://ORACLE_IP:8082`.

---

## Implementation Order

1. Provision Oracle Cloud Always Free ARM VM (Ubuntu 22.04)
2. SSH into Oracle VM — install Java 17 JRE
3. Install Traccar from official `.deb`, configure `traccar.xml`, start service
4. Open port 5027 in Oracle Cloud Security List AND in ufw on the VM
5. Verify Traccar admin UI accessible at `http://ORACLE_IP:8082`
6. Create Traccar admin account, register FMC920 device by IMEI
7. Add `vercel.json` to project root with proxy rewrite pointing to Oracle IP
8. Update `.env.local` — set `VITE_TRACCAR_URL=http://ORACLE_IP`
9. Update `CLAUDE.md` to reflect new server
10. Connect GitHub repo to Vercel, trigger first deploy
11. Verify frontend loads at `trackme.vercel.app` and API calls reach Traccar
12. Reconfigure FMC920 to point at Oracle IP:5027
13. Verify device appears online in Traccar and TrackMe map
