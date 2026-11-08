# Wokwi ESP32 Physical Twin Firmware

This directory contains the production-ready ESP32 firmware and Wokwi simulation configuration for the **Data Hall Cooling & Power Telemetry Twin**.

It simulates a physical facility edge controller installed in **Nairobi DC1 (Sameer Africa), Data Hall Alpha**, publishing real-time telemetry from 6 facility sensors into the ColdAisle DCIM telemetry pipeline.

---

## 1. Physical vs. Derived Sensor Model

In a production DCIM environment, edge controllers measure physical quantities (temperatures, raw loop voltages, ultrasonic headspace distances). They do **not** directly measure derived facility metrics like tank volumes, delta temperatures, or Power Usage Effectiveness (PUE).

The table below details what is physically measured in firmware vs. what is derived in the backend:

| Physical Sensor (Hardware / Wokwi) | GPIO / ADC Pin | Represents | Derived Facility Metric (Server-side) |
|---|---|---|---|
| **HC-SR04 #1** | TRIG: `18`, ECHO: `19` | In-Row CDU Cooling Reservoir Headspace | Reservoir level `%` and capacity `litres` (calculated from tank geometry) |
| **HC-SR04 #2** | TRIG: `21`, ECHO: `22` | Diesel Day-Tank Bulk Headspace | Tank level `%`, fuel volume `litres`, and remaining generator runtime `hours` |
| **DHT22 #1** | SDA: `4` | Cold-Aisle Containment Inlet | Air temperature (°C), relative humidity (%RH), ASHRAE envelope compliance |
| **DHT22 #2** | SDA: `16` | Hot-Aisle Exhaust Air | Air temperature (°C), relative humidity (%RH), $\Delta T$ ($T_{\text{hot}} - T_{\text{cold}}$) |
| **Potentiometer #1** | SIG: `34` (ADC1_CH6) | Coolant Secondary Loop Pressure | Calibrated loop pressure (0.0 to 4.0 bar) |
| **Potentiometer #2** | SIG: `35` (ADC1_CH7) | Rack IT Load | IT active power (0.0 to 15.0 kW) |

> **Note on PUE:** PUE cannot be measured by physical ambient or level probes. Server-side in `apps/ingest`, the platform dynamically derives PUE using facility thermodynamic models:
> $$\text{PUE} = \frac{P_{\text{IT}} + P_{\text{cooling}}(T_{\text{cold}}, \text{Chiller COP}) + P_{\text{ups\_loss}} + P_{\text{aux}}}{P_{\text{IT}}}$$

---

## 2. Directory Structure

```
/firmware
├── sketch.ino        # Arduino C++ ESP32 application (WiFi, SNTP, PubSubClient, ArduinoJson, HTTP fallback)
├── diagram.json      # Wokwi schematic wiring ESP32, 2x DHT22, 2x HC-SR04, 2x Potentiometers
├── libraries.txt     # Pinned library dependencies for Wokwi compiler
├── wokwi.toml        # Wokwi project metadata configuration
└── README.md         # Architecture, connectivity, and testing instructions
```

---

## 3. Telemetry Contract

Every 5 seconds, the ESP32 acquires readings from all 6 sensors, syncs UTC time via SNTP, and transmits the following JSON payload:

**Topic:** `dcim/NBO1/hall-alpha/wokwi-esp32-01/telemetry` (QoS 1)

```json
{
  "device": "wokwi-esp32-01",
  "ts": "2026-11-08T12:00:00Z",
  "readings": {
    "cold_aisle_temp_c": 22.4,
    "cold_aisle_rh": 46.0,
    "hot_aisle_temp_c": 35.1,
    "hot_aisle_rh": 28.0,
    "coolant_pressure_bar": 2.65,
    "cdu_reservoir_distance_cm": 14.2,
    "diesel_distance_cm": 31.0,
    "rack_it_kw": 7.8
  }
}
```

---

## 4. How to Run in Wokwi (Cloud Simulation)

Because Wokwi runs in a sandboxed browser environment, it **cannot** reach `localhost` directly. ColdAisle provides three connectivity options:

### Option A: Public HiveMQ Broker (Zero-Configuration, Recommended)

1. Open [Wokwi.com](https://wokwi.com/projects/new/esp32) or the Wokwi VS Code extension.
2. Copy the contents of:
   - `sketch.ino` into the Code tab.
   - `diagram.json` into the Diagram tab.
   - `libraries.txt` into the Library Manager or `libraries.txt` file.
3. In `coldaisle/.env`, configure the ingest service to subscribe to HiveMQ:
   ```bash
   MQTT_URL=mqtt://broker.hivemq.com:1883
   ```
4. Start your ColdAisle ingest backend:
   ```bash
   npm --workspace=@coldaisle/ingest run dev
   ```
5. Click **Play (Start Simulation)** in Wokwi.
   - The ESP32 connects to `Wokwi-GUEST`.
   - Syncs UTC time via SNTP.
   - Publishes directly to `broker.hivemq.com`.
   - Your local ColdAisle dashboard at `http://localhost:3000` immediately starts receiving live data from the Wokwi simulation!

### Option B: Local Mosquitto Broker via Wokwi IoT Gateway

If running Mosquitto locally (`docker-compose up -d`):
1. Install the [Wokwi IoT Gateway](https://docs.wokwi.com/guides/esp32-wifi#the-private-gateway) on your host machine.
2. In `sketch.ino`, set:
   ```cpp
   const char* MQTT_SERVER = "10.0.2.2"; // Points to host machine via Wokwi Gateway
   ```
3. Run the simulation.

### Option C: Automatic HTTP POST Failover

If MQTT connectivity is interrupted or blocked by firewall rules:
- After 3 consecutive failed MQTT publish attempts, the firmware automatically falls back to HTTP POST:
  ```http
  POST http://<ingest_host>:4000/api/v1/ingest
  Content-Type: application/json
  X-Device-Key: dcim_dev_ingest_key_9921
  ```
- All requests are verified using timing-safe SHA-256 key hashing on the server.

---

## 5. Interactive Fault Injection from Wokwi

You can test ColdAisle's rule and alert engine directly by interacting with the simulation controls in Wokwi:

1. **Simulate a Cooling Loop Pressure Drop:**
   - Turn **Potentiometer #1** down below 37% (reading drops under `1.50 bar`).
   - Observe the ColdAisle dashboard trigger a `WARN: Coolant Loop Pressure Low`.
   - Turn it below 25% (`< 1.00 bar`) to trigger `CRITICAL: Coolant Loop Pressure Emergency`.

2. **Simulate Cold-Aisle Thermal Spike:**
   - Click **DHT22 #1** and slide the temperature slider to `28°C` (triggers `WARN: Cold Aisle Inlet Temperature High`).
   - Slide past `32°C` to trigger `CRITICAL: Cold Aisle Supply Thermal Breach` (violates ASHRAE recommended envelope).

3. **Simulate Compound CDU Leak:**
   - In Wokwi, increase the distance on **HC-SR04 #1** (simulating falling coolant level) while lowering **Potentiometer #1** (dropping pressure).
   - The ColdAisle compound rule engine will immediately trigger a `CRITICAL: Suspicion of Coolant Distribution Unit (CDU) Loop Rupture` *before* the tank reaches its absolute low-level cutoff.
