import { Router, Request, Response } from 'express';
import mqtt, { MqttClient } from 'mqtt';
import { config } from '../../config.js';

export const scenarioRouter = Router();

let currentActiveScenario = 'normal';
let controlMqttClient: MqttClient | null = null;

function getControlMqtt(): MqttClient {
  if (!controlMqttClient) {
    controlMqttClient = mqtt.connect(config.MQTT_URL, {
      clientId: `coldaisle_control_${Math.random().toString(16).slice(2, 6)}`,
    });
  }
  return controlMqttClient;
}

const VALID_SCENARIOS = [
  'normal',
  'thermal_spike',
  'cdu_leak',
  'power_cut',
  'fuel_depletion',
  'sensor_dropout',
  'recovery',
];

scenarioRouter.get('/scenario', (req: Request, res: Response) => {
  res.status(200).json({ scenario: currentActiveScenario });
});

scenarioRouter.post('/scenario', (req: Request, res: Response): void => {
  const { scenario } = req.body || {};

  if (!scenario || !VALID_SCENARIOS.includes(scenario)) {
    res.status(400).json({
      error: `Invalid scenario '${scenario}'. Must be one of: ${VALID_SCENARIOS.join(', ')}`,
    });
    return;
  }

  currentActiveScenario = scenario;
  const client = getControlMqtt();

  client.publish('dcim/control/scenario', scenario, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to publish scenario control signal:', err);
      res.status(500).json({ error: 'Failed to dispatch scenario control' });
    } else {
      console.log(`🎮 [Control Bus] Operator injected scenario: [${scenario.toUpperCase()}]`);
      res.status(200).json({
        status: 'success',
        scenario: currentActiveScenario,
        timestamp: new Date().toISOString(),
      });
    }
  });
});
