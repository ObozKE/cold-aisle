# Production & Free-Tier Cloud Deployment Guide
**ColdAisle DCIM Telemetry Twin**

This guide provides instructions for deploying ColdAisle to production using 100% free-tier, developer-friendly cloud services.

```
                    ┌─────────────────────────┐
                    │    Vercel / Netlify     │
                    │   apps/web (Next.js)    │
                    └────────────┬────────────┘
                                 │ HTTPS / SSE
                                 ▼
                    ┌─────────────────────────┐
                    │     Render / Railway    │
                    │   apps/ingest (Node.js) │
                    └──────┬────────────┬─────┘
       MQTT (TLS 8883)     │            │ PostgreSQL (5432)
   ┌───────────────────────┘            └─────────────────────────┐
   ▼                                                              ▼
┌─────────────────────────┐                      ┌─────────────────────────┐
│   HiveMQ Cloud (Free)   │                      │  Neon / Supabase Cloud  │
│       MQTT Broker       │                      │      PostgreSQL 16      │
└──────────▲──────────────┘                      └─────────────────────────┘
           │ MQTT / WSS
┌──────────┴──────────────┐
│  Wokwi Cloud Simulation │
│      (ESP32 Twin)       │
└─────────────────────────┘
```

---

## 1. Managed PostgreSQL Database (Neon or Supabase)

### Option A: Neon.tech (Recommended)
1. Sign up at [Neon.tech](https://neon.tech) and create a free project called `coldaisle-db` (Postgres 16).
2. Copy your connection string:
   ```
   postgres://[user]:[password]@[host]/[dbname]?sslmode=require
   ```
3. Run the ColdAisle database migrations and seed against your Neon database:
   ```bash
   DATABASE_URL="postgres://[user]:[password]@[host]/[dbname]?sslmode=require" npm run db:migrate
   DATABASE_URL="postgres://[user]:[password]@[host]/[dbname]?sslmode=require" npm run db:seed
   ```
   *All 10 tables, indexes, alert rules, and Nairobi DC1 assets will be seeded instantly.*

---

## 2. Cloud MQTT Broker (HiveMQ Cloud Free Tier)

1. Sign up at [HiveMQ Cloud](https://www.hivemq.com/pricing/) (Free tier gives 100 client connections and 10 GB/month).
2. Create an MQTT cluster and an access credential (username and password).
3. Note your cluster URL:
   ```
   mqtts://[cluster-id].hivemq.cloud:8883
   ```
4. *Alternative for zero-signup testing:* You can use the public test broker `mqtt://broker.hivemq.com:1883`.

---

## 3. Backend Ingest & Rule Engine (Render or Railway)

### Deploying to Render.com
1. Create a **New Web Service** pointing to your Git repository.
2. Set configuration:
   - **Root Directory**: `apps/ingest`
   - **Environment**: Node.js
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Port**: `4000` (or leave default `$PORT`)
3. Set Environment Variables:
   ```env
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=postgres://[user]:[password]@[host]/[dbname]?sslmode=require
   MQTT_URL=mqtts://[cluster-id].hivemq.cloud:8883
   MQTT_USERNAME=your_username
   MQTT_PASSWORD=your_password
   ENABLE_AFRICASTALKING_SMS=false
   ```
4. Deploy and copy your backend URL: e.g. `https://coldaisle-ingest.onrender.com`.

---

## 4. Frontend DCIM Dashboard (Vercel)

1. Sign up at [Vercel.com](https://vercel.com) and import your Git repository.
2. In Project Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
3. Set Environment Variables:
   ```env
   NEXT_PUBLIC_INGEST_URL=https://coldaisle-ingest.onrender.com
   ```
4. Click **Deploy**. Vercel will build all static pages and edge routes.
5. Access your live NOC dashboard at `https://coldaisle-web.vercel.app`.

---

## 5. Connecting Wokwi ESP32 to Deployed Cloud Stack

1. Open your Wokwi project (`sketch.ino`).
2. Update the network configuration:
   ```cpp
   const char* MQTT_SERVER = "broker.hivemq.com"; // Or HiveMQ cloud host
   const char* HTTP_INGEST_URL = "https://coldaisle-ingest.onrender.com/api/v1/ingest";
   ```
3. Click **Play** in Wokwi.
4. Your deployed Vercel dashboard will immediately reflect real-time live telemetry, heatmaps, and alerts!
