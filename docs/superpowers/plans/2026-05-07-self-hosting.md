# Self-Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host Traccar backend on Oracle Cloud Always Free ARM VM and the TrackMe React frontend on Vercel — both at zero monthly cost — replacing the unstable `demo2.traccar.org` demo server.

**Architecture:** Oracle Cloud ARM VM runs Traccar (Java) on port 8082 internally and accepts GPS data on port 5027 from the FMC920 device. Vercel hosts the React `dist/` and proxies all `/traccar/*` requests server-side to the Oracle VM via `vercel.json` rewrites — so the browser never sees the Oracle IP and CORS/mixed-content is a non-issue.

**Tech Stack:** Oracle Cloud OCI (Ubuntu 22.04 ARM64), Traccar 6.x, ufw, Vercel, React 19 + Vite, Teltonika FMC920

---

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `vercel.json` | **Create** | Proxy `/traccar/*` → Oracle VM at build/runtime |
| `.env.local` | **Modify** | Point Vite dev proxy to Oracle VM IP |
| `CLAUDE.md` | **Modify** | Update server URL reference |

No TypeScript, service, or component files change — all API calls already use relative `/traccar/...` URLs.

---

## Task 1: Provision Oracle Cloud Always Free ARM VM

**Where:** Oracle Cloud Console (browser) — `cloud.oracle.com`

> Oracle Cloud gives you a permanent free ARM VM: 4 OCPU, 24 GB RAM, 200 GB disk.  
> You must use a credit card to sign up — it will NOT be charged if you stay in Always Free resources.

- [ ] **Step 1: Sign up / log in to Oracle Cloud**

  Go to `https://cloud.oracle.com` → sign up with email. During signup, select your home region — **choose the region closest to Pakistan** (Mumbai: `ap-mumbai-1` or Mumbai 2: `ap-mumbai-2`). You cannot change this later.

  > If you already have an account, log in and verify your home region in the top-right corner.

- [ ] **Step 2: Navigate to Create Instance**

  In the OCI Console: **Hamburger menu → Compute → Instances → Create Instance**

- [ ] **Step 3: Configure the VM**

  Fill in the form:

  | Field | Value |
  |---|---|
  | Name | `traccar-server` |
  | Compartment | (root compartment, default) |
  | Image | Ubuntu 22.04 (click "Change image" → Platform images → Ubuntu 22.04 Minimal) |
  | Shape | Click "Change shape" → Ampere → `VM.Standard.A1.Flex` → set **4 OCPUs** and **24 GB RAM** |
  | SSH keys | "Generate a key pair for me" → **Download both private and public keys** and save securely |

- [ ] **Step 4: Note the public IP**

  After the instance reaches "Running" state (2–5 min), click it and note the **Public IP address** from the Instance Details page. This is `ORACLE_IP` for the rest of this plan.

- [ ] **Step 5: Test SSH access**

  Run from your local machine (adjust key path and IP):
  ```bash
  ssh -i ~/Downloads/ssh-key-XXXX.key ubuntu@ORACLE_IP
  ```
  Expected: you land at `ubuntu@traccar-server:~$` prompt.

---

## Task 2: Configure Oracle Cloud Firewall (Security List)

**Where:** OCI Console — this opens ports in Oracle's network layer.

> Oracle Cloud has TWO firewall layers. This task opens the outer (cloud-level) layer.  
> Task 4 opens the inner (OS-level) layer. Both must be done.

- [ ] **Step 1: Open the Security List**

  OCI Console → **Networking → Virtual Cloud Networks** → click your VCN (auto-created with the VM) → **Security Lists** → click `Default Security List for vcn-XXXX`

- [ ] **Step 2: Add ingress rule for SSH (likely already exists)**

  Verify there is an entry: Source `0.0.0.0/0`, Protocol TCP, Destination Port `22`. If missing, add it.

- [ ] **Step 3: Add ingress rule for Traccar web UI**

  Click **Add Ingress Rules**:
  | Field | Value |
  |---|---|
  | Source CIDR | `0.0.0.0/0` |
  | IP Protocol | TCP |
  | Destination Port Range | `8082` |

- [ ] **Step 4: Add ingress rule for GPS data (TCP)**

  Click **Add Ingress Rules**:
  | Field | Value |
  |---|---|
  | Source CIDR | `0.0.0.0/0` |
  | IP Protocol | TCP |
  | Destination Port Range | `5027` |

- [ ] **Step 5: Add ingress rule for GPS data (UDP)**

  Click **Add Ingress Rules**:
  | Field | Value |
  |---|---|
  | Source CIDR | `0.0.0.0/0` |
  | IP Protocol | UDP |
  | Destination Port Range | `5027` |

