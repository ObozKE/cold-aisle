# Power Usage Effectiveness (PUE) & Facility Power Model

## 1. Overview & Industry Context

Power Usage Effectiveness (PUE) is the standard metric defined by The Green Grid and ISO/IEC 30134-2 for measuring data center energy efficiency:

$$\text{PUE} = \frac{\text{Total Facility Energy / Power}}{\text{IT Equipment Energy / Power}}$$

In our telemetry twin, ambient temperature, humidity, and level sensors cannot measure power directly. PUE is computed via an explicit facility thermal and electrical simulation model fed by rack-level IT load readings and hall environmental conditions.

---

## 2. Power Balance Equations

Total facility instantaneous power is decomposed into four discrete channels:

$$P_{\text{total}} = P_{\text{IT}} + P_{\text{cooling}} + P_{\text{ups\_loss}} + P_{\text{aux}}$$

### 2.1 IT Equipment Power ($P_{\text{IT}}$)
- Measured continuously from rack load transducers (simulated via 0–15 kW potentiometer in hardware, and scenario profile in software).
- For a hall with $N$ racks:
  $$P_{\text{IT}} = \sum_{i=1}^{N} P_{\text{rack}, i}$$

### 2.2 Dynamic Cooling Power ($P_{\text{cooling}}$)
Cooling power consists of fixed CDU recirculation pump energy plus dynamic chiller/CRAH work, which rises with IT heat rejection and thermal stress:

$$P_{\text{cooling}} = P_{\text{pump\_base}} + \left(\text{COP}_{\text{base}}^{-1} \times P_{\text{IT}}\right) + P_{\text{thermal\_penalty}}$$

Where:
- $P_{\text{pump\_base}} = 2.5 \text{ kW}$ (continuous CDU primary loop circulation).
- $\text{COP}_{\text{base}} = 5.2$ (Coefficient of Performance under nominal $22^\circ\text{C}$ cold aisle $\implies \approx 0.192 \times P_{\text{IT}}$).
- $P_{\text{thermal\_penalty}}$ accounts for CRAH fan and compressor escalation when the cold aisle deviates above the ASHRAE envelope ($> 22^\circ\text{C}$):
  $$P_{\text{thermal\_penalty}} = \max\left(0, (T_{\text{cold}} - 22.0) \times 0.04 \times P_{\text{IT}}\right)$$

### 2.3 UPS & Power Distribution Losses ($P_{\text{ups\_loss}}$)
Double-conversion online UPS systems operate with an efficiency curve $\eta(L)$ where $L$ is load ratio:
$$P_{\text{ups\_loss}} = P_{\text{IT}} \times \left(\frac{1 - \eta}{\eta}\right)$$
Assuming high-efficiency modern modular UPS ($\eta = 94.0\%$ at typical loads):
$$P_{\text{ups\_loss}} \approx 0.0638 \times P_{\text{IT}}$$

### 2.4 Auxiliary & Lighting Overhead ($P_{\text{aux}}$)
- Security, fire suppression systems, access control, monitoring nodes, and NOC facility lighting:
  $$P_{\text{aux}} = 4.5 \text{ kW (constant per active hall)}$$

---

## 3. PUE Calculation & Bounds

$$\text{PUE} = \frac{P_{\text{IT}} + P_{\text{cooling}} + P_{\text{ups\_loss}} + P_{\text{aux}}}{P_{\text{IT}}}$$

### Nominal Characteristics:
- At nominal IT load ($6 \times 7.5 \text{ kW} = 45 \text{ kW}$) and nominal temperature ($22^\circ\text{C}$):
  - $P_{\text{IT}} = 45.0 \text{ kW}$
  - $P_{\text{cooling}} = 2.5 + (0.192 \times 45.0) + 0 = 11.14 \text{ kW}$
  - $P_{\text{ups\_loss}} = 0.0638 \times 45.0 = 2.87 \text{ kW}$
  - $P_{\text{aux}} = 4.50 \text{ kW}$
  - $P_{\text{total}} = 63.51 \text{ kW}$
  - **Nominal PUE** $\approx \frac{63.51}{45.0} = 1.41$ (consistent with modern Tier III facilities in Nairobi).

### Thresholds:
- **Normal**: $\text{PUE} \le 1.60$
- **Warning**: $\text{PUE} > 1.60$ (indicating cooling inefficiency or partial rack load)
- **Critical**: $\text{PUE} > 2.00$ (severe chiller failure or extreme thermal throttling)

Each sample is recorded into `pue_samples` table with breakdown: `(ts, it_kw, cooling_kw, ups_loss_kw, other_kw, total_kw, pue)`.
