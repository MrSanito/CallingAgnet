# Rentopus Stack Deployment Guide

This guide describes how to clone, configure, run, and host the **Rentopus Call Scheduler** stack (dashboard, API server, background worker, MongoDB, and Redis) on a Linux host (e.g., Ubuntu) using Docker Compose and Nginx as a reverse proxy.

---

## Prerequisites

Before starting, ensure the host machine has the following installed:
* **Git**
* **Docker** (version 20.10+)
* **Docker Compose** (V2, i.e., `docker compose` command)
* **Nginx** (acting as the reverse proxy)

---

## Step 1: Clone the Repository

Clone the project repository to your target server and navigate into the project root:

```bash
# Clone the repository
git clone https://github.com/MrSanito/CallingAgnet.git rentopus

# Navigate into the project root
cd rentopus
```

---

## Step 2: Environment Configuration

The stack requires environment configurations in two different locations: the **backend services** and the **frontend dashboard**.

### 1. Configure the Call Scheduler (Backend API & Worker)
Create a `.env` file inside the `callScheduler` folder:

```bash
cp callScheduler/.env.example callScheduler/.env
```

Open `callScheduler/.env` and configure the variables:
```env
# Google Gemini API Key for transcripts resolution & analysis
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY

# VideoSDK Auth Credentials for calls and recordings
VIDEOSDK_AUTH_TOKEN=YOUR_VIDEOSDK_JWT_TOKEN
VIDEOSDK_SIP_CALL_FROM=+918031336877
VIDEOSDK_ROUTING_RULE_ID=rr_a76lvu

# MongoDB URI (Point to the dockerized mongodb service name)
MONGODB_URI=mongodb://mongodb:27017/call_scheduler

# Redis Queue Connection URL (Point to the dockerized redis service name)
REDIS_URL=redis://redis:6379

# Server Webhook callback URL for VideoSDK recording updates
# (This must point to your public API domain URL + /api/v1/webhooks/recording)
VIDEOSDK_WEBHOOK_URL=https://api.yourdomain.com/api/v1/webhooks/recording

# Rentopus CRM Integration Credentials
RCRM_API_KEY=YOUR_RCRM_EXTERNAL_API_KEY
```

### 2. Configure the Call Scheduler Web Dashboard (Frontend)
Create a `.env.local` file inside the `call-scheduler-web` folder:

```bash
nano call-scheduler-web/.env.local
```

Add the following variables (linking it to the same MongoDB database):
```env
# MongoDB Connection URI (Points to the mongodb docker service name)
MONGODB_URI=mongodb://mongodb:27017/call_scheduler
```

---

## Step 3: Run the Stack via Docker Compose

In the root directory of the cloned repository, run the following command to build the containers and launch them in the background (detached mode):

```bash
docker compose up -d --build
```

### Verify Container Status
Check that all 5 services are up and healthy:

```bash
docker compose ps
```

You should see:
* `rentopus-redis` running on port `6379` (internal container port `6379`)
* `rentopus-mongodb` running on port `27017` (internal container port `27017`)
* `rentopus-backend` running on port `6002` (internal container port `6002`)
* `rentopus-worker` running (no exposed host ports needed)
* `rentopus-frontend` running on port `6001` (mapped to port `6001` internally)

---

## Step 4: Configure Nginx as a Reverse Proxy

Configure Nginx to route external traffic to your frontend dashboard (port `6001`) and your backend API (port `6002`).

Create a new Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/rentopus
```

Paste the configuration below, replacing `dashboard.yourdomain.com` and `api.yourdomain.com` with your domain names (or configure them on separate paths on a single domain):

```nginx
# ── 1. FRONTEND DASHBOARD REVERSE PROXY ──────────────────────────────────────
server {
    listen 80;
    server_name dashboard.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ── 2. BACKEND API REVERSE PROXY ─────────────────────────────────────────────
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:6002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration and reload Nginx:

```bash
# Link the site to sites-enabled
sudo ln -s /etc/nginx/sites-available/rentopus /etc/nginx/sites-enabled/

# Test Nginx syntax configuration
sudo nginx -t

# Reload Nginx service
sudo systemctl reload nginx
```

---

## Step 5: Secure with SSL (Let's Encrypt / Certbot)

Generate SSL certificates to enable HTTPs on your dashboard and API:

```bash
# Install Certbot and the Nginx plugin
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Obtain and install SSL certificates automatically
sudo certbot --nginx -d dashboard.yourdomain.com -d api.yourdomain.com
```

Follow the prompts. Certbot will handle verification, update your Nginx configuration to support SSL (port `443`), and auto-configure HTTP-to-HTTPS redirects.

---

## Monitoring and Logs

To inspect logs from the running docker stack, use the standard docker compose logs command:

```bash
# Monitor all services logs
docker compose logs -f

# Monitor only worker logs
docker compose logs -f call-scheduler-worker

# Monitor only API server logs
docker compose logs -f call-scheduler
```