- [ ] **Step 6: Verify rules are saved**

  The Ingress Rules list should now show entries for ports 22, 5027 (TCP), 5027 (UDP), and 8082.

---

## Task 3: Install Java and Traccar on Oracle VM

**Where:** SSH session on the Oracle VM.

> Traccar is a Java application. It provides a `.run` ARM64 installer script that handles everything — systemd service, config files, data directory.

- [ ] **Step 1: SSH into the VM**

  ```bash
  ssh -i ~/Downloads/ssh-key-XXXX.key ubuntu@ORACLE_IP
  ```

- [ ] **Step 2: Update packages and install Java 17**

  ```bash
  sudo apt update && sudo apt install -y openjdk-17-jre-headless
  ```
  Verify:
  ```bash
  java -version
  ```
  Expected output contains: `openjdk version "17.x.x"`

- [ ] **Step 3: Download the Traccar ARM64 installer**

  Check the latest release version at `https://github.com/traccar/traccar/releases` (look for `traccar-linux-arm64-X.Y.run`). Then download it:

  ```bash
  wget https://github.com/traccar/traccar/releases/download/v6.6/traccar-linux-arm64-6.6.run
  ```

  > If 6.6 is not the latest, replace with the current version number from the releases page.

- [ ] **Step 4: Run the installer**

  ```bash
  chmod +x traccar-linux-arm64-6.6.run
  sudo ./traccar-linux-arm64-6.6.run
  ```
  Expected: installer prints "Traccar installed successfully" and creates `/opt/traccar/`.

- [ ] **Step 5: Configure Traccar**

  Open the config file:
  ```bash
  sudo nano /opt/traccar/conf/traccar.xml
  ```

  Replace the entire file contents with:
  ```xml
  <?xml version='1.0' encoding='UTF-8'?>

  <!DOCTYPE properties SYSTEM 'http://java.sun.com/dtd/properties.dtd'>

  <properties>
      <entry key='config.default'>./conf/default.xml</entry>

      <entry key='database.driver'>org.h2.Driver</entry>
      <entry key='database.url'>jdbc:h2:/opt/traccar/data/database</entry>
      <entry key='database.user'>sa</entry>
      <entry key='database.password'></entry>

      <entry key='server.port'>8082</entry>
      <entry key='teltonika.port'>5027</entry>
  </properties>
  ```

  Save: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Task 4: Configure OS Firewall (ufw) on Oracle VM

**Where:** SSH session on the Oracle VM.

> Ubuntu 22.04 on Oracle Cloud ships with iptables rules that block all ports except 22 — even if Oracle's Security List allows them. ufw wraps iptables cleanly. This task opens ports at the OS level.

- [ ] **Step 1: Install ufw**

  ```bash
  sudo apt install -y ufw
  ```

- [ ] **Step 2: Set default policies**

  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  ```

- [ ] **Step 3: Allow SSH (critical — do this before enabling ufw)**

  ```bash
  sudo ufw allow 22/tcp
  ```

- [ ] **Step 4: Allow Traccar web UI**

  ```bash
  sudo ufw allow 8082/tcp
  ```

- [ ] **Step 5: Allow GPS data port**

  ```bash
  sudo ufw allow 5027/tcp
  sudo ufw allow 5027/udp
  ```

- [ ] **Step 6: Enable ufw**

  ```bash
  sudo ufw enable
  ```
  Type `y` when prompted. Your SSH session will remain connected.

- [ ] **Step 7: Verify rules**

  ```bash
  sudo ufw status
  ```
  Expected output:
  ```
  Status: active

  To                         Action      From
  --                         ------      ----
  22/tcp                     ALLOW       Anywhere
  8082/tcp                   ALLOW       Anywhere
  5027/tcp                   ALLOW       Anywhere
  5027/udp                   ALLOW       Anywhere
  ```

---

## Task 5: Start Traccar and Create Admin Account

**Where:** SSH session (to start service) + browser (to create account).

- [ ] **Step 1: Start the Traccar service**

  ```bash
  sudo systemctl start traccar
  sudo systemctl enable traccar
  ```

- [ ] **Step 2: Verify Traccar is running**

  ```bash
  sudo systemctl status traccar
  ```
  Expected: `Active: active (running)`

  Also check the log for errors:
  ```bash
  sudo tail -f /opt/traccar/logs/tracker-server.log
  ```
  Expected: lines ending in `Server started` with no ERROR lines. Press `Ctrl+C` to exit.

- [ ] **Step 3: Verify Traccar web UI is reachable**

  From your local machine:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://ORACLE_IP:8082
  ```
  Expected: `200`

  > If you get a timeout, double-check Task 2 (Security List) and Task 4 (ufw) — both layers must be open.

