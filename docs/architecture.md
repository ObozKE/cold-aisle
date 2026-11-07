# ColdAisle DCIM Telemetry Twin - Architecture Reference

## 1. System Overview

**ColdAisle** is an industrial-grade Data Center Infrastructure Management (DCIM) telemetry and digital twin platform. It captures physical-layer telemetry across cooling loops, rack electrical loads, environmental conditions, and standby fuel reserves, computing derived metrics (PUE, runtime, compound leak probabilities) and orchestrating HMAC-signed NOC escalations.

```
+-----------------------------------------------------------------------------------------+
|                                    PHYSICAL TWIN                                        |
|  [Wokwi ESP32 Cloud Sim]                     [Local Scenario Sim (/sim)]                |
|  - 2x HC-SR04 Ultrasonic (CDU & Fuel)        - Scenario Profiles (Thermal, Leak, Power) |
|  - 2x DHT22 Temp/Humidity (Cold/Hot Aisle)   - CLI Fault Injection                      |
|  - 2x Potentiometers (Pressure & IT Load)    - High-frequency Telemetry Generator      |
+-----------------------------------------------------------------------------------------+
                                 │ MQTT (QoS 1)               │ MQTT (QoS 1)
                                 ▼                            ▼
                 +────────────────────────────────────────────────────────+
                 |            Mosquitto MQTT Broker (Port 1883)           |
                 |       Topic: dcim/{site}/{hall}/{device}/telemetry     |
                 +────────────────────────────────────────────────────────+
                                              │
                 +────────────────────────────┴───────────────────────────+
                 | HTTP Failover: POST /api/v1/ingest (Header: X-Device-Key)
                 ▼
+-----------------------------------------------------------------------------------------+
|                       INGESTION SERVICE & RULE ENGINE (/apps/ingest)                   |
|                                                                                         |
|  1. Ingestion & Validation:                                                             |
|     - Zod schema validation (numeric ranges, finiteness, timestamp skew <= 5m)         |
|     - Device authentication against SHA-256 API key hash                                |
|                                                                                         |
|  2. Physics & Power Derivation:                                                         |
|     - Tank geometric level & volume conversion (fill_cm, usable %, current litres)      |
|     - Thermal differential: Delta-T = Hot Aisle - Cold Aisle                            |
|     - Diesel runtime remaining = current_litres / burn_rate_Lph                         |
|     - Instantaneous & time-bucketed PUE = (IT + Cooling + UPS Losses + Aux) / IT        |
|                                                                                         |
|  3. Alert State Machine & Compound Rules:                                               |
|     - Debounce & hysteresis filter (prevent flapping)                                   |
|     - Compound CDU Leak Rule: (-d(level)/dt > 2%/min) AND (pressure < 1.8 bar)          |
|     - Device stale detector (warn at 3x interval, crit at 10x interval)                 |
|     - Deduplication: Partial unique index on active dedupe_key                          |
|                                                                                         |
|  4. Escalation Engine:                                                                  |
|     - 3-Tier Escalation Policy (Tier 1: 0s, Tier 2: 5m, Tier 3: 15m)                   |
|     - HMAC SHA-256 Signature generation (X-Signature & X-Timestamp headers)             |
|     - Exponential backoff retry (up to 5 attempts)                                      |
|     - Delivery audit logging in PostgreSQL                                              |
|                                                                                         |
|  5. Realtime Streaming:                                                                 |
|     - Server-Sent Events (SSE) broadcaster (/api/v1/stream/telemetry, /alerts)          |
+-----------------------------------------------------------------------------------------+
                 │                                                │
                 ▼                                                ▼
+───────────────────────────────────+             +───────────────────────────────────────+
|     PostgreSQL 16 Storage         |             | Next.js 14+ NOC Dashboard (/apps/web) |
|  - sites, halls, racks, assets    |             | - High-contrast Dark NOC UI           |
|  - devices, sensors, readings     |             | - Live PUE Gauge & 1h Trend           |
|  - pue_samples                    |             | - Rack Thermal Heatmap & Airflow      |
|  - alert_rules, alerts            |             | - CDU Reservoir & Loop Pressure KPIs  |
|  - escalation_policies, deliveries|             | - Diesel Autonomy & Genset State      |
+───────────────────────────────────+             | - Interactive Scenario Fault Buttons  |
                                                  | - In-App Mock On-Call Receiver (/api) |
                                                  +───────────────────────────────────────+
```

---

## 2. PostgreSQL Relational Model

| Entity Table | Purpose & Key Invariants |
|---|---|
| `sites` | Physical DC campuses (e.g. Nairobi DC1, Enterprise Park). |
| `halls` | Data halls within a site (`hall-alpha`, `hall-beta`). |
| `racks` | Standard 42U/48U racks with rated kW capacity (e.g. 15 kW). |
| `assets` | Plant equipment: CDUs, Diesel Tanks, Gensets, and UPS units with `geometry_config` JSONB. |
| `devices` | Microcontrollers & gateways with hashed API keys, liveness status, and heartbeat. |
| `sensors` | Sensor channel catalog linked to device IDs and asset/rack references. |
| `readings` | Indexed time-series telemetry store `(sensor_id, ts DESC)`. |
| `pue_samples`| Time-bucketed power allocation samples and computed PUE values. |
| `alert_rules` | Configurable thresholds, hysteresis bands, debounce duration, and compound flags. |
| `alerts` | State machine entries (`firing` -> `acknowledged` -> `resolved`) with dedupe index. |
| `escalation_policies` | Multi-tier delay configurations and assigned webhook targets. |
| `webhook_endpoints` | Destination endpoints (NOC webhook, Slack webhook, SMS gateway) with shared secrets. |
| `webhook_deliveries` | Audit log recording HTTP status, response latency, payload, and retry attempts. |

---

## 3. Telemetry Payload Contract

Ingested via MQTT (`dcim/{site}/{hall}/{device}/telemetry`) or `POST /api/v1/ingest`:

```json
{
  "device": "wokwi-esp32-01",
  "ts": "2026-11-07T20:15:00Z",
  "readings": {
    "cold_aisle_temp_c": 22.4,
    "cold_aisle_rh": 46.0,
    "hot_aisle_temp_c": 35.1,
    "hot_aisle_rh": 28.0,
    "coolant_pressure_bar": 2.6,
    "cdu_reservoir_distance_cm": 14.2,
    "diesel_distance_cm": 31.0,
    "rack_it_kw": 7.8
  }
}
```

---

## 4. Webhook Security Specification

Every webhook outbound dispatch includes:
- `Content-Type: application/json`
- `X-Timestamp: <ISO-8601 UTC timestamp>`
- `X-Signature: sha256=<hex_hmac>`

Verification:
```typescript
const computed = crypto
  .createHmac('sha256', endpointSecret)
  .update(`${timestamp}.${JSON.stringify(payload)}`)
  .digest('hex');
const isValid = crypto.timingSafeEqual(
  Buffer.from(signatureHeader.replace('sha256=', '')),
  Buffer.from(computed)
);
```
