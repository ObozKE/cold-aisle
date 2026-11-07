# Engineering Assumptions & Design Invariants

This document records the foundational assumptions, physical sensor representations, and mathematical models for the **Data Hall Cooling & Power Telemetry Twin**.

---

## 1. Physical Sensor vs. Virtual Asset Model

1. **Wokwi Ultrasonic Distance Sensors (HC-SR04)**:
   - Real ultrasonic sensors measure distance from sensor head to liquid surface ($\text{distance\_cm}$).
   - **Reservoir Level Formula**:
     $$\text{fill\_cm} = \text{tank\_height\_cm} - \text{distance\_cm}$$
     $$\text{clamped\_fill\_cm} = \max\left(0, \min\left(\text{fill\_cm}, \text{usable\_height\_cm}\right)\right)$$
     $$\text{level\_pct} = \left(\frac{\text{clamped\_fill\_cm}}{\text{usable\_height\_cm}}\right) \times 100$$
     $$\text{current\_litres} = \left(\frac{\text{level\_pct}}{100}\right) \times \text{capacity\_litres}$$
   - Assets store geometry in PostgreSQL (`geometry_config` JSONB) with:
     - `tank_height_cm`
     - `usable_height_cm`
     - `deadzone_cm`
     - `capacity_litres`

2. **Diesel Fuel & Runtime Calculation**:
   - Generator fuel day tank is calibrated to 2,000 Litres nominal capacity.
   - Generator burn rate is modeled from IT + cooling load:
     $$\text{burn\_rate\_Lph} = \text{base\_idle\_Lph} + \left(\frac{\text{total\_load\_kW}}{\text{rated\_gen\_kW}}\right) \times (\text{full\_load\_Lph} - \text{base\_idle\_Lph})$$
   - Default nominal burn rate at standby load: $65.0 \text{ L/h}$.
   - **Runtime remaining**:
     $$\text{runtime\_hours} = \frac{\text{current\_litres}}{\text{burn\_rate\_Lph}}$$

3. **Cooling Differential ($\Delta T$)**:
   - Cold aisle represents inlet air to server racks (ASHRAE Recommended: 18–27 °C, allowable up to 32 °C).
   - Hot aisle represents exhaust air (30–45 °C).
   - $\Delta T = T_{\text{hot}} - T_{\text{cold}}$. A typical healthy CRAH containment delta is 10–14 °C. High $\Delta T$ (> 15 °C warn, > 20 °C critical) indicates air starvation, fan failure, or containment perforation.

4. **Coolant Loop Pressure**:
   - Industrial CDU (Coolant Distribution Unit) closed loop operates between 2.0 and 3.0 bar.
   - Normal nominal pressure: 2.5 bar.
   - Low pressure alert: $< 1.5 \text{ bar}$ (warn), $< 1.0 \text{ bar}$ (critical).

5. **CDU Leak Suspicion (Compound Rule)**:
   - A single pressure sensor or level sensor alone can cause false alarms during normal thermal contraction.
   - **Compound Trigger**: A leak suspicion is flagged if:
     1. Reservoir level rate of change $\frac{d(\text{level\_pct})}{dt} < -2.0\% \text{ per minute}$ (level dropping rapidly), **AND**
     2. Coolant loop pressure is dropping or below 1.8 bar.

---

## 2. Power Usage Effectiveness (PUE) Mathematical Model

PUE is an **indirect derived calculation**, never measured directly by physical probes:
$$\text{PUE} = \frac{\text{Total Facility Power (kW)}}{\text{IT Equipment Power (kW)}}$$

Where:
$$\text{Total Facility Power} = P_{\text{IT}} + P_{\text{cooling}} + P_{\text{ups\_losses}} + P_{\text{aux\_lighting}}$$

- $P_{\text{IT}}$: Sum of active rack IT loads ($0 \text{ to } 15 \text{ kW}$ per rack).
- $P_{\text{cooling}}$: Dynamic CDU pump load + CRAH fan & compressor work, modeled as:
  $$P_{\text{cooling}} = P_{\text{base\_pump}} + (0.18 \times P_{\text{IT}}) + \max(0, (T_{\text{cold}} - 22.0) \times 0.05 \times P_{\text{IT}})$$
- $P_{\text{ups\_losses}}$: Inefficiencies in double-conversion UPS (modelled as $(1 - \eta) \times P_{\text{IT}}$ with $\eta \approx 94\% \implies 0.0638 \times P_{\text{IT}}$).
- $P_{\text{aux\_lighting}}$: Constant baseline facility overhead ($5.0 \text{ kW}$ per hall).

PUE target range for a modern colocation hall: $1.25 \text{ to } 1.45$.
Alert thresholds:
- Warn: $\text{PUE} > 1.60$
- Critical: $\text{PUE} > 2.00$

---

## 3. Timezone & Time Invariants

- **Storage**: Strictly UTC ISO-8601 timestamps in PostgreSQL (`TIMESTAMPTZ`).
- **Telemetry ingestion**: Client timestamp is validated against server clock. If absent or skewed $> 5 \text{ minutes}$, server timestamp is assigned.
- **Display**: All timestamps on the NOC dashboard and alert timeline are converted to **Africa/Nairobi (EAT / UTC+3)**.

---

## 4. Multi-Tenant Device Authentication & Deduplication

- Every hardware/simulated device has an entry in `devices` with an `api_key_hash` (SHA-256).
- HTTP POST requires `X-Device-Key` header matching `api_key_hash`.
- MQTT publishes on `dcim/{site}/{hall}/{device}/telemetry`.
- Deduplication: In PostgreSQL, active alerts have a partial unique constraint:
  `CREATE UNIQUE INDEX idx_alerts_unique_open_dedupe ON alerts (dedupe_key) WHERE state != 'resolved';`
  Ensuring no spamming of identical alerts while an issue is open or acknowledged.