- [ ] **Step 4: Create admin account in Traccar**

  Open `http://ORACLE_IP:8082` in your browser.

  On first load, Traccar shows a registration form. Fill in:
  - Email: your email address
  - Password: a strong password (save it — this is your Traccar admin login)

  Click **Register**. You'll be logged in as admin.

- [ ] **Step 5: Register the FMC920 device in Traccar**

  In the Traccar web UI: **Devices → + (Add)** → fill in:
  - Name: `FMC920` (or a vehicle name)
  - Identifier: the device's **IMEI number** (15 digits, printed on the FMC920 label or found in Teltonika Configurator → System → Device info)

  Click **Save**.

- [ ] **Step 6: Verify Traccar API responds correctly**

  ```bash
  curl -s -u "your@email.com:yourpassword" http://ORACLE_IP:8082/api/devices
  ```
  Expected: JSON array containing the device you just registered, e.g.:
  ```json
  [{"id":1,"name":"FMC920","uniqueId":"IMEI_HERE","status":"offline",...}]
  ```

---

## Task 6: Add vercel.json to Project

**Where:** Local machine, in the `C:\trackme` project root.

> `vercel.json` tells Vercel to proxy `/traccar/*` requests server-side to your Oracle VM. This mirrors the Vite dev proxy — no TypeScript changes needed anywhere.

- [ ] **Step 1: Create `vercel.json` in the project root**

  Create file `C:\trackme\vercel.json` with this content (replace `ORACLE_IP` with your actual Oracle public IP):

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

  Example with a real IP:
  ```json
  {
    "rewrites": [
      {
        "source": "/traccar/:path*",
        "destination": "http://140.238.XXX.XXX/:path*"
      }
    ]
  }
  ```

- [ ] **Step 2: Verify the file is at the project root**

  The file must be at `C:\trackme\vercel.json` — same level as `package.json` and `vite.config.ts`.

- [ ] **Step 3: Commit**

  ```bash
  git add vercel.json
  git commit -m "feat: add Vercel proxy rewrite for Traccar backend on Oracle Cloud"
  ```

---

## Task 7: Update .env.local and CLAUDE.md

**Where:** Local machine.

- [ ] **Step 1: Update `.env.local`**

  Open `C:\trackme\.env.local` and replace its contents with:
  ```
  VITE_TRACCAR_URL=http://ORACLE_IP:8082
  ```
  (Replace `ORACLE_IP` with your actual Oracle public IP.)

  This points the Vite dev server proxy to your new Oracle-hosted Traccar when running `npm run dev` locally.

- [ ] **Step 2: Update `CLAUDE.md`**

  In `C:\trackme\CLAUDE.md`, find the line:
  ```
  - Target server: `https://demo2.traccar.org` (set in `.env.local` as `VITE_TRACCAR_URL`) — **demo server only; for production deploy your own Traccar instance**
  ```

  Replace it with:
  ```
  - Target server: Oracle Cloud ARM VM (set in `.env.local` as `VITE_TRACCAR_URL=http://ORACLE_IP:8082`). Production frontend runs on Vercel; `vercel.json` proxies `/traccar/*` to the Oracle VM.
  ```

- [ ] **Step 3: Commit both changes**

  ```bash
  git add .env.local CLAUDE.md
  git commit -m "config: point Traccar URL to Oracle Cloud self-hosted instance"
  ```

  > `.env.local` is in `.gitignore` by default in Vite projects. If git says "nothing to commit" for it, that's expected — the file is local-only. Only commit `CLAUDE.md`.

---

## Task 8: Deploy Frontend to Vercel

**Where:** Vercel dashboard (browser) + local machine.

- [ ] **Step 1: Sign up / log in to Vercel**

  Go to `https://vercel.com` → sign up with GitHub account (recommended — enables auto-deploy on push).

- [ ] **Step 2: Import the GitHub repository**

  Vercel Dashboard → **Add New → Project** → **Import Git Repository** → select the `trackme` repo.

  > If the repo is not listed, click "Adjust GitHub App Permissions" and grant Vercel access to the repo.

- [ ] **Step 3: Configure the project**

  Vercel auto-detects Vite. Verify these settings before deploying:

  | Setting | Value |
  |---|---|
  | Framework Preset | Vite |
  | Build Command | `npm run build` |
  | Output Directory | `dist` |
  | Install Command | `npm install` |

  Do **not** add any environment variables — `VITE_TRACCAR_URL` is only used by the Vite dev server and is not needed in Vercel's build.

- [ ] **Step 4: Deploy**

  Click **Deploy**. Vercel builds and deploys. Wait ~1–2 minutes.

- [ ] **Step 5: Note your Vercel URL**

  After deploy, Vercel shows your URL: `https://trackme-XXXX.vercel.app` (or a custom name if you set one). This is where the app lives.

