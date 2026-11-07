import mqtt, { MqttClient } from 'mqtt';
import { TelemetryReadings } from './scenarios/types.js';

export interface PublisherOptions {
  protocol: 'mqtt' | 'http';
  mqttUrl: string;
  httpUrl: string;
  deviceKey: string;
  deviceId: string;
  site: string;
  hall: string;
  onScenarioChange?: (scenario: string) => void;
}

export class TelemetryPublisher {
  private client: MqttClient | null = null;
  private options: PublisherOptions;
  private topic: string;

  constructor(options: PublisherOptions) {
    this.options = options;
    this.topic = `dcim/${options.site}/${options.hall}/${options.deviceId}/telemetry`;
  }

  public async init(): Promise<void> {
    if (this.options.protocol === 'mqtt') {
      console.log(`🔌 [Sim Publisher] Connecting to MQTT broker at ${this.options.mqttUrl}...`);
      this.client = mqtt.connect(this.options.mqttUrl, {
        clientId: `coldaisle_sim_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        reconnectPeriod: 2000,
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout connecting to MQTT broker'));
        }, 8000);

        this.client!.on('connect', () => {
          clearTimeout(timeout);
          console.log(`✅ [Sim Publisher] Connected to MQTT broker.`);
          console.log(`📡 [Sim Publisher] Target Topic: ${this.topic}`);

          // Listen for remote scenario switch commands from dashboard or control bus
          this.client!.subscribe('dcim/control/scenario', { qos: 1 }, () => {
            console.log(`🎮 [Sim Publisher] Subscribed to control channel 'dcim/control/scenario'`);
          });

          resolve();
        });

        this.client!.on('error', (err) => {
          clearTimeout(timeout);
          console.error(`❌ [Sim Publisher] MQTT Error:`, err.message);
        });
      });

      this.client.on('message', (topic, message) => {
        if (topic === 'dcim/control/scenario') {
          const newScenario = message.toString().trim();
          console.log(`\n📢 [Sim Control] Remote scenario change signal received: '${newScenario}'`);
          if (this.options.onScenarioChange) {
            this.options.onScenarioChange(newScenario);
          }
        }
      });
    } else {
      console.log(`🌐 [Sim Publisher] Using HTTP fallback protocol: ${this.options.httpUrl}`);
    }
  }

  public async publish(readings: TelemetryReadings): Promise<void> {
    const payload = {
      device: this.options.deviceId,
      ts: new Date().toISOString(),
      readings,
    };

    if (this.options.protocol === 'mqtt' && this.client) {
      const message = JSON.stringify(payload);
      return new Promise((resolve, reject) => {
        this.client!.publish(this.topic, message, { qos: 1 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      // HTTP POST fallback
      const res = await fetch(this.options.httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Key': this.options.deviceKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP Ingest responded with ${res.status}: ${errText}`);
      }
    }
  }

  public close(): void {
    if (this.client) {
      this.client.end(true);
    }
  }
}
