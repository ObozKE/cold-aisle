import mqtt, { MqttClient } from 'mqtt';
import { config } from '../config.js';
import { processTelemetry } from '../services/telemetryProcessor.js';

export function startMqttSubscriber(): MqttClient {
  console.log(`🔌 [MQTT] Connecting to broker: ${config.MQTT_URL}...`);
  const client = mqtt.connect(config.MQTT_URL, {
    clientId: `coldaisle_ingest_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    console.log(`✅ [MQTT] Connected to broker successfully.`);
    client.subscribe(config.MQTT_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ [MQTT] Subscription failed for ${config.MQTT_TOPIC}:`, err);
      } else {
        console.log(`📡 [MQTT] Subscribed to topic: ${config.MQTT_TOPIC} (QoS 1)`);
      }
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const rawText = message.toString();
      const payload = JSON.parse(rawText);

      // Validate topic structure: dcim/{site}/{hall}/{device}/telemetry
      const parts = topic.split('/');
      if (parts.length === 5 && parts[0] === 'dcim' && parts[4] === 'telemetry') {
        const topicDevice = parts[3];
        if (payload.device && payload.device !== topicDevice) {
          console.warn(
            `⚠️ [MQTT] Topic device mismatch: topic='${topicDevice}' vs payload='${payload.device}'. Rejecting.`
          );
          return;
        }
      }

      await processTelemetry(payload, 'mqtt');
    } catch (err: any) {
      console.error(`❌ [MQTT Ingestion Error on ${topic}]:`, err.message);
    }
  });

  client.on('error', (err) => {
    console.error('❌ [MQTT Error]:', err.message);
  });

  client.on('offline', () => {
    console.warn('⚠️ [MQTT] Broker connection went offline. Retrying...');
  });

  return client;
}
