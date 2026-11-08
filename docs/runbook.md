# Standard Operating Procedures (SOP) & Incident Runbook
**ColdAisle DCIM Telemetry Twin — Nairobi DC1 (Sameer Africa)**

This document defines standard emergency response and remediation procedures for Network Operations Center (NOC) and Facility Operations engineers responding to automated ColdAisle telemetry alerts.

---

## Escalation Tier Matrix

| Escalation Tier | Delay | Notification Target | Expected Action |
|---|---|---|---|
| **Tier 1** | Immediate (0s) | Primary Facility On-Call Engineer (Slack / Generic Webhook / SMS) | Acknowledge alert in ColdAisle within 5 minutes. Inspect telemetry twin dashboard. |
| **Tier 2** | +5 minutes | Secondary Duty Operations Manager | Verify physical dispatch if Tier 1 has not resolved or acknowledged. |
| **Tier 3** | +15 minutes | Facilities Director & Infrastructure VP | Executive incident bridge opened; vendor emergency SLA dispatched. |

> **Note:** Acknowledging an alert in the ColdAisle UI immediately halts all pending downstream escalation timers and records the operator name and inspection note.

---

## Incident Response Procedures

### 1. `RULE_CDU_LEAK_COMPOUND` — Suspicion of Coolant Distribution Unit Loop Rupture
- **Severity**: **CRITICAL**
- **Trigger Conditions**: Secondary loop pressure falls below `1.80 bar` **AND** CDU expansion reservoir level drops faster than `2.0% / min`.
- **Engineering Context**: This compound rule detects catastrophic manifold ruptures or hose disconnects *before* the CDU reservoir drains to its empty cutoff, protecting Direct-to-Chip cold plates and server trays.
- **Immediate Action**:
  1. Click **Acknowledge** in ColdAisle Alerts page: set operator name and note `CDU leak investigation underway`.
  2. Switch to **Cooling View** (`/cooling`) to observe loop pressure decay rate and reservoir volume.
  3. Dispatch mechanical technician to Data Hall Alpha Row A / Row B with emergency containment kit.
  4. Physically inspect CDU primary supply/return isolation valves, flexible braided hoses, and quick-disconnect couplings.
  5. If visible fluid pooling or puddle sensors trip:
     - Activate emergency manual bypass on CDU-01.
     - Switch manifold feed to redundant secondary loop CDU-02.
     - Isolate compromised rack loop via 1/4-turn ball valves.
  6. Once repaired and recharged with treated demineralized water/glycol mix to `2.6 bar`, verify hysteresis clearance on ColdAisle.

---

### 2. `RULE_COLD_TEMP` — Cold-Aisle Supply Thermal Envelope Breach
- **Severity**: **WARN** (> 27.0 °C) | **CRITICAL** (> 32.0 °C)
- **Trigger Conditions**: Inlet air temperature measured by cold-aisle probe exceeds ASHRAE TC 9.9 Recommended / Allowable envelope. Debounced for `10 seconds`.
- **Engineering Context**: CRAH (Computer Room Air Handler) fan trip, chilled water control valve closure, or containment strip curtain breach.
- **Immediate Action**:
  1. Review **Hall View** (`/hall`) heatmap to identify affected rack clusters and delta-T across aisles.
  2. Inspect CRAH unit fan status, chilled water inlet temperature, and 3-way mixing valve position.
  3. Check containment doors and blanking panels in affected cold aisle: ensure doors are latched shut.
  4. If CRAH unit has tripped on electrical fault:
     - Start standby CRAH unit in hall.
     - Ramp up remaining CRAH fan speeds to 85% via BMS override.
  5. Monitor cold-aisle temperature curve until it drops below the hysteresis recovery threshold (`25.0 °C`).

---

### 3. `RULE_DELTA_T` — Rack Exhaust Temperature Differential ($\Delta T$)
- **Severity**: **WARN** (> 15.0 °C) | **CRITICAL** (> 20.0 °C)
- **Trigger Conditions**: Difference between hot-aisle exhaust and cold-aisle supply ($T_{\text{hot}} - T_{\text{cold}}$) exceeds threshold.
- **Engineering Context**: Server fan failure, airflow recirculation behind racks, or IT load hotspots.
- **Immediate Action**:
  1. Verify rack IT load in **Hall View** (`/hall`).
  2. Check for missing blanking panels allowing hot exhaust air to bypass back into the cold aisle.
  3. Inspect rear perforated rack doors for airflow obstruction (cable management clutter).
  4. Coordinate with systems engineering to migrate high-intensity compute jobs away from affected racks.

---

### 4. `RULE_DIESEL_LEVEL` & `RULE_DIESEL_RUNTIME` — Fuel Day-Tank Depletion
- **Severity**: **WARN** (< 40.0% / < 4.0 hours) | **CRITICAL** (< 20.0% / < 2.0 hours)
- **Trigger Conditions**: Day-tank fuel headspace distance increases, or estimated generator runtime at current load drops below minimum operating reserve.
- **Engineering Context**: Ongoing grid blackout requiring extended generator operation, fuel transfer pump failure from main bulk underground storage, or line leak.
- **Immediate Action**:
  1. Navigate to **Power View** (`/power`) to inspect fuel level %, volume litres, and live burn rate.
  2. Confirm standby 1,000 kVA generator status.
  3. Inspect fuel transfer pump between primary bulk tank (50,000 L) and day-tank (2,000 L):
     - Check transfer pump electrical breaker.
     - Verify day-tank float switch actuation.
  4. If transfer pump is blocked, engage manual hand pump transfer.
  5. If campus bulk fuel is below 24-hour reserve, initiate emergency fuel replenishment contract with local supplier (TotalEnergies / Rubis Kenya) with priority delivery SLA.

---

### 5. `RULE_PUE` — Facility Energy Efficiency Degradation
- **Severity**: **WARN** (> 1.60) | **CRITICAL** (> 2.00)
- **Trigger Conditions**: Modeled Power Usage Effectiveness $\frac{P_{\text{total}}}{P_{\text{IT}}}$ exceeds baseline targets.
- **Engineering Context**: Chiller compressor over-cycling, low IT load resulting in fixed overhead dominance, or inefficient cooling loop delta-T.
- **Immediate Action**:
  1. Open **Power View** (`/power`) to review 4-channel power breakdown (IT load, dynamic cooling work, UPS conversion losses, facility lighting/aux).
  2. Check ambient outside wet-bulb temperature. If ambient temperature allows, enable economizer / free cooling mode.
  3. Inspect chiller Coefficient of Performance (COP): clean condenser coils if head pressure is elevated.
  4. Review UPS modular capacity: shed redundant modules to maintain UPS loading in the high-efficiency (> 94%) sweet spot.

---

### 6. `RULE_DEVICE_STALE` — Edge Telemetry Controller Heartbeat Loss
- **Severity**: **WARN** (no packet for > 15 s) | **CRITICAL** (no packet for > 50 s)
- **Trigger Conditions**: Device watchdog timer detects missing packets exceeding $3\times$ or $10\times$ publish interval.
- **Immediate Action**:
  1. Open **Devices View** (`/devices`) to check device liveness, IP, and last seen timestamp.
  2. Ping edge controller IP on local management VLAN.
  3. Inspect edge switch port for link flap or PoE power delivery failure.
  4. If MQTT broker connection failed, verify broker service status (`docker ps` or HiveMQ cloud connectivity).
  5. Check if device has fallen back to HTTP POST ingest mode via access logs in `apps/ingest`.
