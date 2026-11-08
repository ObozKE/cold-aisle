/**
 * =============================================================================
 * Data Hall Cooling & Power Telemetry Twin - ESP32 Physical Twin Firmware
 * Target: Wokwi Cloud Simulation / Real ESP32 DevKit V1/V4
 * =============================================================================
 *
 * PHYSICAL SENSOR MODEL vs FACILITY DERIVED METRICS:
 * -----------------------------------------------------------------------------
 * Physical Sensor (Wokwi / Hardware) | Represents               | Derived Metric (Ingest / Twin)
 * -----------------------------------|--------------------------|--------------------------------
 * HC-SR04 #1 (Trig 18, Echo 19)      | Cooling reservoir (CDU)  | Level % & litres from distance
 * HC-SR04 #2 (Trig 21, Echo 22)      | Diesel day-tank level    | Level %, litres & fuel runtime
 * DHT22 #1   (Pin 4)                 | Cold-aisle containment   | °C, %RH
 * DHT22 #2   (Pin 16)                | Hot-aisle exhaust        | °C, %RH, delta-T vs cold aisle
 * Potentiometer #1 (Pin 34, ADC1_CH6)| Coolant loop pressure    | 0.0 to 4.0 bar
 * Potentiometer #2 (Pin 35, ADC1_CH7)| Rack IT load             | 0.0 to 15.0 kW
 * -----------------------------------------------------------------------------
 * NOTE ON PUE: Ambient and level sensors cannot measure PUE.
 * PUE is derived server-side in apps/ingest using facility power models:
 *   PUE = Total Facility Power / IT Load
 *   Total = IT_kW + Cooling_kW (dynamic chiller work) + UPS_loss + Aux.
 *
 * BROKER CONNECTIVITY:
 * - Wokwi Cloud runs inside an isolated browser sandbox and CANNOT reach 'localhost'.
 * - Default broker: 'broker.hivemq.com' (Port 1883, public test broker).
 * - For local ingest testing with Wokwi:
 *     Set MQTT_URL=mqtt://broker.hivemq.com:1883 in apps/ingest/.env
 * - HTTP Fallback:
 *     If MQTT fails, sends HTTP POST to HTTP_INGEST_URL with header X-Device-Key.
 * =============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <time.h>

// -----------------------------------------------------------------------------
// Pin Configuration
// -----------------------------------------------------------------------------
#define PIN_DHT_COLD        4    // DHT22 #1: Cold Aisle Temp & Humidity
#define PIN_DHT_HOT         16   // DHT22 #2: Hot Aisle Temp & Humidity

#define PIN_SONAR_CDU_TRIG  18   // HC-SR04 #1: CDU Reservoir Headspace
#define PIN_SONAR_CDU_ECHO  19

#define PIN_SONAR_DSL_TRIG  21   // HC-SR04 #2: Diesel Day-Tank Headspace
#define PIN_SONAR_DSL_ECHO  22

#define PIN_POT_PRESSURE    34   // Pot #1: Coolant Pressure (ADC1_CH6)
#define PIN_POT_IT_LOAD     35   // Pot #2: Rack IT Load (ADC1_CH7)

// -----------------------------------------------------------------------------
// DHT Sensor Instances
// -----------------------------------------------------------------------------
#define DHTTYPE DHT22
DHT dhtCold(PIN_DHT_COLD, DHTTYPE);
DHT dhtHot(PIN_DHT_HOT, DHTTYPE);

// -----------------------------------------------------------------------------
// Network & Identity Configuration
// -----------------------------------------------------------------------------
// Wokwi virtual WiFi access point
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASS     = "";

// Device credentials matching db/seed/001_seed_nairobi_dc1.sql
const char* DEVICE_ID     = "wokwi-esp32-01";
const char* DEVICE_KEY    = "dcim_dev_ingest_key_9921";
const char* SITE_CODE     = "NBO1";
const char* HALL_CODE     = "hall-alpha";

// MQTT Configuration
// Public cloud broker reachable from Wokwi browser sandbox:
const char* MQTT_SERVER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
// Telemetry Topic: dcim/{site}/{hall}/{device}/telemetry
const char* MQTT_TOPIC    = "dcim/NBO1/hall-alpha/wokwi-esp32-01/telemetry";

// HTTP Fallback Ingest URL (Used if MQTT fails or for cloud deploy)
// For local testing via tunnel or deployed host, replace with accessible URL:
const char* HTTP_INGEST_URL = "http://localhost:4000/api/v1/ingest";

// Publish Cadence: 5000 ms (5 seconds)
const unsigned long PUBLISH_INTERVAL_MS = 5000;

// -----------------------------------------------------------------------------
// Network Clients
// -----------------------------------------------------------------------------
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// Timing state
unsigned long lastPublishTime = 0;
unsigned long lastMqttRetryTime = 0;
int mqttRetryBackoffSec = 2; // Initial backoff: 2s, 4s, 8s, up to 32s
const int MAX_MQTT_FAILURES_BEFORE_HTTP = 3;
int consecutiveMqttFailures = 0;

// -----------------------------------------------------------------------------
// NTP UTC Time Helper
// -----------------------------------------------------------------------------
void initNtpTime() {
  Serial.println("[NTP] Initializing SNTP client (UTC)...");
  // Set daylight offset to 0 and timezone offset to 0 for pure UTC
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

String getIsoTimestampUtc() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 1000)) {
    // If NTP not yet synced, return empty string so ingest uses server time
    return "";
  }
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// -----------------------------------------------------------------------------
// Distance Sensor Helper (HC-SR04)
// -----------------------------------------------------------------------------
float readSonarDistanceCm(int trigPin, int echoPin, float minCm, float maxCm, float fallbackDefault) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // 35ms timeout corresponds to ~6 meters max pulse
  long durationMicros = pulseIn(echoPin, HIGH, 35000);

  if (durationMicros <= 0) {
    return fallbackDefault;
  }

  // Speed of sound: 343 m/s = 0.0343 cm/microsecond. Divide by 2 for round-trip.
  float distanceCm = (durationMicros * 0.0343) / 2.0;

  if (distanceCm < minCm || distanceCm > maxCm) {
    return fallbackDefault;
  }

  return distanceCm;
}

// -----------------------------------------------------------------------------
// Wi-Fi Connection
// -----------------------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to SSID '%s'...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully.");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
    initNtpTime();
  } else {
    Serial.println("\n[WIFI] Connection failed. Will retry in next loop.");
  }
}

// -----------------------------------------------------------------------------
// MQTT Reconnection with Exponential Backoff
// -----------------------------------------------------------------------------
bool checkMqttConnection() {
  if (mqttClient.connected()) {
    consecutiveMqttFailures = 0;
    mqttRetryBackoffSec = 2;
    return true;
  }

  unsigned long now = millis();
  if (now - lastMqttRetryTime < (unsigned long)(mqttRetryBackoffSec * 1000)) {
    return false; // Still within backoff window
  }

  lastMqttRetryTime = now;
  Serial.printf("[MQTT] Attempting connection to broker %s:%d...\n", MQTT_SERVER, MQTT_PORT);

  // Client ID with random suffix to avoid collision on public broker
  String clientId = String(DEVICE_ID) + "-" + String(random(1000, 9999), HEX);

  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("[MQTT] Connected to broker.");
    consecutiveMqttFailures = 0;
    mqttRetryBackoffSec = 2;
    return true;
  } else {
    consecutiveMqttFailures++;
    Serial.printf("[MQTT] Connection failed (rc=%d). Consecutive failures: %d\n",
                  mqttClient.state(), consecutiveMqttFailures);

    // Exponential backoff up to 32 seconds
    mqttRetryBackoffSec = min(mqttRetryBackoffSec * 2, 32);
    return false;
  }
}

// -----------------------------------------------------------------------------
// HTTP POST Fallback Ingest
// -----------------------------------------------------------------------------
bool sendHttpFallback(const String& payloadJson) {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.printf("[HTTP-FALLBACK] Sending POST to %s\n", HTTP_INGEST_URL);
  HTTPClient http;
  http.begin(wifiClient, HTTP_INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.POST(payloadJson);
  bool success = false;

  if (httpCode > 0) {
    Serial.printf("[HTTP-FALLBACK] Response code: %d\n", httpCode);
    if (httpCode >= 200 && httpCode < 300) {
      success = true;
    } else {
      String resp = http.getString();
      Serial.printf("[HTTP-FALLBACK] Error body: %s\n", resp.c_str());
    }
  } else {
    Serial.printf("[HTTP-FALLBACK] POST failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return success;
}

// -----------------------------------------------------------------------------
// Sensor Acquisition & Payload Packaging
// -----------------------------------------------------------------------------
String buildTelemetryJson() {
  // 1. Read DHT22 #1: Cold-aisle inlet conditions
  float coldTemp = dhtCold.readTemperature();
  float coldRh   = dhtCold.readHumidity();
  if (isnan(coldTemp) || coldTemp < 0.0 || coldTemp > 60.0) coldTemp = 22.4;
  if (isnan(coldRh)   || coldRh < 0.0   || coldRh > 100.0)  coldRh   = 46.0;

  // 2. Read DHT22 #2: Hot-aisle exhaust conditions
  float hotTemp  = dhtHot.readTemperature();
  float hotRh    = dhtHot.readHumidity();
  if (isnan(hotTemp)  || hotTemp < 0.0  || hotTemp > 80.0)  hotTemp  = 35.1;
  if (isnan(hotRh)    || hotRh < 0.0    || hotRh > 100.0)   hotRh    = 28.0;

  // 3. Read Potentiometer #1: Coolant Loop Pressure (0 to 4.0 bar)
  // ESP32 ADC: 12-bit (0 - 4095)
  int rawPressureAdc = analogRead(PIN_POT_PRESSURE);
  float coolantPressureBar = (rawPressureAdc / 4095.0f) * 4.0f;
  if (coolantPressureBar < 0.0) coolantPressureBar = 0.0;
  if (coolantPressureBar > 4.0) coolantPressureBar = 4.0;

  // 4. Read Potentiometer #2: Rack IT Power (0 to 15.0 kW)
  int rawItLoadAdc = analogRead(PIN_POT_IT_LOAD);
  float rackItKw = (rawItLoadAdc / 4095.0f) * 15.0f;
  if (rackItKw < 0.0) rackItKw = 0.0;
  if (rackItKw > 15.0) rackItKw = 15.0;

  // 5. Read HC-SR04 #1: CDU Cooling Reservoir Distance (5 to 40 cm range, nominal ~14.2cm)
  float cduDistanceCm = readSonarDistanceCm(PIN_SONAR_CDU_TRIG, PIN_SONAR_CDU_ECHO, 2.0, 50.0, 14.2);

  // 6. Read HC-SR04 #2: Diesel Bulk Day-Tank Distance (15 to 150 cm range, nominal ~31.0cm)
  float dieselDistanceCm = readSonarDistanceCm(PIN_SONAR_DSL_TRIG, PIN_SONAR_DSL_ECHO, 5.0, 200.0, 31.0);

  // 7. Assemble Telemetry Contract JSON with ArduinoJson
  // Capacity: 512 bytes is ample for this schema
  StaticJsonDocument<512> doc;

  doc["device"] = DEVICE_ID;

  String utcTs = getIsoTimestampUtc();
  if (utcTs.length() > 0) {
    doc["ts"] = utcTs;
  }

  JsonObject readings = doc.createNestedObject("readings");
  readings["cold_aisle_temp_c"]         = roundf(coldTemp * 10.0f) / 10.0f;
  readings["cold_aisle_rh"]             = roundf(coldRh * 10.0f) / 10.0f;
  readings["hot_aisle_temp_c"]          = roundf(hotTemp * 10.0f) / 10.0f;
  readings["hot_aisle_rh"]              = roundf(hotRh * 10.0f) / 10.0f;
  readings["coolant_pressure_bar"]      = roundf(coolantPressureBar * 100.0f) / 100.0f;
  readings["cdu_reservoir_distance_cm"] = roundf(cduDistanceCm * 10.0f) / 10.0f;
  readings["diesel_distance_cm"]        = roundf(dieselDistanceCm * 10.0f) / 10.0f;
  readings["rack_it_kw"]                = roundf(rackItKw * 10.0f) / 10.0f;

  String output;
  serializeJson(doc, output);
  return output;
}

// -----------------------------------------------------------------------------
// Arduino Setup
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  DATA HALL COOLING & POWER TELEMETRY TWIN - ESP32     ");
  Serial.println("  Site: Nairobi DC1 (NBO1) | Hall: Alpha | DevKit V4    ");
  Serial.println("=======================================================");

  // Initialize Pin Modes
  pinMode(PIN_SONAR_CDU_TRIG, OUTPUT);
  pinMode(PIN_SONAR_CDU_ECHO, INPUT);
  digitalWrite(PIN_SONAR_CDU_TRIG, LOW);

  pinMode(PIN_SONAR_DSL_TRIG, OUTPUT);
  pinMode(PIN_SONAR_DSL_ECHO, INPUT);
  digitalWrite(PIN_SONAR_DSL_TRIG, LOW);

  // ADC resolution to 12 bits (0-4095)
  analogReadResolution(12);

  // Initialize DHT sensors
  dhtCold.begin();
  dhtHot.begin();

  // Connect to WiFi
  connectWiFi();

  // Setup MQTT client buffer (essential: default 256 is too small for telemetry JSON)
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);

  Serial.println("[SETUP] Sensor hardware & network stack initialized.\n");
}

// -----------------------------------------------------------------------------
// Arduino Main Loop
// -----------------------------------------------------------------------------
void loop() {
  // Maintain WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Handle MQTT client events
  if (mqttClient.connected()) {
    mqttClient.loop();
  }

  unsigned long currentMillis = millis();

  // Cadence: Publish every 5000 ms
  if (currentMillis - lastPublishTime >= PUBLISH_INTERVAL_MS) {
    lastPublishTime = currentMillis;

    // Acquire readings and build JSON payload
    String payload = buildTelemetryJson();
    Serial.printf("[TELEMETRY] Payload: %s\n", payload.c_str());

    bool published = false;

    // Primary Transport: MQTT
    if (checkMqttConnection()) {
      if (mqttClient.publish(MQTT_TOPIC, payload.c_str(), false)) {
        Serial.printf("[MQTT] Sent to %s (OK)\n", MQTT_TOPIC);
        published = true;
      } else {
        Serial.println("[MQTT] Publish failed!");
        consecutiveMqttFailures++;
      }
    }

    // Failover Transport: HTTP POST if MQTT is down or unreachable
    if (!published && consecutiveMqttFailures >= MAX_MQTT_FAILURES_BEFORE_HTTP) {
      Serial.println("[FAILOVER] MQTT offline. Invoking HTTP POST fallback...");
      sendHttpFallback(payload);
    }
  }

  delay(50); // Yield to FreeRTOS watchdog & network tasks
}