- [ ] **Step 6: Verify the frontend loads**

  Open `https://trackme-XXXX.vercel.app` in your browser. Expected: TrackMe app loads — you see the login/settings screen or the map view.

- [ ] **Step 7: Verify Traccar API reaches Oracle**

  In the browser, open the Traccar settings page in TrackMe (`/traccar` route) and enter:
  - URL: leave blank (the app calls `/traccar/...` relative URLs — `vercel.json` handles routing)
  - Email: your Traccar admin email
  - Password: your Traccar admin password

  Click Save/Connect. Expected: app loads with your registered device visible in the sidebar.

  > If the connection fails, check the browser's Network tab → any `/traccar/api/session` request → inspect the response. A 502 means Vercel reached Oracle but Traccar is not running. A timeout means the Oracle firewall is blocking traffic.

---

## Task 9: Reconfigure FMC920 GPS Device

**Where:** Windows PC with Teltonika Configurator installed + FMC920 connected via USB.

> The FMC920 currently sends GPS data to `demo2.traccar.org:5027`. This task points it at your Oracle VM.

- [ ] **Step 1: Open Teltonika Configurator**

  Connect FMC920 via USB → open Teltonika Configurator → click **Load** to read current config from device.

- [ ] **Step 2: Update GPRS / Server settings**

  Navigate to **GPRS → Server Settings** (exact menu varies by firmware version). Update:

  | Field | Value |
  |---|---|
  | Server IP/Domain | `ORACLE_IP` (your Oracle public IP, e.g. `140.238.XXX.XXX`) |
  | Server Port | `5027` |
  | Protocol | TCP |

  Leave APN settings unchanged.

- [ ] **Step 3: Save and send config to device**

  Click **Save to device** (or **Send**). Wait for confirmation that config was applied.

- [ ] **Step 4: Verify device connects to Oracle**

  Watch the Traccar log on Oracle VM (leave this running in an SSH terminal):
  ```bash
  sudo tail -f /opt/traccar/logs/tracker-server.log
  ```
  Within 1–5 minutes of sending the config (device needs to reconnect), you should see a line like:
  ```
  [... INFO: id=IMEI, protocol=teltonika, address=X.X.X.X:XXXX]
  ```
  This confirms the FMC920 is sending data to your server.

---

## Task 10: End-to-End Verification

**Where:** Browser (Vercel app) + SSH (Oracle log).

- [ ] **Step 1: Check device status in Traccar**

  Open `http://ORACLE_IP:8082` → your FMC920 device should show **status: online** with a recent position timestamp.

- [ ] **Step 2: Check device in TrackMe**

  Open `https://trackme-XXXX.vercel.app` → log in → navigate to the map (`/`). Your FMC920 should appear on the map as an active marker.

- [ ] **Step 3: Verify real-time updates**

  Move the GPS device (or wait for it to send a new position). The marker on the TrackMe map should update within ~5 seconds (WebSocket) or ~5–30 seconds (polling fallback).

  > If the marker doesn't update but the device is online in Traccar, the WebSocket proxy may not be supported by Vercel for this request type. The app automatically falls back to 5-second polling — live tracking still works, just with a small delay. This is acceptable.

- [ ] **Step 4: Verify Traccar service survives a reboot**

  In the SSH terminal:
  ```bash
  sudo reboot
  ```
  Wait 1–2 minutes, then SSH back in and check:
  ```bash
  sudo systemctl status traccar
  ```
  Expected: `Active: active (running)` — confirms Traccar auto-starts on boot.

- [ ] **Step 5: Final commit confirming deployment**

  On local machine:
  ```bash
  git add -A
  git status
  ```
  Confirm only expected files are modified (vercel.json should be committed already, CLAUDE.md already committed). If any untracked files remain, commit them:
  ```bash
  git commit -m "chore: finalize self-hosting setup — Vercel + Oracle Cloud"
  ```

---

## Troubleshooting Reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl http://ORACLE_IP:8082` times out | ufw not open OR Security List missing rule | Check Task 2 and Task 4 |
| Traccar status = `failed` | Java not installed or wrong version | `java -version`, must be 17+ |
| Device never appears online | FMC920 still pointed at old server | Re-do Task 9; check Teltonika Configurator |
| Vercel app shows "Connection failed" | `vercel.json` has wrong IP | Update IP in `vercel.json`, push to GitHub |
| WebSocket not updating in real-time | Vercel WS proxy limitation | Expected fallback — 5s polling still works |
| Oracle VM unreachable after reboot | Instance stopped (OCI sometimes reclaims idle Always Free VMs) | Log into OCI Console, restart the instance |
