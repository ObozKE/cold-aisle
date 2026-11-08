# 3-Minute Executive Demo Script: ColdAisle Telemetry Twin
**Target Audience:** Infrastructure Directors & Hiring Managers at Kenyan Data Center & Telecom Operators  
*(e.g., IXAfrica Data Centres, Huawei Digital Power Kenya, Camusat East Africa, Adrian Kenya)*

---

## Executive Pitch (30 Seconds)

> *"In mission-critical Kenyan facility operations—whether at a Tier III colocation hub like IXAfrica in Nairobi or distributed telecom power sites along the Lamu Corridor—real-time awareness of thermal containment and power efficiency makes the difference between 99.999% uptime and catastrophic thermal throttles.*
> 
> *I built **ColdAisle**: a portfolio-grade DCIM digital twin and telemetry platform. It ingests physical sensor streams from ESP32 edge controllers over MQTT and HTTP, computes dynamic PUE and fluid dynamics server-side, runs a debounced compound alert engine with hysteresis, and executes HMAC-signed 3-tier escalation chains with zero data loss."*

---

## Live Walkthrough Timeline (2.5 Minutes)

### Minute 0:00 – 0:45 | NOC Overview & Physics-Based Digital Twin
1. **Show `/` (Overview)**:
   - Point out the **Live PUE Gauge (1.41)** and 1-hour rolling trendline.
   - *Talking point:* Explain that PUE is *modeled*, not measured. Ambient probes cannot measure PUE. ColdAisle models total facility load $\frac{P_{\text{IT}} + P_{\text{cooling}} + P_{\text{losses}}}{P_{\text{IT}}}$, where cooling work is dynamically coupled to cold-aisle inlet temperature and chiller COP.
   - Point out the **Local Clock** running in `Africa/Nairobi (EAT)` while the Postgres database stores pure UTC.
   - Show the **Device Health Strip**: `wokwi-esp32-01` and `sim-node-01` streaming at sub-second latency via Server-Sent Events (SSE).

2. **Show `/hall` (Hall View Heatmap)**:
   - Display the 12-rack containment grid in Nairobi DC1, Data Hall Alpha.
   - Point out color gradients mapped to inlet temperatures ($< 22^\circ\text{C}$ green, $27^\circ\text{C}$ amber, $> 32^\circ\text{C}$ red) and rack-by-rack IT load.

---

### Minute 0:45 – 1:30 | Fault Injection: Compound CDU Leak Detection
1. **Navigate to `/scenario` (Scenario Control)**:
   - Click **`INJECT [CDU_LEAK]`**.
   - *Talking point:* In liquid cooling, simple threshold alerts fail. A slow reservoir drop or normal pressure variation won't trigger standard alarms until it's too late.
2. **Switch to `/cooling` (Cooling View)**:
   - Watch the animated **CDU Expansion Reservoir** level dropping rapidly ($> 2.0\%/\text{min}$) and the secondary loop pressure collapsing below $1.80\text{ bar}$.
   - Show the **Compound Leak Indicator** change from green to flashing red:  
     `ALERT: Secondary Coolant Loop Rupture Suspected`.
   - *Technical highlight:* The compound rule engine detected the leak **30 seconds before** the reservoir reached its critical low-level cutoff, protecting the server cold plates from thermal dry-out.

---

### Minute 1:30 – 2:15 | Alert State Machine & Escalation Engine
1. **Navigate to `/alerts` (Alerts Feed)**:
   - Observe the firing alert: `CRITICAL: Suspicion of Coolant Distribution Unit (CDU) Loop Rupture`.
   - Point out that duplicate telemetry packets do not spam new alerts—the partial unique index on `(dedupe_key, state)` prevents deduplication while open.
   - Click **Webhooks**: View the delivery audit log with status `200 OK`, latency in milliseconds, and the payload signed with `X-Signature: sha256=<HMAC>`.
2. **Execute Operator Acknowledgment**:
   - Click **Ack**: Enter Operator Name (*"Kiprono - Senior Facilities Eng"*) and Note (*"Dispatched field tech to Hall Alpha Row A manifold"*).
   - *Talking point:* Notice how acknowledging the alert immediately freezes Tier 2 and Tier 3 escalation timers so executive management is not unnecessarily paged.

---

### Minute 2:15 – 3:00 | Power Outage & Asymptotic Recovery
1. **Navigate to `/scenario` and Click `INJECT [POWER_CUT]`**:
   - Switch to **`/power` (Power & PUE Breakdown)**.
   - Watch the standby 1,000 kVA diesel generator kick in, fuel level begin to burn down, and live runtime calculation update dynamically based on load.
   - Point out the 4-channel power breakdown bar: IT Load, Dynamic Chiller Work, UPS Losses ($\eta = 94\%$), and Auxiliary.
2. **Click `INJECT [RECOVERY]`**:
   - Observe all temperatures and pressures smoothly return to baseline.
   - Return to **`/alerts`**: Show that alerts automatically transition from `firing` to `resolved` once values clear the deadband hysteresis threshold, preventing alert flap.

---

## Key Talking Points for Technical Interviews

1. **Physical vs. Derived Boundary:**
   - Edge devices measure raw voltages, resistances, and headspace distances.
   - Ingest service derives physical liters, percentages, $\Delta T$, and PUE using PostgreSQL asset geometry.
2. **HMAC-SHA256 Webhook Security:**
   - Every outbound escalation webhook is signed with an HMAC digest and timestamp header, preventing replay attacks and payload tampering.
3. **Resilience & Failover:**
   - ESP32 firmware features automatic exponential backoff and dual-transport failover (MQTT QoS 1 $\rightarrow$ HTTP POST with API key hashing).
4. **NOC Aesthetics & Architecture:**
   - Dark-theme design system with tabular numerals, zero layout shift, real-time SSE streaming, and sub-10ms response times.
